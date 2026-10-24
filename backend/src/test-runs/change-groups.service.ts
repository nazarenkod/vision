import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { TestRun, TestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StaticService } from '../static/static.service';
import { parseConfig } from '../compare/utils';
import { DEFAULT_CONFIG } from '../compare/libs/pixelmatch/pixelmatch.service';
import { PixelmatchConfig } from '../compare/libs/pixelmatch/pixelmatch.types';
import { signaturesMatch } from '../compare/libs/pixelmatch/signature.core';
import { UiTreeService, parseRegions, pngSize } from '../ui-tree/ui-tree.service';
import { changeFingerprint, diffTrees, StructuralChange } from '../ui-tree/structure-diff';
import { findNoiseHints, NoiseHint } from '../ui-tree/noise-hints';
import { TestRunDto } from './dto/testRun.dto';
import { magnitudesSimilar, mapWithConcurrency, SIGNATURE_CONCURRENCY, TestRunsService } from './test-runs.service';

export type ChangeGroupKind = 'structural' | 'visual' | 'new';

export interface ChangeGroup {
  // stable while the members stay the same
  id: string;
  kind: ChangeGroupKind;
  title: string;
  screens: string[];
  testRuns: TestRunDto[];
  // element-level changes shared by the group (structural groups only)
  changes: StructuralChange[];
  // set when every member looks like the same kind of noise
  noise: NoiseHint | null;
  // identity of the change itself, for caching AI answers about it
  fingerprint: string;
}

// Only regions this close to the top can be the status bar; the image is read
// for its size only then.
const STATUS_BAR_CANDIDATE_PX = 220;

const hash = (value: string) => createHash('sha1').update(value).digest('hex').slice(0, 16);

/**
 * Groups the screenshots of a build that need a decision by the change they
 * carry, so one decision covers them all:
 * - with UI trees: identical element-level change (text, added/removed,
 *   resized elements), across screens and devices;
 * - without: same screen on any device/browser/locale whose change has the
 *   same colour signature and a similar size;
 * - screenshots without a baseline are listed together as new.
 * Nothing is approved here; the reviewer confirms each group.
 */
@Injectable()
export class ChangeGroupsService {
  private readonly logger = new Logger(ChangeGroupsService.name);

  constructor(
    private prismaService: PrismaService,
    private staticService: StaticService,
    private uiTreeService: UiTreeService,
    private testRunsService: TestRunsService
  ) {}

  async getGroups(buildId: string): Promise<ChangeGroup[]> {
    const runs = await this.prismaService.testRun.findMany({
      where: { buildId, status: { in: [TestStatus.unresolved, TestStatus.new] } },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    if (!runs.length) return [];

    const changed = runs.filter((run) => run.status === TestStatus.unresolved && run.baselineName);
    const fresh = runs.filter((run) => !changed.includes(run));

    const structural = await this.structuralGroups(changed);
    const grouped = new Set(structural.flatMap((group) => group.testRuns.map((run) => run.id)));
    const visual = await this.visualGroups(changed.filter((run) => !grouped.has(run.id)));
    const groups = [...structural, ...visual];

    await mapWithConcurrency(groups, SIGNATURE_CONCURRENCY, async (group) => {
      group.noise = await this.commonNoise(runs.filter((run) => group.testRuns.some((member) => member.id === run.id)));
    });

    groups.sort(
      (a, b) =>
        Number(!!a.noise) - Number(!!b.noise) || b.testRuns.length - a.testRuns.length || a.title.localeCompare(b.title)
    );
    if (fresh.length) groups.push(this.group('new', 'New screenshots', fresh, [], 'new'));
    return groups;
  }

  private group(
    kind: ChangeGroupKind,
    title: string,
    members: TestRun[],
    changes: StructuralChange[],
    fingerprint: string
  ): ChangeGroup {
    return {
      id: hash(
        members
          .map((run) => run.id)
          .sort()
          .join(',')
      ),
      kind,
      title,
      screens: [...new Set(members.map((run) => run.name))],
      testRuns: members.map((run) => new TestRunDto(run)),
      changes,
      noise: null,
      fingerprint,
    };
  }

  private async structuralGroups(runs: TestRun[]): Promise<ChangeGroup[]> {
    const withTrees = runs.filter((run) => run.uiTreeName && run.baselineUiTreeName);
    const keyed = await mapWithConcurrency(withTrees, SIGNATURE_CONCURRENCY, async (run) => {
      const [tree, baseline] = await Promise.all([
        this.uiTreeService.load(run.uiTreeName),
        this.uiTreeService.load(run.baselineUiTreeName),
      ]);
      if (!tree || !baseline) return null;
      const changes = diffTrees(baseline, tree);
      const fingerprint = changeFingerprint(changes);
      return fingerprint ? { run, changes, fingerprint } : null;
    });

    const byFingerprint = new Map<string, Array<{ run: TestRun; changes: StructuralChange[] }>>();
    for (const item of keyed) {
      if (!item) continue;
      byFingerprint.set(item.fingerprint, [...(byFingerprint.get(item.fingerprint) ?? []), item]);
    }
    return [...byFingerprint.entries()].map(([fingerprint, items]) => {
      const changes = items[0].changes.filter((change) => change.kind !== 'moved');
      const elements = [...new Set(changes.map((change) => change.element))];
      const title = elements.length === 1 ? elements[0] : `${elements[0]} +${elements.length - 1}`;
      return this.group(
        'structural',
        title,
        items.map((item) => item.run),
        changes,
        `struct:${hash(fingerprint)}`
      );
    });
  }

  private async visualGroups(runs: TestRun[]): Promise<ChangeGroup[]> {
    if (!runs.length) return [];
    const project = await this.prismaService.project.findUnique({ where: { id: runs[0].projectId } });
    const config: PixelmatchConfig = {
      ...DEFAULT_CONFIG,
      ...parseConfig(project?.imageComparisonConfig, DEFAULT_CONFIG, this.logger),
    };
    const signatures = await mapWithConcurrency(runs, SIGNATURE_CONCURRENCY, (run) =>
      this.testRunsService.getChangeSignature(run, config).catch(() => null)
    );

    // greedy clustering within a screen: the first run of a cluster is its reference
    const clusters: Array<{ reference: TestRun; signature: number[] | null; members: TestRun[] }> = [];
    runs.forEach((run, index) => {
      const signature = signatures[index];
      const cluster = signature
        ? clusters.find(
            (c) =>
              c.reference.name === run.name &&
              c.signature &&
              signaturesMatch(c.signature, signature) &&
              magnitudesSimilar(c.reference.diffPercent, run.diffPercent)
          )
        : undefined;
      if (cluster) cluster.members.push(run);
      else clusters.push({ reference: run, signature, members: [run] });
    });

    return clusters.map((cluster) =>
      this.group(
        'visual',
        cluster.reference.name,
        cluster.members,
        [],
        // the change itself: screen plus a coarse signature, so the same change in a later build reuses AI answers
        `visual:${hash(`${cluster.reference.name}|${(cluster.signature ?? []).map((v) => v.toFixed(2)).join(',')}`)}`
      )
    );
  }

  /** The noise hint every member shares, if any. */
  private async commonNoise(members: TestRun[]): Promise<NoiseHint | null> {
    let common: NoiseHint | null = null;
    for (const run of members) {
      const regions = parseRegions(run.diffRegions);
      if (!regions.length) return null;
      const tree = run.uiTreeName ? await this.uiTreeService.load(run.uiTreeName) : null;
      let size = tree ? { width: tree.width, height: tree.height } : null;
      if (!size) {
        const nearTop = regions.every((region) => region.y + region.height <= STATUS_BAR_CANDIDATE_PX);
        const buffer = nearTop || tree ? await this.staticService.getImageBuffer(run.imageName) : null;
        size = buffer ? pngSize(buffer) : { width: 0, height: 0 };
      }
      const [hint] = findNoiseHints({
        regions,
        diffPercent: run.diffPercent,
        imageWidth: size.width,
        imageHeight: size.height,
        tree,
      });
      if (!hint || (common && common.kind !== hint.kind)) return null;
      common = common ?? hint;
    }
    return common;
  }
}
