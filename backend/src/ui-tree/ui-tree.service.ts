import { Injectable, Logger } from '@nestjs/common';
import { TestRun, TestVariation } from '@prisma/client';
import { gunzipSync, gzipSync } from 'zlib';
import { StaticService } from '../static/static.service';
import { buildReport, findViolations } from '../a11y/a11y.rules';
import { screenTitle } from '../a11y/a11y-problems';
import { A11yReport, RgbaImage } from '../a11y/a11y.types';
import { describeNode, ownSpeakableText, parseUiTree } from './ui-tree.parser';
import { Rect, UiNode, UiTree, UiTreeFormat } from './ui-tree.types';
import { diffTrees, elementsUnderRegions, RegionElement, StructuralChange } from './structure-diff';
import { findNoiseHints, NoiseHint } from './noise-hints';
import { compareAcrossDevices, CrossDeviceReport } from './cross-device';
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
import { CompareOnlyPlan, insideCompared, planCompareOnly } from './compare-only';
import { elementForArea } from './area-elements';
import {
  checkKey,
  computeMoves,
  DeviceProfile,
  sameDevice,
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
// how many other checks' baselines a wrong screen is matched against
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
  // only some elements are compared (spec 015); inactive otherwise
  compareOnly: CompareOnlyPlan;
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
  rules: Array<
    ElementRule & {
      scope: 'screen' | 'project';
      matches: number;
      // what the rule matched on each screenshot, for drawing it there
      found: { current: Rect[]; baseline: Rect[] };
    }
  >;
  // what is compared when the check names its elements, and what the pixels cannot vouch for
  compareOnly: Pick<CompareOnlyPlan, 'active' | 'keep' | 'problems'>;
  ignoredAreas: Rect[];
  toleratedAreas: Array<Rect & { maxDiffPercent: number }>;
  systemBars: Rect[];
  // compensated moves, in dp
  moves: Array<{ key: string; element: string; dxDp: number; dyDp: number }>;
  // elements a rule can be made for by clicking them on the screenshot
  elements: PickableElement[];
  baselineElements: PickableElement[];
  // saved ignore areas that stand for one element (REQ-024-50)
  areaSuggestions: Array<{ areaId: string; selector: string; element: string }>;
  settings: UiTreeSettings;
}

export type CrossDeviceResult =
  | { status: 'no-tree' | 'no-reference' }
  | { status: 'is-reference' | 'no-reference-tree' | 'other-platform'; referenceDevice: string }
  | {
      status: 'compared';
      referenceDevice: string;
      referenceSource: 'run' | 'baseline';
      referenceTestRunId: string | null;
      report: CrossDeviceReport;
    };

/** "Pixel 7 · Android 15", from whichever parts are set. */
export function describeDevice(profile: Partial<DeviceProfile>): string {
  return [profile.device, profile.os, profile.browser, profile.viewport].filter(Boolean).join(' · ') || 'no device';
}

export interface PickableElement {
  // the node's index in its tree, and the nearest pickable element around it
  index: number;
  parent: number | null;
  selector: string;
  element: string;
  bounds: Rect;
}

// an element covering nearly the whole screen is a container, not something to pick
const MAX_PICKABLE_SCREEN_SHARE = 0.9;

/** How a rule finds this element: its own id, else its text or label. */
export function selectorForNode(node: UiNode): string | null {
  if (node.resourceId && !node.resourceId.startsWith('android:id/')) {
    return `id:${node.resourceId.replace(/^.*:id\//, '')}`;
  }
  const text = ownSpeakableText(node);
  // a text in slashes would read as a regular expression
  return text && !/^\/.*\/$/.test(text) ? `text:${text}` : null;
}

/** Visible elements with a selector, for picking on the screenshot. */
export function pickableElements(tree: UiTree): PickableElement[] {
  const screen = tree.width * tree.height;
  const selectors = tree.nodes.map((node) => {
    const area = node.bounds.width * node.bounds.height;
    return node.visible && area > 0 && area / screen <= MAX_PICKABLE_SCREEN_SHARE ? selectorForNode(node) : null;
  });
  const pickableParent = (index: number): number | null => {
    let parent = tree.nodes[index].parent;
    while (parent !== null && !selectors[parent]) parent = tree.nodes[parent].parent;
    return parent;
  };
  return tree.nodes.flatMap((node, i) =>
    selectors[i]
      ? [
          {
            index: node.index,
            parent: pickableParent(i),
            selector: selectors[i],
            element: describeNode(node),
            bounds: node.bounds,
          },
        ]
      : []
  );
}

/** Width and height from a PNG's IHDR chunk, without decoding the image. */
export function pngSize(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Element changes outside the ignored areas (element rules, system bars). */
export function outsideAreas(changes: StructuralChange[], areas: Rect[]): StructuralChange[] {
  const inside = (outer: Rect, inner: Rect) =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
  return changes.filter((change) => !areas.some((area) => inside(area, change.bounds)));
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
    // A device without its own baseline yet is still a run of a known check:
    // accessibility issues and "is this the right screen" are judged against
    // the check's baseline on another device. Pixel and element diffs are not.
    const other = baselineTree ? null : await this.otherDeviceBaseline(testRun, project, settings);
    const [otherTree, otherImage] = other
      ? await Promise.all([this.load(other.baselineUiTreeName), this.decode(other.baselineName)])
      : [null, undefined];
    const checkTree = baselineTree ?? otherTree;

    const current = findViolations(tree, image);
    const baseline = checkTree ? findViolations(checkTree, baselineTree ? baselineImage : otherImage) : null;
    const report = {
      ...buildReport(tree, current, baseline),
      // problems that are not a component's are told apart by screen
      screenTitle: screenTitle(tree, settings.screenTitle),
      screenSelectors: settings.screenTitle,
    };
    const reportName = await this.staticService.saveFile(
      'a11y',
      Buffer.from(JSON.stringify(report)),
      'json',
      'application/json'
    );

    const regions = parseRegions(testRun.diffRegions);
    const inputs = await this.comparisonInputs(testRun);
    const changes = baselineTree
      ? insideCompared(outsideAreas(diffTrees(baselineTree, tree), inputs.ignoreAreas), inputs.compareOnly)
      : [];
    const clickable = new Set(
      [...tree.nodes, ...(baselineTree?.nodes ?? [])].filter((node) => node.clickable).map((node) => node.key)
    );
    const invisible =
      settings.detectSemanticChanges && baselineTree ? invisibleChanges(changes, regions, clickable) : [];

    const warnings: CaptureWarning[] = [];
    const loading = settings.detectLoading ? detectLoading(tree) : null;
    if (loading) warnings.push(loading);
    if (settings.detectScreenMismatch) {
      warnings.push(
        ...(await this.screenWarnings(
          testRun,
          tree,
          checkTree,
          baselineTree ? null : other ? describeDevice(other) : null
        ))
      );
    }

    const components = image
      ? componentChanges({ tree, baselineTree, image, baselineImage: baselineImage ?? null, regions, changes })
      : [];
    return { reportName, report, warnings, invisible, components };
  }

  /**
   * What a re-comparison (new rule, ignore area) changes in the tree analysis:
   * the changed components and the changes the pixels do not show, both
   * against the run's new diff regions.
   */
  async recheck(testRun: TestRun): Promise<{ components: ComponentChange[]; invisible: StructuralChange[] }> {
    const [tree, baselineTree, image, baselineImage, project] = await Promise.all([
      this.load(testRun.uiTreeName),
      this.load(testRun.baselineUiTreeName),
      this.decode(testRun.imageName),
      this.decode(testRun.baselineName),
      testRun.projectId ? this.prismaService.project.findUnique({ where: { id: testRun.projectId } }) : null,
    ]);
    if (!tree) return { components: [], invisible: [] };
    const settings = parseUiTreeSettings(project?.uiTreeSettings);
    const regions = parseRegions(testRun.diffRegions);
    const inputs = await this.comparisonInputs(testRun);
    const changes = baselineTree
      ? insideCompared(outsideAreas(diffTrees(baselineTree, tree), inputs.ignoreAreas), inputs.compareOnly)
      : [];
    const clickable = new Set(
      [...tree.nodes, ...(baselineTree?.nodes ?? [])].filter((node) => node.clickable).map((node) => node.key)
    );
    return {
      components: image
        ? componentChanges({ tree, baselineTree, image, baselineImage: baselineImage ?? null, regions, changes })
        : [],
      invisible: settings.detectSemanticChanges && baselineTree ? invisibleChanges(changes, regions, clickable) : [],
    };
  }

  /**
   * Warns when the tree does not look like the check's baseline: the test
   * opened another screen. A run without any baseline gets no warning — a new
   * check is often a state of an existing screen (a bottom sheet over it), so
   * "looks like another screen" would be noise.
   */
  private async screenWarnings(
    testRun: TestRun,
    tree: UiTree,
    baselineTree: UiTree | null,
    otherDevice: string | null
  ): Promise<CaptureWarning[]> {
    if (!baselineTree) return [];
    const similarity = screenSimilarity(tree, baselineTree);
    if (similarity >= MISMATCH_BELOW) return [];
    const percent = (value: number) => `${Math.round(value * 100)}%`;

    // which known check it looks like instead, to say where the test ended up
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
    const looksLike = best && best.similarity >= SAME_SCREEN_ABOVE ? best : null;
    const hint = looksLike ? ` It looks like "${looksLike.name}" (${percent(looksLike.similarity)}).` : '';
    return [
      {
        kind: 'screen-mismatch',
        message:
          (otherDevice
            ? `This does not look like this check on ${otherDevice} (${percent(similarity)} alike).`
            : `This does not look like the screen of its baseline (${percent(similarity)} alike).`) + hint,
        similarity,
        ...(looksLike ? { looksLike: looksLike.name } : {}),
      },
    ];
  }

  /**
   * The check's baseline on another device, for a device that has none yet:
   * the reference device first, then the most recently updated one, on the
   * run's branch before the main branch.
   */
  private async otherDeviceBaseline(
    testRun: TestRun,
    project: { mainBranchName: string } | null,
    settings: UiTreeSettings
  ): Promise<TestVariation | null> {
    if (!testRun.projectId) return null;
    const candidates = await this.prismaService.testVariation.findMany({
      where: {
        projectId: testRun.projectId,
        name: testRun.name,
        customTags: testRun.customTags ?? '',
        branchName: { in: [testRun.branchName, project?.mainBranchName].filter(Boolean) },
        baselineUiTreeName: { not: null },
        id: { not: testRun.testVariationId ?? undefined },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const rank = (variation: TestVariation) =>
      (settings.referenceDevice && sameDevice(variation, settings.referenceDevice) ? 0 : 2) +
      (variation.branchName === testRun.branchName ? 0 : 1);
    return candidates.sort((a, b) => rank(a) - rank(b))[0] ?? null;
  }

  async loadReport(name: string | null): Promise<A11yReport | null> {
    if (!name) return null;
    const buffer = await this.staticService.getFileBuffer(name);
    return buffer ? (JSON.parse(buffer.toString('utf8')) as A11yReport) : null;
  }

  /** What changed in a run, by element, plus noise hints. Computed on demand. */
  async structure(testRun: TestRun): Promise<StructureInfo> {
    const [tree, baselineTree, imageBuffer, inputs, project] = await Promise.all([
      this.load(testRun.uiTreeName),
      this.load(testRun.baselineUiTreeName),
      this.staticService.getImageBuffer(testRun.imageName),
      this.comparisonInputs(testRun),
      testRun.projectId ? this.prismaService.project.findUnique({ where: { id: testRun.projectId } }) : null,
    ]);
    const regions = parseRegions(testRun.diffRegions);
    const size = imageBuffer ? pngSize(imageBuffer) : { width: tree?.width ?? 0, height: tree?.height ?? 0 };
    const changes =
      tree && baselineTree
        ? insideCompared(outsideAreas(diffTrees(baselineTree, tree), inputs.ignoreAreas), inputs.compareOnly)
        : [];
    const clickable = new Set(
      [...(tree?.nodes ?? []), ...(baselineTree?.nodes ?? [])].filter((n) => n.clickable).map((n) => n.key)
    );
    const settings = parseUiTreeSettings(project?.uiTreeSettings);
    const checkRules = await this.checkRules(testRun, settings);
    const withScope = (rules: ElementRule[], scope: 'screen' | 'project') =>
      rules.map((rule) => ({
        ...rule,
        scope,
        matches: inputs.rules.matches[rule.id] ?? 0,
        found: inputs.rules.found[rule.id] ?? { current: [], baseline: [] },
      }));
    const elements = tree ? pickableElements(tree) : [];
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
      }).map((hint) => {
        // a rule for the element follows it when the layout moves; the area does not
        const element = hint.ignoreArea && elementForArea(hint.ignoreArea, elements);
        return element ? { ...hint, element: { selector: element.selector, element: element.element } } : hint;
      }),
      invisible: tree && baselineTree ? invisibleChanges(changes, regions, clickable) : [],
      warnings: parseJsonArray<CaptureWarning>(testRun.captureWarnings),
      rules: [...withScope(checkRules, 'screen'), ...withScope(settings.elementRules, 'project')],
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
      compareOnly: {
        active: inputs.compareOnly.active,
        keep: inputs.compareOnly.keep,
        problems: inputs.compareOnly.problems,
      },
      elements,
      baselineElements: baselineTree ? pickableElements(baselineTree) : [],
      areaSuggestions: parseJsonArray<Rect & { id: string }>(testRun.ignoreAreas).flatMap((area) => {
        const element = area.id ? elementForArea(area, elements) : null;
        return element ? [{ areaId: String(area.id), selector: element.selector, element: element.element }] : [];
      }),
      settings,
    };
  }

  /**
   * Rules for one check, on every device and branch: the ones kept by check
   * name, plus rules an earlier version stored on single device variations.
   */
  async checkRules(
    check: { projectId: string; name: string; customTags?: string | null },
    settings: UiTreeSettings
  ): Promise<ElementRule[]> {
    const legacy = check.projectId
      ? await this.prismaService.testVariation.findMany({
          where: {
            projectId: check.projectId,
            name: check.name,
            customTags: check.customTags ?? '',
            elementRules: { not: null },
          },
          select: { elementRules: true },
        })
      : [];
    const all = [
      ...(settings.checkRules[checkKey(check)] ?? []),
      ...legacy.flatMap((variation) => parseJsonArray<ElementRule>(variation.elementRules)),
    ];
    return all.filter((rule, index) => all.findIndex((other) => other.id === rule.id) === index);
  }

  /**
   * What the UI trees add to a comparison: ignore areas from element rules and
   * system bars, tolerance areas, and the moves to compensate. Empty when the
   * run has no UI tree.
   */
  async comparisonInputs(
    testRun: Pick<
      TestRun,
      'projectId' | 'testVariationId' | 'uiTreeName' | 'baselineUiTreeName' | 'uiTreeOptions' | 'name' | 'customTags'
    >
  ): Promise<ComparisonInputs> {
    const empty: ComparisonInputs = {
      ignoreAreas: [],
      toleranceAreas: [],
      moves: [],
      systemBars: [],
      rules: { ignore: [], tolerate: [], matches: {}, found: {} },
      settings: null,
      compareOnly: planCompareOnly([], null, null),
    };
    const [tree, baselineTree, project] = await Promise.all([
      this.load(testRun.uiTreeName),
      this.load(testRun.baselineUiTreeName),
      testRun.projectId ? this.prismaService.project.findUnique({ where: { id: testRun.projectId } }) : null,
    ]);
    const settings = parseUiTreeSettings(project?.uiTreeSettings);
    const checkRules = testRun.projectId
      ? await this.checkRules(
          { projectId: testRun.projectId, name: testRun.name, customTags: testRun.customTags },
          settings
        )
      : [];
    if (!tree) {
      // a check that names its elements cannot be compared without a tree: it goes to review (REQ-015-22)
      return { ...empty, compareOnly: planCompareOnly(checkRules, null, null) };
    }

    const options = parseUiTreeOptions(testRun.uiTreeOptions);
    const excludeSystemBars = options.excludeSystemBars ?? settings.excludeSystemBars;
    const rules = [...settings.elementRules, ...checkRules];
    const resolved = resolveRules(rules, [tree, baselineTree]);
    const compareOnly = planCompareOnly(checkRules, baselineTree, tree);
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
    const compensated =
      settings.compensateMoves && baselineTree ? computeMoves(baselineTree, tree, settings.maxMoveDp) : [];
    return {
      ignoreAreas: [
        ...[...systemBars, ...resolved.ignore].map(clamp).filter((r) => r.width && r.height),
        ...compareOnly.ignoreOutside,
      ],
      toleranceAreas: resolved.tolerate.map((area) => ({ ...clamp(area), maxDiffPercent: area.maxDiffPercent })),
      // a compared element is aligned with itself whether or not moves are compensated
      moves: [...compensated, ...compareOnly.moves],
      systemBars,
      rules: resolved,
      settings,
      compareOnly,
    };
  }

  /**
   * The same check on the project's reference device, compared element by
   * element, for information: it never changes a run's status. The reference
   * is that device's run in the same build when there is one (same app
   * build), else its baseline.
   */
  async crossDevice(testRun: TestRun): Promise<CrossDeviceResult> {
    if (!testRun.uiTreeName) return { status: 'no-tree' };
    const project = testRun.projectId
      ? await this.prismaService.project.findUnique({ where: { id: testRun.projectId } })
      : null;
    const reference = parseUiTreeSettings(project?.uiTreeSettings).referenceDevice;
    if (!reference) return { status: 'no-reference' };
    const referenceDevice = describeDevice(reference);
    if (sameDevice(testRun, reference)) return { status: 'is-reference', referenceDevice };

    const sameCheck = {
      projectId: testRun.projectId,
      name: testRun.name,
      customTags: testRun.customTags ?? '',
      os: reference.os,
      device: reference.device,
      browser: reference.browser,
      viewport: reference.viewport,
    };
    const referenceRun = await this.prismaService.testRun.findFirst({
      where: { ...sameCheck, buildId: testRun.buildId, uiTreeName: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    let referenceTreeName = referenceRun?.uiTreeName ?? null;
    let referenceSource: 'run' | 'baseline' = 'run';
    if (!referenceTreeName) {
      const variations = await this.prismaService.testVariation.findMany({
        where: {
          ...sameCheck,
          branchName: { in: [testRun.branchName, project?.mainBranchName].filter(Boolean) },
          baselineUiTreeName: { not: null },
        },
      });
      const variation =
        variations.find((item) => item.branchName === testRun.branchName) ??
        variations.find((item) => item.branchName === project?.mainBranchName);
      referenceTreeName = variation?.baselineUiTreeName ?? null;
      referenceSource = 'baseline';
    }
    const [tree, referenceTree] = await Promise.all([this.load(testRun.uiTreeName), this.load(referenceTreeName)]);
    if (!tree || !referenceTree) return { status: 'no-reference-tree', referenceDevice };
    if (tree.format !== referenceTree.format) return { status: 'other-platform', referenceDevice };
    return {
      status: 'compared',
      referenceDevice,
      referenceSource,
      referenceTestRunId: referenceSource === 'run' ? referenceRun.id : null,
      report: compareAcrossDevices(referenceTree, tree),
    };
  }

  /**
   * Keeps what the reference comparison showed, and the reviewer's decision
   * when there is one, so it can be judged later how far it can be trusted.
   */
  async recordCrossDevice(testRun: TestRun, decision?: 'approved' | 'rejected'): Promise<CrossDeviceResult> {
    const result = await this.crossDevice(testRun);
    if (result.status !== 'compared') return result;
    const data = {
      referenceSource: result.referenceSource,
      referenceTestRunId: result.referenceTestRunId,
      referenceDevice: result.referenceDevice,
      comparedCount: result.report.compared,
      differenceCount: result.report.truncated?.differences ?? result.report.differences.length,
      notFoundCount: result.report.truncated?.notFound ?? result.report.notFound.length,
      onlyHereCount: result.report.onlyHere,
      report: JSON.stringify(result.report),
      ...(decision ? { decision, decidedAt: new Date() } : {}),
    };
    await this.prismaService.crossDeviceCheck.upsert({
      where: { testRunId: testRun.id },
      create: { testRunId: testRun.id, ...data },
      update: data,
    });
    return result;
  }

  async deleteFiles(...names: Array<string | null | undefined>): Promise<void> {
    await Promise.all(names.filter(Boolean).map((name) => this.staticService.deleteFile(name)));
  }
}
