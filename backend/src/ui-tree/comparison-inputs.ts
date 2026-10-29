import { Rect, UiNode, UiTree } from './ui-tree.types';

export type ElementRuleAction = 'ignore' | 'tolerate';

/**
 * A rule about elements, kept on the project (every screen) or on one screen.
 * selector:
 *   id:btn_pay        resource id (Android, with or without "package:id/") or iOS accessibility identifier
 *   class:ImageView   class name or its last segment; XCUIElementType prefix optional
 *   text:12:30        exact text or label; text:/\d+:\d+/ for a regular expression
 */
export interface ElementRule {
  id: string;
  selector: string;
  action: ElementRuleAction;
  // tolerate: changes covering at most this share of the element's pixels are not counted
  maxDiffPercent?: number;
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
  // where the screen's title is in the UI tree, first match wins (id:Appbar#Title)
  screenTitle: string[];
  // when two accessibility issues are the same problem, per rule (a11y-problems DuplicateMode)
  a11yDuplicates: Record<string, string>;
  // the project's problem classes (a11y-problems ProblemClass), first match wins
  a11yClasses: Array<Record<string, unknown>>;
}

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
  a11yDuplicates: {},
  a11yClasses: [],
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
      a11yDuplicates:
        parsed.a11yDuplicates && typeof parsed.a11yDuplicates === 'object' && !Array.isArray(parsed.a11yDuplicates)
          ? parsed.a11yDuplicates
          : {},
      a11yClasses: Array.isArray(parsed.a11yClasses)
        ? parsed.a11yClasses.filter((item: unknown) => {
            const value = item as { match?: unknown; when?: unknown } | null;
            // classes take issues by conditions (when), or by one element pattern as first written (match)
            return (
              !!value &&
              typeof value === 'object' &&
              (typeof value.match === 'string' || (!!value.when && typeof value.when === 'object'))
            );
          })
        : [],
    };
  } catch {
    return { ...DEFAULT_UI_TREE_SETTINGS };
  }
}

type Selector = { by: 'id'; value: string } | { by: 'class'; value: string } | { by: 'text'; value: string | RegExp };

export function parseSelector(selector: string): Selector | null {
  const match = /^(id|class|text):(.+)$/s.exec(selector.trim());
  if (!match) return null;
  const [, by, raw] = match;
  if (by === 'text') {
    const regex = /^\/(.+)\/([a-z]*)$/.exec(raw);
    if (regex) {
      try {
        return { by: 'text', value: new RegExp(regex[1], regex[2].includes('i') ? 'i' : '') };
      } catch {
        return null;
      }
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
      return selector.value instanceof RegExp ? selector.value.test(text) : text === selector.value;
    }
  }
}

// Anti-aliased edges around an element differ by a pixel or two when it is redrawn.
const RULE_PADDING_PX = 2;

const pad = (rect: Rect, padding: number): Rect => ({
  x: rect.x - padding,
  y: rect.y - padding,
  width: rect.width + 2 * padding,
  height: rect.height + 2 * padding,
});

export interface ResolvedRules {
  ignore: Rect[];
  tolerate: Array<Rect & { maxDiffPercent: number }>;
  // how many elements each rule matched, for the UI
  matches: Record<string, number>;
}

/**
 * Areas the rules cover, taken from both trees: an element that moved is
 * covered where it was and where it is.
 */
export function resolveRules(rules: ElementRule[], trees: Array<UiTree | null>): ResolvedRules {
  const result: ResolvedRules = { ignore: [], tolerate: [], matches: {} };
  for (const rule of rules) {
    const selector = parseSelector(rule.selector);
    if (!selector) continue;
    // the same element is usually in both trees, so the count is the larger of the two
    let count = 0;
    for (const tree of trees) {
      let inTree = 0;
      for (const node of tree?.nodes ?? []) {
        if (!node.visible || !node.bounds.width || !node.bounds.height || !matchesSelector(node, selector)) continue;
        inTree++;
        if (rule.action === 'ignore') {
          result.ignore.push(pad(node.bounds, RULE_PADDING_PX));
        } else {
          result.tolerate.push({ ...node.bounds, maxDiffPercent: rule.maxDiffPercent ?? 5 });
        }
      }
      count = Math.max(count, inTree);
    }
    result.matches[rule.id] = count;
  }
  return result;
}

const STATUS_BAR_IDS = ['android:id/statusBarBackground', 'android:id/navigationBarBackground'];
// Fallbacks when the tree has no bar views: 24 dp on Android, the area above
// the safe-area inset on iPhones with a notch or island.
const ANDROID_STATUS_BAR_DP = 24;
const IOS_STATUS_BAR_PT = 54;

/** Status and navigation bars: clock, battery and signal change on every run. */
export function findSystemBars(tree: UiTree): Rect[] {
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
