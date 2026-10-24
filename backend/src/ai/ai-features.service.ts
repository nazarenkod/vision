import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import z from 'zod/v3';
import { PrismaService } from '../prisma/prisma.service';
import { StaticService } from '../static/static.service';
import { ChangeGroupsService } from '../test-runs/change-groups.service';
import { A11yIssuesService } from '../a11y/a11y-issues.service';
import { UiTreeService, parseRegions } from '../ui-tree/ui-tree.service';
import { ownSpeakableText } from '../ui-tree/ui-tree.parser';
import { AiService } from './ai.service';
import { cropPng } from './image-crop';

const SummarySchema = z.object({
  summary: z.string(),
  verdict: z.enum(['intended', 'regression', 'noise']),
  confidence: z.number().min(0).max(1),
});
export type ChangeVerdict = 'intended' | 'regression' | 'noise';
type SummaryAnswer = { summary: string; verdict: ChangeVerdict; confidence: number };
// the project compiles without strictNullChecks, where zod infers every key as optional
const summarySchema = SummarySchema as unknown as z.ZodType<SummaryAnswer>;

export interface GroupSummary {
  summary: string;
  verdict: ChangeVerdict;
  confidence: number;
  // 'rules' when the answer came from deterministic checks and cost nothing
  source: 'ai' | 'rules';
  cached: boolean;
  model: string | null;
}

const labelsSchema = z.object({
  labels: z.array(z.object({ index: z.number().int(), label: z.string() })),
}) as unknown as z.ZodType<{ labels: Array<{ index: number; label: string }> }>;

// Enough for a screen; more icons than this in one run is unusual and would
// make one call large.
const MAX_LABELS_PER_CALL = 8;
const VERDICT_RULES =
  'verdict: "intended" if it looks like a deliberate product change, "regression" if it looks broken ' +
  '(cut-off, overlapping, missing or garbled content, empty values, error states), "noise" if it does not ' +
  'matter (times, counters, rendering artefacts); confidence from 0 to 1.';

/**
 * The AI features, each built to cost as little as possible: one call per
 * change group rather than per screenshot, text instead of images where the
 * UI tree already says what changed, small crops instead of full screenshots,
 * deterministic answers (noise hints) before any model call, and every answer
 * cached by its inputs.
 */
@Injectable()
export class AiFeaturesService {
  constructor(
    private aiService: AiService,
    private prismaService: PrismaService,
    private staticService: StaticService,
    private changeGroupsService: ChangeGroupsService,
    private a11yIssuesService: A11yIssuesService,
    private uiTreeService: UiTreeService
  ) {}

  /** One-sentence description and verdict for a group of identical changes. */
  async summarizeGroup(buildId: string, groupId: string): Promise<GroupSummary> {
    const group = (await this.changeGroupsService.getGroups(buildId)).find((g) => g.id === groupId);
    if (!group) throw new NotFoundException('Change group not found; the build may have changed, reload it');
    if (group.kind === 'new') throw new BadRequestException('New screenshots have no change to describe');

    if (group.noise) {
      return {
        summary: group.noise.message,
        verdict: 'noise',
        confidence: 0.9,
        source: 'rules',
        cached: true,
        model: null,
      };
    }

    const count = `${group.testRuns.length} screenshot${group.testRuns.length > 1 ? 's' : ''}`;
    if (group.kind === 'structural') {
      const lines = group.changes.slice(0, 15).map((change) => {
        const values = change.before !== undefined ? `: "${change.before}" → "${change.after}"` : '';
        return `- ${change.kind}: ${change.element}${values}`;
      });
      const answer = await this.aiService.generateJson({
        kind: 'group-summary',
        schema: summarySchema,
        cacheParts: group.fingerprint,
        prompt: [
          'You review visual regression results of a mobile app. These element-level changes between the approved',
          `baseline and the new build appear identically on ${count} (screens: ${group.screens.join(', ')}):`,
          ...lines,
          'Reply in JSON. summary: one plain sentence for the reviewer saying what changed.',
          VERDICT_RULES,
        ].join('\n'),
      });
      return { ...answer.result, source: 'ai', cached: answer.cached, model: answer.model };
    }

    // visual group: show the model the main changed area, before and after
    const first = await this.prismaService.testRun.findUnique({ where: { id: group.testRuns[0].id } });
    const [region] = parseRegions(first?.diffRegions);
    const [baseline, image] = await Promise.all([
      this.staticService.getImage(first?.baselineName),
      this.staticService.getImage(first?.imageName),
    ]);
    if (!region || !baseline || !image) {
      throw new BadRequestException('This change has no stored diff area to describe');
    }
    const answer = await this.aiService.generateJson({
      kind: 'group-summary',
      schema: summarySchema,
      cacheParts: group.fingerprint,
      images: [cropPng(baseline, region), cropPng(image, region)],
      prompt: [
        `Two crops of the same area of the screen "${first.name}" in a visual regression test: the first is the`,
        `approved baseline, the second is the new build. The same change appears on ${count}.`,
        'Reply in JSON. summary: one plain sentence for the reviewer saying what changed.',
        VERDICT_RULES,
      ].join('\n'),
    });
    return { ...answer.result, source: 'ai', cached: answer.cached, model: answer.model };
  }

  /**
   * Proposed accessibility labels for the unlabeled controls of a run, from
   * small crops of each control, in the language of the screen's own texts.
   */
  async suggestLabels(testRunId: string): Promise<{ suggestions: Array<{ violationId: string; label: string }> }> {
    const report = await this.a11yIssuesService.getReviewedReport(testRunId);
    const missing = (report?.violations ?? []).filter((v) => v.rule === 'missing-label').slice(0, MAX_LABELS_PER_CALL);
    if (!missing.length) return { suggestions: [] };

    const testRun = await this.prismaService.testRun.findUnique({ where: { id: testRunId } });
    const [image, tree] = await Promise.all([
      this.staticService.getImage(testRun.imageName),
      this.uiTreeService.load(testRun.uiTreeName),
    ]);
    if (!image) throw new BadRequestException('Screenshot is not available');
    const screenTexts = [...new Set((tree?.nodes ?? []).map(ownSpeakableText).filter((text) => text.length > 1))]
      .slice(0, 12)
      .map((text) => `"${text.slice(0, 40)}"`);

    const answer = await this.aiService.generateJson({
      kind: 'a11y-labels',
      schema: labelsSchema,
      images: missing.map((v) => cropPng(image, v.bounds, { padding: 8, maxSide: 128 })),
      prompt: [
        `Each of these ${missing.length} images is a control from a mobile app screen with no accessibility label.`,
        screenTexts.length ? `Other texts on the screen: ${screenTexts.join(', ')}.` : '',
        'For each image, in order, propose a short label (1–4 words) naming its action, in the same language as',
        'the screen texts. Never include words like "button" or "icon".',
        'Reply in JSON: {"labels": [{"index": 1, "label": "..."}]}, index starting at 1.',
      ]
        .filter(Boolean)
        .join('\n'),
    });
    return {
      suggestions: answer.result.labels
        .filter((item) => item.index >= 1 && item.index <= missing.length && item.label.trim())
        .map((item) => ({ violationId: missing[item.index - 1].id, label: item.label.trim() })),
    };
  }
}
