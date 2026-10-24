import { Injectable, Logger } from '@nestjs/common';
import { TestRun } from '@prisma/client';
import { gunzipSync, gzipSync } from 'zlib';
import { StaticService } from '../static/static.service';
import { buildReport, findViolations } from '../a11y/a11y.rules';
import { A11yReport, RgbaImage } from '../a11y/a11y.types';
import { describeNode, parseUiTree } from './ui-tree.parser';
import { Rect, UiTree, UiTreeFormat } from './ui-tree.types';
import { diffTrees, elementsUnderRegions, RegionElement, StructuralChange } from './structure-diff';
import { findNoiseHints, NoiseHint } from './noise-hints';
import {
  CaptureWarning,
  ComponentChange,
  componentChanges,
  detectLoading,
  invisibleChanges,
  MISMATCH_BELOW,
  SAME_SCREEN_ABOVE,
  screenSimilarity,
} from './screen-checks';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeMoves,
  ElementMove,
  ElementRule,
  findSystemBars,
  parseJsonArray,
  parseUiTreeSettings,
  resolveRules,
  ResolvedRules,
  UiTreeSettings,
} from './comparison-inputs';

const GZIP_MAGIC = [0x1f, 0x8b];

// Trees never change once stored, so recently read ones are kept.
const TREE_CACHE_SIZE = 300;
const MAX_SCREENS_TO_MATCH = 200;

export interface TreeAnalysis {
  reportName: string;
  report: A11yReport;
  warnings: CaptureWarning[];
  // changes the screenshot does not show
  invisible: StructuralChange[];
  components: ComponentChange[];
}

export interface ComparisonInputs {
  ignoreAreas: Rect[];
  toleranceAreas: Array<Rect & { maxDiffPercent: number }>;
  moves: ElementMove[];
  systemBars: Rect[];
  rules: ResolvedRules;
  settings: UiTreeSettings | null;
}

export interface UiTreeOptions {
  excludeSystemBars?: boolean;
}

export function parseUiTreeOptions(value: string | null | undefined): UiTreeOptions {
  if (!value) return {};
  try {
    return JSON.parse(value) ?? {};
  } catch {
    return {};
  }
}

export interface StructureInfo {
  hasUiTree: boolean;
  hasBaselineUiTree: boolean;
  changes: StructuralChange[];
  regions: RegionElement[];
  hints: NoiseHint[];
  // changes the screenshot does not show
  invisible: StructuralChange[];
  warnings: CaptureWarning[];
  rules: Array<ElementRule & { scope: 'screen' | 'project'; matches: number }>;
  ignoredAreas: Rect[];
  toleratedAreas: Array<Rect & { maxDiffPercent: number }>;
  systemBars: Rect[];
  // compensated moves, in dp
  moves: Array<{ key: string; element: string; dxDp: number; dyDp: number }>;
  settings: UiTreeSettings;
}

/** Width and height from a PNG's IHDR chunk, without decoding the image. */
export function pngSize(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export function parseRegions(value: string | null): Rect[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Keeps the UI tree sent with a screenshot and derives what the tree makes
 * possible: the accessibility report, the element-level diff against the
 * baseline's tree, and noise hints. Trees are stored parsed (gzipped JSON) so
 * nothing has to re-read the XML, and with the density they were taken at.
 */
@Injectable()
export class UiTreeService {
  private readonly logger = new Logger(UiTreeService.name);

  constructor(
    private staticService: StaticService,
    private prismaService: PrismaService
  ) {}

  /**
   * Parses the page source (base64 of XML, gzipped or not) against the
   * screenshot it came with and stores it. Returns null and logs when the tree
   * cannot be read: a bad tree never fails the screenshot upload.
   */
  async store(
    uiTreeBase64: string,
    options: { format?: UiTreeFormat; densityDpi?: number; activity?: string },
    imageBuffer: Buffer
  ): Promise<{ name: string; tree: UiTree } | null> {
    try {
      let bytes = Buffer.from(uiTreeBase64, 'base64');
      if (bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]) {
        bytes = gunzipSync(bytes);
      }
      const { width, height } = pngSize(imageBuffer);
      const tree = parseUiTree(bytes.toString('utf8'), {
        format: options.format,
        densityDpi: options.densityDpi,
        activity: options.activity,
        imageWidth: width,
        imageHeight: height,
      });
      const name = await this.staticService.saveFile(
        'uitree',
        gzipSync(JSON.stringify(tree)),
        'json.gz',
        'application/gzip'
      );
      return { name, tree };
    } catch (error) {
      this.logger.warn(`Ignoring UI tree that cannot be read: ${error}`);
      return null;
    }
  }

  private readonly treeCache = new Map<string, UiTree>();

  async load(name: string | null): Promise<UiTree | null> {
    if (!name) return null;
    const cached = this.treeCache.get(name);
    if (cached) return cached;
    try {
      const buffer = await this.staticService.getFileBuffer(name);
      const tree = buffer ? (JSON.parse(gunzipSync(buffer).toString('utf8')) as UiTree) : null;
      if (tree) {
        if (this.treeCache.size >= TREE_CACHE_SIZE) this.treeCache.delete(this.treeCache.keys().next().value);
        this.treeCache.set(name, tree);
      }
      return tree;
    } catch (error) {
      this.logger.warn(`Cannot read UI tree ${name}: ${error}`);
      return null;
    }
  }

  private async decode(imageName: string | null): Promise<RgbaImage | undefined> {
    if (!imageName) return undefined;
    try {
      return (await this.staticService.getImage(imageName)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Accessibility report of a run: its issues, split into new and existing
   * against the issues of the baseline's tree. Stored as a file; the caller
   * keeps the counts on the row.
   */
  /**
   * Everything the UI tree tells about a fresh run, in one pass over its
   * decoded images: the accessibility report (stored as a file), capture
   * warnings, changes the pixels do not show, and changed components.
   */
  async analyze(testRun: TestRun, tree: UiTree): Promise<TreeAnalysis> {
    const [image, baselineImage, baselineTree, project] = await Promise.all([
      this.decode(testRun.imageName),
      this.decode(testRun.baselineName),
      this.load(testRun.baselineUiTreeName),
      testRun.projectId ? this.prismaService.project.findUnique({ where: { id: testRun.projectId } }) : null,
    ]);
    const settings = parseUiTreeSettings(project?.uiTreeSettings);

    const current = findViolations(tree, image);
    const baseline = baselineTree ? findViolations(baselineTree, baselineImage) : null;
    const report = buildReport(tree, current, baseline);
    const reportName = await this.staticService.saveFile(
      'a11y',
      Buffer.from(JSON.stringify(report)),
      'json',
      'application/json'
    );

    const regions = parseRegions(testRun.diffRegions);
    const changes = baselineTree ? diffTrees(baselineTree, tree) : [];
    const clickable = new Set(
      [...tree.nodes, ...(baselineTree?.nodes ?? [])].filter((node) => node.clickable).map((node) => node.key)
    );
    const invisible =
      settings.detectSemanticChanges && baselineTree ? invisibleChanges(changes, regions, clickable) : [];

    const warnings: CaptureWarning[] = [];
    const loading = settings.detectLoading ? detectLoading(tree) : null;
    if (loading) warnings.push(loading);
    if (settings.detectScreenMismatch) {
      warnings.push(...(await this.screenWarnings(testRun, tree, baselineTree)));
    }

    const components = image
      ? componentChanges({ tree, baselineTree, image, baselineImage: baselineImage ?? null, regions, changes })
      : [];
    return { reportName, report, warnings, invisible, components };
  }

  /** Warns when the tree looks like another screen than its baseline, or like a screen that already exists. */
  private async screenWarnings(testRun: TestRun, tree: UiTree, baselineTree: UiTree | null): Promise<CaptureWarning[]> {
    const similarity = baselineTree ? screenSimilarity(tree, baselineTree) : null;
    if (similarity !== null && similarity >= MISMATCH_BELOW) return [];

    // the best match among other screens' baselines, to say what this looks like
    const others = testRun.projectId
      ? await this.prismaService.testVariation.findMany({
          where: { projectId: testRun.projectId, baselineUiTreeName: { not: null }, name: { not: testRun.name } },
          orderBy: { updatedAt: 'desc' },
          take: MAX_SCREENS_TO_MATCH,
        })
      : [];
    let best: { name: string; similarity: number } | null = null;
    for (const other of others) {
      const otherTree = await this.load(other.baselineUiTreeName);
      if (!otherTree) continue;
      const score = screenSimilarity(tree, otherTree);
      if (!best || score > best.similarity) best = { name: other.name, similarity: score };
    }
    const percent = (value: number) => `${Math.round(value * 100)}%`;

    if (similarity !== null) {
      const hint =
        best && best.similarity >= SAME_SCREEN_ABOVE
          ? ` It looks like "${best.name}" (${percent(best.similarity)}).`
          : '';
      return [
        {
          kind: 'screen-mismatch',
          message: `This does not look like the screen of its baseline (${percent(similarity)} alike).${hint}`,
          similarity,
          ...(hint ? { looksLike: best.name } : {}),
        },
      ];
    }
    if (best && best.similarity >= SAME_SCREEN_ABOVE) {
      return [
        {
          kind: 'duplicate-screen',
          message: `New screen, but it looks like "${best.name}" (${percent(best.similarity)} alike). Renamed test?`,
          similarity: best.similarity,
          looksLike: best.name,
        },
      ];
    }
    return [];
  }

  async loadReport(name: string | null): Promise<A11yReport | null> {
    if (!name) return null;
    const buffer = await this.staticService.getFileBuffer(name);
    return buffer ? (JSON.parse(buffer.toString('utf8')) as A11yReport) : null;
  }

  /** What changed in a run, by element, plus noise hints. Computed on demand. */
  async structure(testRun: TestRun): Promise<StructureInfo> {
    const [tree, baselineTree, imageBuffer, inputs, project, variation] = await Promise.all([
      this.load(testRun.uiTreeName),
      this.load(testRun.baselineUiTreeName),
      this.staticService.getImageBuffer(testRun.imageName),
      this.comparisonInputs(testRun),
      testRun.projectId ? this.prismaService.project.findUnique({ where: { id: testRun.projectId } }) : null,
      testRun.testVariationId
        ? this.prismaService.testVariation.findUnique({ where: { id: testRun.testVariationId } })
        : null,
    ]);
    const regions = parseRegions(testRun.diffRegions);
    const size = imageBuffer ? pngSize(imageBuffer) : { width: tree?.width ?? 0, height: tree?.height ?? 0 };
    const changes = tree && baselineTree ? diffTrees(baselineTree, tree) : [];
    const clickable = new Set(
      [...(tree?.nodes ?? []), ...(baselineTree?.nodes ?? [])].filter((n) => n.clickable).map((n) => n.key)
    );
    const settings = parseUiTreeSettings(project?.uiTreeSettings);
    const withScope = (rules: ElementRule[], scope: 'screen' | 'project') =>
      rules.map((rule) => ({ ...rule, scope, matches: inputs.rules.matches[rule.id] ?? 0 }));
    const nodesByKey = new Map((tree?.nodes ?? []).map((node) => [node.key, node]));
    return {
      hasUiTree: !!tree,
      hasBaselineUiTree: !!baselineTree,
      changes,
      regions: tree
        ? elementsUnderRegions(tree, regions)
        : regions.map((region) => ({ region, key: null, element: null, resourceId: null })),
      hints: findNoiseHints({
        regions,
        diffPercent: testRun.diffPercent,
        imageWidth: size.width,
        imageHeight: size.height,
        tree,
      }),
      invisible: tree && baselineTree ? invisibleChanges(changes, regions, clickable) : [],
      warnings: parseJsonArray<CaptureWarning>(testRun.captureWarnings),
      rules: [
        ...withScope(parseJsonArray<ElementRule>(variation?.elementRules), 'screen'),
        ...withScope(settings.elementRules, 'project'),
      ],
      ignoredAreas: inputs.rules.ignore,
      toleratedAreas: inputs.rules.tolerate,
      systemBars: inputs.systemBars,
      moves: inputs.moves.map((move) => {
        const node = nodesByKey.get(move.key);
        const ppd = tree?.pixelsPerDp || 1;
        return {
          key: move.key,
          element: node ? describeNode(node) : move.key,
          dxDp: Math.round((move.to.x - move.from.x) / ppd),
          dyDp: Math.round((move.to.y - move.from.y) / ppd),
        };
      }),
      settings,
    };
  }

  /**
   * What the UI trees add to a comparison: ignore areas from element rules and
   * system bars, tolerance areas, and the moves to compensate. Empty when the
   * run has no UI tree.
   */
  async comparisonInputs(
    testRun: Pick<TestRun, 'projectId' | 'testVariationId' | 'uiTreeName' | 'baselineUiTreeName' | 'uiTreeOptions'>
  ): Promise<ComparisonInputs> {
    const empty: ComparisonInputs = {
      ignoreAreas: [],
      toleranceAreas: [],
      moves: [],
      systemBars: [],
      rules: { ignore: [], tolerate: [], matches: {} },
      settings: null,
    };
    if (!testRun.uiTreeName) return empty;
    const [tree, baselineTree, project, variation] = await Promise.all([
      this.load(testRun.uiTreeName),
      this.load(testRun.baselineUiTreeName),
      testRun.projectId ? this.prismaService.project.findUnique({ where: { id: testRun.projectId } }) : null,
      testRun.testVariationId
        ? this.prismaService.testVariation.findUnique({ where: { id: testRun.testVariationId } })
        : null,
    ]);
    if (!tree) return empty;

    const settings = parseUiTreeSettings(project?.uiTreeSettings);
    const options = parseUiTreeOptions(testRun.uiTreeOptions);
    const excludeSystemBars = options.excludeSystemBars ?? settings.excludeSystemBars;
    const rules = [...settings.elementRules, ...parseJsonArray<ElementRule>(variation?.elementRules)];
    const resolved = resolveRules(rules, [tree, baselineTree]);
    const systemBars = excludeSystemBars ? findSystemBars(tree) : [];
    const clamp = (rect: Rect): Rect => {
      const x = Math.max(0, Math.round(rect.x));
      const y = Math.max(0, Math.round(rect.y));
      return {
        x,
        y,
        width: Math.max(0, Math.min(tree.width, Math.round(rect.x + rect.width)) - x),
        height: Math.max(0, Math.min(tree.height, Math.round(rect.y + rect.height)) - y),
      };
    };
    return {
      ignoreAreas: [...systemBars, ...resolved.ignore].map(clamp).filter((r) => r.width && r.height),
      toleranceAreas: resolved.tolerate.map((area) => ({ ...clamp(area), maxDiffPercent: area.maxDiffPercent })),
      moves: settings.compensateMoves && baselineTree ? computeMoves(baselineTree, tree, settings.maxMoveDp) : [],
      systemBars,
      rules: resolved,
      settings,
    };
  }

  async deleteFiles(...names: Array<string | null | undefined>): Promise<void> {
    await Promise.all(names.filter(Boolean).map((name) => this.staticService.deleteFile(name)));
  }
}
