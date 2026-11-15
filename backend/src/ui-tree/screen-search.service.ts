import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { screenTitle } from '../a11y/a11y-problems';
import { parseUiTreeSettings } from './comparison-inputs';
import { MatchPlace, matchTree, parseQuery, QueryProblem } from './screen-search';
import { ScreenSearchIndex } from './screen-search.index';
import { UiTreeService } from './ui-tree.service';
import { Rect, UiTree } from './ui-tree.types';

// Checks per answer; the rest come with "show more" (REQ-053-10).
export const SEARCH_PAGE_SIZE = 100;
// Projects warmed up after a start, most recently active first (ADR-0029).
const WARM_PROJECTS = 4;

export interface ScreenSearchItem {
  // the variation for a baseline, the run for a screen of a build
  id: string;
  testVariationId: string | null;
  device: string;
  os: string;
  browser: string;
  viewport: string;
  imageName: string | null;
  imageThumbnailName: string | null;
  width: number;
  height: number;
  boxes: Rect[];
  keys: string[];
}

export interface ScreenSearchRow {
  name: string;
  customTags: string;
  screen: string;
  matches: number;
  where: MatchPlace[];
  items: ScreenSearchItem[];
}

export interface ScreenSearchResult {
  problem?: QueryProblem;
  scanned: number;
  withoutTree: number;
  total: number;
  page: number;
  rows: ScreenSearchRow[];
}

interface Candidate {
  id: string;
  testVariationId: string | null;
  name: string;
  customTags: string;
  device: string;
  os: string;
  browser: string;
  viewport: string;
  imageName: string | null;
  imageThumbnailName: string | null;
  tree: UiTree | null;
}

const PLACES: MatchPlace[] = ['text', 'label', 'selector'];

/**
 * Search of a project's screens by their UI trees (053): the latest baselines of the main branch,
 * or the screens of one build. Deterministic; no AI call (REQ-053-50).
 */
@Injectable()
export class ScreenSearchService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScreenSearchService.name);
  private readonly index: ScreenSearchIndex;

  constructor(
    private readonly prisma: PrismaService,
    private readonly uiTreeService: UiTreeService
  ) {
    this.index = new ScreenSearchIndex((name) => this.uiTreeService.load(name));
  }

  onApplicationBootstrap() {
    // the first search after a start would otherwise read every tree file of the project
    if (process.env.NODE_ENV !== 'test') setTimeout(() => void this.warm(), 10_000).unref();
  }

  async search(projectId: string, raw: string, scope: { buildId?: string }, page = 0): Promise<ScreenSearchResult> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { mainBranchName: true, uiTreeSettings: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    const query = parseQuery(raw ?? '');
    const empty = { scanned: 0, withoutTree: 0, total: 0, page, rows: [] };
    if ('problem' in query) return { ...empty, problem: query.problem };

    const candidates = scope.buildId
      ? await this.buildScreens(projectId, scope.buildId)
      : await this.baselines(projectId, project.mainBranchName);
    const titleSelectors = parseUiTreeSettings(project.uiTreeSettings).screenTitle;

    const rows = new Map<string, ScreenSearchRow>();
    let scanned = 0;
    for (const candidate of candidates) {
      if (!candidate.tree) continue;
      scanned++;
      const found = matchTree(candidate.tree, query);
      if (!found.length) continue;
      const key = `${candidate.name}\n${candidate.customTags}`;
      const row = rows.get(key) ?? {
        name: candidate.name,
        customTags: candidate.customTags,
        screen: screenTitle(candidate.tree, titleSelectors) ?? candidate.name,
        matches: 0,
        where: [],
        items: [],
      };
      row.matches += found.length;
      row.where = PLACES.filter((place) => row.where.includes(place) || found.some((m) => m.where.includes(place)));
      row.items.push({
        id: candidate.id,
        testVariationId: candidate.testVariationId,
        device: candidate.device,
        os: candidate.os,
        browser: candidate.browser,
        viewport: candidate.viewport,
        imageName: candidate.imageName,
        imageThumbnailName: candidate.imageThumbnailName,
        width: candidate.tree.width,
        height: candidate.tree.height,
        boxes: found.map((match) => match.bounds),
        keys: found.map((match) => match.key),
      });
      rows.set(key, row);
    }

    const sorted = [...rows.values()].sort(
      (a, b) => a.name.localeCompare(b.name) || a.customTags.localeCompare(b.customTags)
    );
    const shown = sorted.slice(page * SEARCH_PAGE_SIZE, (page + 1) * SEARCH_PAGE_SIZE);
    if (!scope.buildId) await this.addThumbnails(shown);
    for (const row of shown) row.items.sort((a, b) => `${a.device} ${a.os}`.localeCompare(`${b.device} ${b.os}`));
    return { scanned, withoutTree: candidates.length - scanned, total: sorted.length, page, rows: shown };
  }

  private async baselines(projectId: string, branchName: string): Promise<Candidate[]> {
    // other branches hold the same checks in progress and would repeat every row (design 053)
    const variations = await this.prisma.testVariation.findMany({
      where: { projectId, branchName, baselineName: { not: null } },
      select: {
        id: true,
        name: true,
        customTags: true,
        device: true,
        os: true,
        browser: true,
        viewport: true,
        baselineName: true,
        baselineUiTreeName: true,
      },
    });
    const trees = await this.index.treesFor(
      projectId,
      variations
        .filter((variation) => variation.baselineUiTreeName)
        .map((variation) => ({ variationId: variation.id, treeName: variation.baselineUiTreeName }))
    );
    return variations.map((variation) => ({
      id: variation.id,
      testVariationId: variation.id,
      name: variation.name,
      customTags: variation.customTags ?? '',
      device: variation.device ?? '',
      os: variation.os ?? '',
      browser: variation.browser ?? '',
      viewport: variation.viewport ?? '',
      imageName: variation.baselineName,
      imageThumbnailName: null,
      tree: trees.get(variation.id) ?? null,
    }));
  }

  private async buildScreens(projectId: string, buildId: string): Promise<Candidate[]> {
    const build = await this.prisma.build.findFirst({ where: { id: buildId, projectId }, select: { id: true } });
    // a build of another project is as unknown as a missing one (REQ-042-02)
    if (!build) throw new NotFoundException('Build not found');
    const runs = await this.prisma.testRun.findMany({
      where: { buildId },
      select: {
        id: true,
        testVariationId: true,
        name: true,
        customTags: true,
        device: true,
        os: true,
        browser: true,
        viewport: true,
        imageName: true,
        imageThumbnailName: true,
        uiTreeName: true,
      },
    });
    const trees = await Promise.all(runs.map((run) => this.uiTreeService.load(run.uiTreeName)));
    return runs.map((run, i) => ({
      id: run.id,
      testVariationId: run.testVariationId,
      name: run.name,
      customTags: run.customTags ?? '',
      device: run.device ?? '',
      os: run.os ?? '',
      browser: run.browser ?? '',
      viewport: run.viewport ?? '',
      imageName: run.imageName,
      imageThumbnailName: run.imageThumbnailName,
      tree: trees[i],
    }));
  }

  /** A baseline's small copy is the one made for the run it was approved from. */
  private async addThumbnails(rows: ScreenSearchRow[]): Promise<void> {
    const items = rows.flatMap((row) => row.items);
    if (!items.length) return;
    const baselines = await this.prisma.baseline.findMany({
      where: { testVariationId: { in: items.map((item) => item.id) } },
      select: { testVariationId: true, baselineName: true, testRun: { select: { imageThumbnailName: true } } },
    });
    for (const item of items) {
      const baseline = baselines.find((row) => row.testVariationId === item.id && row.baselineName === item.imageName);
      item.imageThumbnailName = baseline?.testRun?.imageThumbnailName ?? null;
    }
  }

  private async warm(): Promise<void> {
    try {
      const projects = await this.prisma.project.findMany({
        orderBy: { updatedAt: 'desc' },
        take: WARM_PROJECTS,
        select: { id: true },
      });
      for (const { id } of projects) await this.search(id, '__warm__', {});
    } catch (error) {
      this.logger.warn(`Cannot warm up the screen search: ${error}`);
    }
  }
}
