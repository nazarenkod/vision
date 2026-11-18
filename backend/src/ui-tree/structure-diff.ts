import { onlyNumbersDiffer } from './number-change';
import { describeNode, ownSpeakableText } from './ui-tree.parser';
import { Rect, UiNode, UiTree } from './ui-tree.types';

export type StructuralChangeKind = 'text' | 'label' | 'state' | 'added' | 'removed' | 'resized' | 'moved';

export interface StructuralChange {
  kind: StructuralChangeKind;
  key: string;
  element: string;
  resourceId: string;
  before?: string;
  after?: string;
  // current bounds; the baseline's for a removed element
  bounds: Rect;
  // the element on the current tree, to act on it from the change (REQ-078-02); absent for a removed one
  index?: number;
}

export interface RegionElement {
  region: Rect;
  key: string | null;
  element: string | null;
  resourceId: string | null;
}

// Below these (dp) a move or a resize is layout jitter, not a change.
const MOVE_THRESHOLD_DP = 4;
const RESIZE_THRESHOLD_DP = 2;
const MAX_CHANGES = 50;

// Elements worth naming: they have an id, say something, or can be tapped.
// Framework views (status bar background, content frame) are not the app's elements.
const hasAppId = (node: UiNode) => !!node.resourceId && !node.resourceId.startsWith('android:id/');

const isMeaningful = (node: UiNode) => node.visible && (hasAppId(node) || !!ownSpeakableText(node) || node.clickable);

/**
 * Where an element stands in its tree: its parent, by key, and which of the parent's
 * children of its class it is. Null when the parent has no twin on the other tree,
 * since then the place means nothing there (REQ-077-05).
 */
function placesOf(tree: UiTree, parentKnown: (key: string) => boolean): Map<number, string> {
  const places = new Map<number, string>();
  const ordinals = new Map<string, number>();
  for (const node of tree.nodes) {
    const parent = node.parent === null ? null : tree.nodes[node.parent];
    if (parent && !parentKnown(parent.key)) continue;
    const group = `${parent?.key ?? ''}\u0000${node.className}`;
    const ordinal = ordinals.get(group) ?? 0;
    ordinals.set(group, ordinal + 1);
    places.set(node.index, `${group}\u0000${ordinal}`);
  }
  return places;
}

const sameOrNumbers = (a: string, b: string) => a === b || onlyNumbersDiffer(a, b);

/**
 * Elements keyed by their text whose number changed get a new key, so by key they
 * appeared and disappeared. Paired when they stand in the same place, are of the same
 * class and their texts differ only in numbers (REQ-077-01); keys stay as they are
 * (REQ-077-04). Current key → its baseline twin.
 */
export function pairsByPlace(baseline: UiTree, current: UiTree): Map<string, UiNode> {
  const before = new Map(baseline.nodes.map((node) => [node.key, node]));
  const after = new Map(current.nodes.map((node) => [node.key, node]));
  // the text is in the key only of an element with no resource id
  const keyedByText = (node: UiNode) => !node.resourceId && !!(node.text || node.label);
  const lonely = (tree: UiTree, other: Map<string, UiNode>) =>
    tree.nodes.filter((node) => keyedByText(node) && !other.has(node.key));
  const currentLonely = lonely(current, before);
  const baselineLonely = lonely(baseline, after);
  if (!currentLonely.length || !baselineLonely.length) return new Map();

  const currentPlaces = placesOf(current, (key) => before.has(key));
  const baselinePlaces = placesOf(baseline, (key) => after.has(key));
  const byPlace = new Map<string, UiNode>();
  for (const node of baselineLonely) {
    const place = baselinePlaces.get(node.index);
    if (place) byPlace.set(place, node);
  }
  const twins = (a: UiNode, b: UiNode) =>
    a.className === b.className && sameOrNumbers(a.text, b.text) && sameOrNumbers(a.label, b.label);
  const pairs = new Map<string, UiNode>();
  for (const node of currentLonely) {
    const place = currentPlaces.get(node.index);
    const old = place ? byPlace.get(place) : undefined;
    if (old && twins(old, node)) pairs.set(node.key, old);
  }
  // no place to go by (a parent without a twin, siblings that differ): the one look-alike
  // on each side is the same element; two of them could be either (REQ-078-05)
  const taken = new Set([...pairs.values()].map((node) => node.key));
  const leftCurrent = currentLonely.filter((node) => !pairs.has(node.key));
  const leftBaseline = baselineLonely.filter((node) => !taken.has(node.key));
  for (const node of leftCurrent) {
    const candidates = leftBaseline.filter((old) => twins(old, node));
    if (candidates.length !== 1) continue;
    const [old] = candidates;
    if (leftCurrent.filter((other) => twins(old, other)).length === 1) pairs.set(node.key, old);
  }
  return pairs;
}

/**
 * Element-level differences between the baseline's UI tree and the current
 * one. Elements are matched by key (resource id, else class + text, else path),
 * then those whose only change is a number by place (REQ-077-01).
 * Order: content changes, then added/removed, then size, then position.
 */
export function diffTrees(baseline: UiTree, current: UiTree, limit = MAX_CHANGES): StructuralChange[] {
  const before = new Map(baseline.nodes.map((node) => [node.key, node]));
  const after = new Map(current.nodes.map((node) => [node.key, node]));
  const paired = pairsByPlace(baseline, current);
  const pairedBaseline = new Set([...paired.values()].map((node) => node.key));
  const changes: StructuralChange[] = [];
  const toDp = (px: number, tree: UiTree) => px / tree.pixelsPerDp;

  for (const node of current.nodes) {
    const old = before.get(node.key) ?? paired.get(node.key);
    if (!old) {
      if (isMeaningful(node)) {
        changes.push({
          kind: 'added',
          key: node.key,
          element: describeNode(node),
          resourceId: node.resourceId,
          bounds: node.bounds,
          index: node.index,
        });
      }
      continue;
    }
    const base = {
      key: node.key,
      element: describeNode(node),
      resourceId: node.resourceId,
      bounds: node.bounds,
      index: node.index,
    };
    if (old.text !== node.text) changes.push({ ...base, kind: 'text', before: old.text, after: node.text });
    if (old.label !== node.label) changes.push({ ...base, kind: 'label', before: old.label, after: node.label });
    const stateBefore = stateOf(old);
    const stateAfter = stateOf(node);
    if (stateBefore !== stateAfter) changes.push({ ...base, kind: 'state', before: stateBefore, after: stateAfter });
    if (!isMeaningful(node)) continue;
    const dw = Math.abs(toDp(node.bounds.width, current) - toDp(old.bounds.width, baseline));
    const dh = Math.abs(toDp(node.bounds.height, current) - toDp(old.bounds.height, baseline));
    const dx = Math.abs(toDp(node.bounds.x, current) - toDp(old.bounds.x, baseline));
    const dy = Math.abs(toDp(node.bounds.y, current) - toDp(old.bounds.y, baseline));
    if (dw > RESIZE_THRESHOLD_DP || dh > RESIZE_THRESHOLD_DP) {
      changes.push({
        ...base,
        kind: 'resized',
        before: `${Math.round(toDp(old.bounds.width, baseline))}×${Math.round(toDp(old.bounds.height, baseline))}`,
        after: `${Math.round(toDp(node.bounds.width, current))}×${Math.round(toDp(node.bounds.height, current))}`,
      });
    } else if (dx > MOVE_THRESHOLD_DP || dy > MOVE_THRESHOLD_DP) {
      changes.push({ ...base, kind: 'moved', before: `${Math.round(dx)}`, after: `${Math.round(dy)}` });
    }
  }
  for (const node of baseline.nodes) {
    if (!after.has(node.key) && !pairedBaseline.has(node.key) && isMeaningful(node)) {
      changes.push({
        kind: 'removed',
        key: node.key,
        element: describeNode(node),
        resourceId: node.resourceId,
        bounds: node.bounds,
      });
    }
  }

  const order: Record<StructuralChangeKind, number> = {
    text: 0,
    label: 0,
    state: 0,
    added: 1,
    removed: 1,
    resized: 2,
    moved: 3,
  };
  return changes.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, limit);
}

/**
 * Identity of "what changed" for grouping screenshots: content changes,
 * additions, removals and resizes, keyed by element. Moves are left out — the
 * same change pushes things by different amounts on different screens and
 * locales. Empty when nothing structural changed.
 */
export function changeFingerprint(changes: StructuralChange[]): string {
  return changes
    .filter((change) => change.kind !== 'moved')
    .map((change) =>
      change.kind === 'text' || change.kind === 'label' || change.kind === 'state'
        ? `${change.kind}:${change.key}:${change.before}→${change.after}`
        : `${change.kind}:${change.key}`
    )
    .sort()
    .join('\n');
}

// Properties a user feels but a screenshot may not show. Flags absent on
// older stored trees read as false on both sides and never differ.
const STATE_FLAGS: Array<[keyof UiNode, string]> = [
  ['enabled', 'disabled'],
  ['clickable', 'not clickable'],
  ['checked', 'checked'],
  ['selected', 'selected'],
  ['accessible', 'hidden from screen readers'],
];

function stateOf(node: UiNode): string {
  return (
    STATE_FLAGS.map(([flag, word]) => {
      const value = !!node[flag];
      // 'enabled', 'clickable' and 'accessible' are described when they are off
      const inverted = flag === 'enabled' || flag === 'clickable' || flag === 'accessible';
      return (inverted ? !value : value) ? word : null;
    })
      .filter(Boolean)
      .join(', ') || 'default'
  );
}

const area = (rect: Rect) => Math.max(0, rect.width) * Math.max(0, rect.height);

function intersection(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

/**
 * For each changed area, the element that best wraps it: the meaningful element
 * with the highest overlap relative to both sizes, so a small icon inside a big
 * card resolves to the icon, and a full-width change to the card.
 */
export function elementsUnderRegions(tree: UiTree, regions: Rect[]): RegionElement[] {
  const candidates = tree.nodes.filter(isMeaningful);
  return regions.map((region) => {
    let best: UiNode | null = null;
    let bestScore = 0;
    for (const node of candidates) {
      const overlap = intersection(region, node.bounds);
      if (!overlap) continue;
      const score = overlap / (area(region) + area(node.bounds) - overlap);
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return {
      region,
      key: best?.key ?? null,
      element: best ? describeNode(best) : null,
      resourceId: best?.resourceId || null,
    };
  });
}
