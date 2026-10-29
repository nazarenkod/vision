import z from 'zod/v3';
import { Rect } from '../ui-tree/ui-tree.types';

/** What the model drafts: only these four, never severity, environment or people (REQ-025-44). */
export interface BugDraft {
  essence: string;
  steps: string;
  actual: string;
  expected: string;
}

const DraftSchema = z.object({
  essence: z.string(),
  steps: z.array(z.string()),
  actual: z.string(),
  expected: z.string(),
});
type DraftAnswer = { essence: string; steps: string[]; actual: string; expected: string };
// the project compiles without strictNullChecks, where zod infers every key as optional
export const draftSchema = DraftSchema as unknown as z.ZodType<DraftAnswer>;

// a handful of areas is what a person marks; more would make one call large
const MAX_AREAS = 3;

/**
 * The areas to show the model: the person's marks, else the changed areas;
 * the largest first, at most three.
 */
export function cropAreas(marks: Rect[], changedAreas: Rect[]): Rect[] {
  const areas = (marks.length ? marks : changedAreas).filter((area) => area.width > 0 && area.height > 0);
  return [...areas].sort((a, b) => b.width * b.height - a.width * a.height).slice(0, MAX_AREAS);
}

/** The request: the person's own words lead; the crops and changes only say where to look. */
export function draftPrompt(input: {
  note: string;
  feature: string;
  checkName: string;
  changes: string[];
  areaCount: number;
}): string {
  return [
    'You help a QA engineer file a bug about a mobile app screen found in a visual regression review.',
    `Feature: "${input.feature}". Check (test) name: "${input.checkName}".`,
    input.areaCount
      ? `The images come in pairs, ${input.areaCount} pair(s): for each area, first the approved baseline, then the new build.`
      : 'There are no images.',
    input.changes.length ? `Changes the review found there:\n${input.changes.map((c) => `- ${c}`).join('\n')}` : '',
    `What the engineer says is wrong (this decides what the bug is about; anything they call intended is not a bug):`,
    `"""${input.note.trim()}"""`,
    'Write in Ukrainian. Reply in JSON with exactly these keys:',
    'essence: the bug title after its prefix, one short phrase without a full stop, e.g. "кнопка «Pay» обрізана знизу екрана";',
    'steps: 2–4 short steps to reach this screen of the feature, without numbers, the last one opening the screen;',
    'actual: one or two sentences on what the new build shows that is wrong;',
    'expected: one or two sentences on how it should look, as in the baseline.',
    'Do not mention severity, devices or people.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The answer in the dialog's form: numbered steps, trimmed text. */
export function draftFields(answer: DraftAnswer): BugDraft {
  return {
    essence: answer.essence.trim().replace(/[.。]+$/, ''),
    steps: answer.steps
      .map((step) => step.trim().replace(/^\d+[.)]\s*/, ''))
      .filter(Boolean)
      .map((step, index) => `${index + 1}. ${step}`)
      .join('\n'),
    actual: answer.actual.trim(),
    expected: answer.expected.trim(),
  };
}
