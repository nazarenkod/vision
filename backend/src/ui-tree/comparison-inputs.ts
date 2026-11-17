import { Rect, UiNode, UiTree } from './ui-tree.types';
import { A11yNorms, DEFAULT_A11Y_NORMS, parseA11yNorms } from '../a11y/a11y-norms';
import { AllowedDevice, parseAllowedDevices } from '../projects/allowed-devices';
import { AllowedBrowser, parseAllowedBrowsers } from '../projects/allowed-browsers';
import { evaluateXpath, isXpathSelector, parseXpath, XPATH_PREFIX, XpathProblem, xpathProblem } from './xpath-selector';
import { checkVariableText, fitsSkeleton, TextPart, unrunnablePattern, VariableTextReason } from './variable-text';
import { compileLinear, isLinearRegex, LinearRegex } from './linear-regex';

// compare: only the elements the check's compare rules match are compared (spec 015)
// variable: pixels left out, the text checked against parts with patterns (spec 033)
export type ElementRuleAction = 'ignore' | 'tolerate' | 'compare' | 'variable';

/**
 * A rule about elements, kept on the project (every screen) or on one screen.
 * selector:
 *   id:btn_pay        resource id (Android, with or without "package:id/") or iOS accessibility identifier
 *   class:ImageView   class name or its last segment; XCUIElementType prefix optional
 *   text:12:30        exact text or label; text:/\d+:\d+/ for a regular expression
 *   xpath://*[@resource-id='app:id/list']/android.view.ViewGroup[1]
 *                     a path down or up from a stable element, for elements with no name (spec 027)
 */
export interface ElementRule {
  id: string;
  selector: string;
  action: ElementRuleAction;
  // tolerate: changes covering at most this share of the element's pixels are not counted
  maxDiffPercent?: number;
  // variable: the text as fixed parts and places with a pattern
  parts?: TextPart[];
  note?: string;
}

export interface UiTreeSettings {
  // leave the status and navigation bars out of the comparison
  excludeSystemBars: boolean;
  // compare moved elements at their new place, so a shift alone is not a difference
  compensateMoves: boolean;
  // only moves up to this distance are compensated; null for any distance
  maxMoveDp: number | null;
  // a changed label, state or an invisible control sends the screenshot to review
  detectSemanticChanges: boolean;
  // rules for every screen of the project
  elementRules: ElementRule[];
  // rules for one check (its name and custom tags), on every device and branch
  checkRules: Record<string, ElementRule[]>;
  // where the screen's title is in the UI tree, first match wins (id:Appbar#Title);
  // no longer in the settings page (026), selectors saved before keep working
  screenTitle: string[];
  // what the team agreed an accessible screen is: tap area, contrast, rules on (026)
  a11yNorms: A11yNorms;
  // devices SDK snapshots may come from; empty for any (029)
  allowedDevices: AllowedDevice[];
  // what the project tests: decides which settings are shown, never how a tree is read (050)
  platform: ProjectPlatform;
  // browsers web snapshots may come from; empty for any (REQ-050-45, REQ-050-51)
  allowedBrowsers: AllowedBrowser[];
}

export type ProjectPlatform = 'mobile' | 'web' | 'both';
export const PROJECT_PLATFORMS: ProjectPlatform[] = ['mobile', 'web', 'both'];

/** A check is what the test named: its name plus custom tags. Devices are runs of it. */
export function checkKey(check: { name: string; customTags?: string | null }): string {
  return JSON.stringify([check.name, check.customTags ?? '']);
}

export const DEFAULT_UI_TREE_SETTINGS: UiTreeSettings = {
  excludeSystemBars: true,
  compensateMoves: false,
  maxMoveDp: null,
  detectSemanticChanges: true,
  elementRules: [],
  checkRules: {},
  screenTitle: ['id:Appbar#Title'],
  a11yNorms: DEFAULT_A11Y_NORMS,
  allowedDevices: [],
  // projects saved before platforms tested phones (REQ-050-41)
  platform: 'mobile',
  allowedBrowsers: [],
};

export function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseUiTreeSettings(value: string | null | undefined): UiTreeSettings {
  if (!value) return { ...DEFAULT_UI_TREE_SETTINGS };
  try {
    const parsed = JSON.parse(value) ?? {};
    return {
      ...DEFAULT_UI_TREE_SETTINGS,
      ...parsed,
      elementRules: Array.isArray(parsed.elementRules) ? parsed.elementRules : [],
      checkRules:
        parsed.checkRules && typeof parsed.checkRules === 'object' && !Array.isArray(parsed.checkRules)
          ? parsed.checkRules
          : {},
      screenTitle:
        Array.isArray(parsed.screenTitle) && parsed.screenTitle.length
          ? parsed.screenTitle.filter((item: unknown) => typeof item === 'string' && item.trim())
          : DEFAULT_UI_TREE_SETTINGS.screenTitle,
      a11yNorms: parseA11yNorms(parsed.a11yNorms),
      allowedDevices: parseAllowedDevices(parsed.allowedDevices),
      platform: PROJECT_PLATFORMS.includes(parsed.platform) ? parsed.platform : DEFAULT_UI_TREE_SETTINGS.platform,
      allowedBrowsers: parseAllowedBrowsers(parsed.allowedBrowsers),
    };
  } catch {
    return { ...DEFAULT_UI_TREE_SETTINGS };
  }
}

type Selector =
  { by: 'id'; value: string } | { by: 'class'; value: string } | { by: 'text'; value: string | LinearRegex };

export function parseSelector(selector: string): Selector | null {
  const match = /^(id|class|text):(.+)$/s.exec(selector.trim());
  if (!match) return null;
  const [, by, raw] = match;
  if (by === 'text') {
    const regex = /^\/(.+)\/([a-z]*)$/.exec(raw);
    if (regex) {
      // u lets a pattern name letters of any alphabet (\p{L}), as variable texts do (spec 033);
      // the engine runs in linear time whatever the pattern (051)
      const flags = ['i', 'u'].filter((flag) => regex[2].includes(flag)).join('');
      const pattern = compileLinear(regex[1], flags);
      return isLinearRegex(pattern) ? { by: 'text', value: pattern } : null;
    }
    return { by: 'text', value: raw };
  }
  return { by: by as 'id' | 'class', value: raw.trim() };
}

const shortClass = (className: string) => className.split('.').pop().replace('XCUIElementType', '');

export function matchesSelector(node: UiNode, selector: Selector): boolean {
  switch (selector.by) {
    case 'id': {
      const id = node.resourceId;
      if (!id) return false;
      const value = selector.value.replace(/^.*:id\//, '').replace(/^id\//, '');
      return id === selector.value || id.endsWith(`:id/${value}`) || id === value;
    }
    case 'class':
      return node.className === selector.value || shortClass(node.className) === shortClass(selector.value);
    case 'text': {
      const text = (node.text || node.label).trim();
      if (!text) return false;
      return typeof selector.value === 'string' ? text === selector.value : selector.value.test(text);
    }
  }
}

const shown = (node: UiNode) => node.visible && !!node.bounds.width && !!node.bounds.height;

/**
 * The visible elements a rule's selector takes on a tree, in tree order, or
 * null when the selector cannot be read.
 */
export function findBySelector(tree: UiTree, selector: string): UiNode[] | null {
  if (isXpathSelector(selector)) {
    const parsed = parseXpath(selector.trim().slice(XPATH_PREFIX.length));
    return parsed.ok ? evaluateXpath(tree, parsed.xpath).filter(shown) : null;
  }
  const parsed = parseSelector(selector);
  return parsed ? tree.nodes.filter((node) => shown(node) && matchesSelector(node, parsed)) : null;
}

/**
 * The elements a rule takes on a tree. A variable-text rule by id takes only
 * those whose text keeps the rule's fixed text: the rows of a list share the
 * id, and a row of another kind is not the one the rule was made on (REQ-069-01).
 */
export function ruleNodes(tree: UiTree, rule: Pick<ElementRule, 'selector' | 'action' | 'parts'>): UiNode[] {
  const nodes = findBySelector(tree, rule.selector) ?? [];
  if (rule.action !== 'variable' || !rule.parts?.length || !rule.selector.trim().startsWith('id:')) return nodes;
  return nodes.filter((node) => fitsSkeleton(rule.parts, textOf(node)));
}

/** A text:/…/ pattern Vision does not run: back-references and look-around (REQ-051-10). */
function textPatternProblem(selector: string): boolean {
  const regex = /^text:\/(.+)\/([a-z]*)$/s.exec(selector.trim());
  if (!regex) return false;
  const flags = ['i', 'u'].filter((flag) => regex[2].includes(flag)).join('');
  const problem = compileLinear(regex[1], flags);
  return problem === 'backreference' || problem === 'lookaround' || problem === 'unsupported';
}

/** Whether a stored rule holds a pattern Vision does not run, in its selector or its parts (051). */
export function rulePatternProblem(rule: Pick<ElementRule, 'selector' | 'parts'>): boolean {
  return (
    textPatternProblem(rule.selector) ||
    (rule.parts ?? []).some((part) => 'pattern' in part && unrunnablePattern(part.pattern))
  );
}

// a rule's selector is kept to this length (REQ-061-04): a pattern typed in is short (051)
export const MAX_SELECTOR_LENGTH = 300;

/**
 * Why a selector cannot be saved: no known prefix, what its XPath may not do (REQ-027-31), or
 * a pattern Vision does not run (REQ-051-10).
 */
export function selectorProblem(selector: string): 'prefix' | 'pattern' | XpathProblem | null {
  if (isXpathSelector(selector)) return xpathProblem(selector);
  if (textPatternProblem(selector)) return 'pattern';
  return parseSelector(selector) ? null : 'prefix';
}

// Anti-aliased edges around an element differ by a pixel or two when it is redrawn.
const RULE_PADDING_PX = 2;

const pad = (rect: Rect, padding: number): Rect => ({
  x: rect.x - padding,
  y: rect.y - padding,
  width: rect.width + 2 * padding,
  height: rect.height + 2 * padding,
});

/** What a variable-text rule found on the snapshot and whether each text holds (spec 033). */
export interface VariableCheck {
  items: Array<{ text: string; ok: boolean; reason?: VariableTextReason; bounds: Rect; element: string }>;
  // found in the baseline, nowhere in the snapshot's tree (REQ-033-19)
  gone: boolean;
  // found, but an ignore rule takes every element it found (REQ-033-22)
  overridden: boolean;
}

/**
 * What a variable-text rule leaves out of the comparison for one element it
 * found, on one side (spec 066): the element's text parts, or the element
 * itself when the tree cannot tell where its text is drawn.
 */
export interface LeftOut {
  side: 'current' | 'baseline';
  // the element the rule found
  element: Rect;
  // what is not compared
  areas: Rect[];
  // set when the whole element is left out: its text is its own, its size changed,
  // or it has no counterpart on the other screenshot (REQ-066-03, 06)
  reason?: 'own-text' | 'resized' | 'unpaired';
}

export interface ResolvedRules {
  ignore: Rect[];
  tolerate: Array<Rect & { maxDiffPercent: number }>;
  // how many elements each rule matched, for the UI
  matches: Record<string, number>;
  // per rule, what it matched on each side, for drawing it on both screenshots
  found: Record<string, { current: Rect[]; baseline: Rect[] }>;
  // per variable-text rule, how its texts on the snapshot fared
  variable: Record<string, VariableCheck>;
  // per variable-text rule, what of each element it found is not compared (spec 066)
  leftOut: Record<string, LeftOut[]>;
  // elements variable-text rules found: their own changes are not changes (REQ-033-16, REQ-066-04)
  quietKeys: string[];
}

const textOf = (node: UiNode) => node.text || node.label;

/**
 * The text drawn on the screen: an Android content-desc or a web aria-label is
 * not drawn, so an icon's label is no text part (REQ-066-01); iOS gives the
 * drawn text as the label, which an image's label is not.
 */
export function shownText(tree: UiTree, node: UiNode): string {
  if (node.text) return node.text;
  return tree.format === 'appium-ios' && !/Image$|Icon$/.test(node.className) ? node.label : '';
}

const childrenByTree = new WeakMap<UiTree, Map<number, UiNode[]>>();
function childrenOf(tree: UiTree, node: UiNode): UiNode[] {
  let children = childrenByTree.get(tree);
  if (!children) {
    children = new Map();
    for (const item of tree.nodes) {
      if (item.parent === null) continue;
      const list = children.get(item.parent) ?? [];
      list.push(item);
      children.set(item.parent, list);
    }
    childrenByTree.set(tree, children);
  }
  return children.get(node.index) ?? [];
}

/**
 * The descendants of an element whose text passes the rule's check (REQ-066-01):
 * where the checked text is drawn when the element is a button or a tile around it.
 * The element itself is not one: a text of its own has no bounds of its own.
 */
export function textParts(tree: UiTree, node: UiNode, parts: TextPart[]): UiNode[] {
  const found: UiNode[] = [];
  const queue = [...childrenOf(tree, node)];
  while (queue.length) {
    const item = queue.shift();
    const text = shownText(tree, item);
    if (shown(item) && text.trim() && checkVariableText(parts, text).ok) found.push(item);
    queue.push(...childrenOf(tree, item));
  }
  return found;
}

/**
 * What of each element a variable-text rule found is left out, on both sides
 * (REQ-066-02, 03): only its text parts when the same element is on both
 * screenshots, keeps its size and has text parts on both; else all of it.
 */
export function leftOutOf(
  parts: TextPart[] | undefined,
  current: { tree: UiTree | null; nodes: UiNode[] },
  baseline: { tree: UiTree | null; nodes: UiNode[] }
): LeftOut[] {
  const result: LeftOut[] = [];
  const paired = new Set<UiNode>();
  const whole = (side: LeftOut['side'], node: UiNode, reason: LeftOut['reason']): LeftOut => ({
    side,
    element: node.bounds,
    areas: [node.bounds],
    reason,
  });
  for (const node of current.nodes) {
    const was = baseline.nodes.find((item) => item.key === node.key && !paired.has(item));
    if (!was) {
      result.push(whole('current', node, 'unpaired'));
      continue;
    }
    paired.add(was);
    const nowParts = parts?.length && current.tree ? textParts(current.tree, node, parts) : [];
    const wasParts = parts?.length && baseline.tree ? textParts(baseline.tree, was, parts) : [];
    const sameSize = node.bounds.width === was.bounds.width && node.bounds.height === was.bounds.height;
    const reason = !sameSize ? 'resized' : !nowParts.length || !wasParts.length ? 'own-text' : undefined;
    if (reason) {
      result.push(whole('current', node, reason), whole('baseline', was, reason));
    } else {
      result.push(
        { side: 'current', element: node.bounds, areas: nowParts.map((item) => item.bounds) },
        { side: 'baseline', element: was.bounds, areas: wasParts.map((item) => item.bounds) }
      );
    }
  }
  for (const node of baseline.nodes) {
    if (!paired.has(node)) result.push(whole('baseline', node, 'unpaired'));
  }
  return result;
}

/**
 * Areas the rules cover, taken from both trees (current first, then the
 * baseline): an element that moved is covered where it was and where it is.
 * Compare-only rules cover nothing here; planCompareOnly works them out.
 * A variable text is covered like an ignored element and its text checked
 * instead, unless an ignore rule takes the same element (REQ-033-22).
 */
export function resolveRules(rules: ElementRule[], trees: Array<UiTree | null>): ResolvedRules {
  const result: ResolvedRules = {
    ignore: [],
    tolerate: [],
    matches: {},
    found: {},
    variable: {},
    leftOut: {},
    quietKeys: [],
  };
  const current = trees[0] ?? null;
  const ignored = new Set<UiNode>();
  for (const rule of rules) {
    if (rule.action === 'ignore' && current && !selectorProblem(rule.selector)) {
      findBySelector(current, rule.selector).forEach((node) => ignored.add(node));
    }
  }
  for (const rule of rules) {
    if (selectorProblem(rule.selector)) continue;
    const sides: Rect[][] = [];
    const sideNodes: UiNode[][] = [];
    for (const tree of trees) {
      const bounds: Rect[] = [];
      const nodes = tree ? ruleNodes(tree, rule) : [];
      sideNodes.push(nodes);
      for (const node of nodes) {
        bounds.push(node.bounds);
        if (rule.action === 'ignore') {
          result.ignore.push(pad(node.bounds, RULE_PADDING_PX));
        } else if (rule.action === 'tolerate') {
          result.tolerate.push({ ...node.bounds, maxDiffPercent: rule.maxDiffPercent ?? 5 });
        }
      }
      sides.push(bounds);
    }
    if (rule.action === 'variable') {
      const leftOut = leftOutOf(
        rule.parts,
        { tree: trees[0] ?? null, nodes: sideNodes[0] ?? [] },
        { tree: trees[1] ?? null, nodes: sideNodes[1] ?? [] }
      );
      result.leftOut[rule.id] = leftOut;
      result.ignore.push(...leftOut.flatMap((item) => item.areas.map((area) => pad(area, RULE_PADDING_PX))));
      result.quietKeys.push(...sideNodes.flat().map((node) => node.key));
    }
    // the same element is usually in both trees, so the count is the larger of the two
    result.matches[rule.id] = Math.max(0, ...sides.map((bounds) => bounds.length));
    result.found[rule.id] = { current: sides[0] ?? [], baseline: sides[1] ?? [] };
    if (rule.action === 'variable' && rule.parts?.length && current) {
      const byId = findBySelector(current, rule.selector);
      let nodes = ruleNodes(current, rule).filter((node) => !ignored.has(node));
      // rows with the id are here, none keeps the fixed text the baseline's did: the text broke (REQ-069-03)
      const broke = !result.found[rule.id].current.length && byId.length > 0;
      if (broke && result.found[rule.id].baseline.length) nodes = byId.filter((node) => !ignored.has(node));
      result.variable[rule.id] = {
        items: nodes.map((node) => ({
          text: textOf(node),
          bounds: node.bounds,
          element: `${shortClass(node.className)} «${textOf(node)}»`,
          ...checkVariableText(rule.parts, textOf(node)),
        })),
        gone: !result.found[rule.id].current.length && !!result.found[rule.id].baseline.length && !broke,
        overridden: !nodes.length && !!result.found[rule.id].current.length,
      };
    }
  }
  return result;
}

/**
 * What a check's variable-text rules leave out, on both trees, and the elements
 * they found: a change there is not a change of the screen (REQ-033-16, 33,
 * REQ-066-04). Rules come from the project and the check's own, as saved.
 */
export function variableTextAreas(
  settings: UiTreeSettings,
  check: { name: string; customTags?: string | null },
  trees: Array<UiTree | null>
): { areas: Rect[]; keys: string[] } {
  const rules = [...settings.elementRules, ...(settings.checkRules[checkKey(check)] ?? [])].filter(
    (rule) => rule.action === 'variable'
  );
  if (!rules.length) return { areas: [], keys: [] };
  const resolved = resolveRules(rules, trees);
  return {
    areas: Object.values(resolved.leftOut).flatMap((items) => items.flatMap((item) => item.areas)),
    keys: resolved.quietKeys,
  };
}

const STATUS_BAR_IDS = ['android:id/statusBarBackground', 'android:id/navigationBarBackground'];
// Fallbacks when the tree has no bar views: 24 dp on Android, the area above
// the safe-area inset on iPhones with a notch or island.
const ANDROID_STATUS_BAR_DP = 24;
export const IOS_STATUS_BAR_PT = 54;

/** Status and navigation bars: clock, battery and signal change on every run. */
export function findSystemBars(tree: UiTree): Rect[] {
  // a browser's screenshot has no status or navigation bar (REQ-050-07)
  if (tree.format === 'web') return [];
  if (tree.format === 'appium-ios') {
    return [{ x: 0, y: 0, width: tree.width, height: Math.round(IOS_STATUS_BAR_PT * tree.scale) }];
  }
  const bars = tree.nodes
    .filter((node) => STATUS_BAR_IDS.includes(node.resourceId) && node.bounds.width && node.bounds.height)
    .map((node) => node.bounds);
  if (bars.length) return bars;
  return [{ x: 0, y: 0, width: tree.width, height: Math.round(ANDROID_STATUS_BAR_DP * tree.pixelsPerDp) }];
}

export interface ElementMove {
  from: Rect;
  to: Rect;
  key: string;
}

// Containers this large are the screen itself, not something that moved on it.
const MAX_MOVE_SCREEN_SHARE = 0.9;

/**
 * Elements that kept their size and moved, outermost first: pasting each at
 * its new place in the baseline makes a shift stop looking like a change,
 * while anything that changed inside the element still shows. An element is
 * left out when its parent moved by the same offset, since the parent's copy
 * already carries it.
 */
export function computeMoves(baseline: UiTree, current: UiTree, maxMoveDp: number | null): ElementMove[] {
  const before = new Map(baseline.nodes.map((node) => [node.key, node]));
  const screen = current.width * current.height;
  const offsets = new Map<string, { dx: number; dy: number }>();
  for (const node of current.nodes) {
    const old = before.get(node.key);
    if (!old) continue;
    offsets.set(node.key, { dx: node.bounds.x - old.bounds.x, dy: node.bounds.y - old.bounds.y });
  }

  const qualifies = (node: UiNode): boolean => {
    const old = before.get(node.key);
    const offset = offsets.get(node.key);
    if (!old || !offset || (!offset.dx && !offset.dy)) return false;
    if (Math.abs(old.bounds.width - node.bounds.width) > 1 || Math.abs(old.bounds.height - node.bounds.height) > 1) {
      return false;
    }
    if (!node.bounds.width || !node.bounds.height) return false;
    if ((node.bounds.width * node.bounds.height) / screen > MAX_MOVE_SCREEN_SHARE) return false;
    return maxMoveDp === null || Math.hypot(offset.dx, offset.dy) / current.pixelsPerDp <= maxMoveDp;
  };
  const moving = new Set(current.nodes.filter(qualifies).map((node) => node.index));

  const moves: Array<ElementMove & { depth: number }> = [];
  for (const index of moving) {
    const node = current.nodes[index];
    const offset = offsets.get(node.key);
    // the nearest moving ancestor with the same offset already carries this one
    let ancestor = node.parent;
    let carried = false;
    while (ancestor !== null && !carried) {
      const ancestorOffset = moving.has(ancestor) ? offsets.get(current.nodes[ancestor].key) : undefined;
      carried = !!ancestorOffset && ancestorOffset.dx === offset.dx && ancestorOffset.dy === offset.dy;
      ancestor = current.nodes[ancestor].parent;
    }
    if (carried) continue;
    moves.push({ from: before.get(node.key).bounds, to: node.bounds, key: node.key, depth: node.depth });
  }
  return moves.sort((a, b) => a.depth - b.depth).map(({ from, to, key }) => ({ from, to, key }));
}
