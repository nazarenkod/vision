import { describeNode, ownSpeakableText } from './ui-tree.parser';
import { Rect, UiNode, UiTree } from './ui-tree.types';

export type StructuralChangeKind = 'text' | 'label' | 'added' | 'removed' | 'resized' | 'moved';

export interface StructuralChange {
  kind: StructuralChangeKind;
  key: string;
  element: string;
  resourceId: string;
  before?: string;
  after?: string;
  // current bounds; the baseline's for a removed element
  bounds: Rect;
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
const isMeaningful = (node: UiNode) =>
  node.visible && (!!node.resourceId || !!ownSpeakableText(node) || node.clickable);

/**
 * Element-level differences between the baseline's UI tree and the current
 * one. Elements are matched by key (resource id, else class + text, else path).
 * Order: content changes, then added/removed, then size, then position.
 */
export function diffTrees(baseline: UiTree, current: UiTree): StructuralChange[] {
  const before = new Map(baseline.nodes.map((node) => [node.key, node]));
  const after = new Map(current.nodes.map((node) => [node.key, node]));
  const changes: StructuralChange[] = [];
  const toDp = (px: number, tree: UiTree) => px / tree.pixelsPerDp;

  for (const node of current.nodes) {
    const old = before.get(node.key);
    if (!old) {
      if (isMeaningful(node)) {
        changes.push({
          kind: 'added',
          key: node.key,
          element: describeNode(node),
          resourceId: node.resourceId,
          bounds: node.bounds,
        });
      }
      continue;
    }
    const base = { key: node.key, element: describeNode(node), resourceId: node.resourceId, bounds: node.bounds };
    if (old.text !== node.text) changes.push({ ...base, kind: 'text', before: old.text, after: node.text });
    if (old.label !== node.label) changes.push({ ...base, kind: 'label', before: old.label, after: node.label });
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
    if (!after.has(node.key) && isMeaningful(node)) {
      changes.push({
        kind: 'removed',
        key: node.key,
        element: describeNode(node),
        resourceId: node.resourceId,
        bounds: node.bounds,
      });
    }
  }

  const order: Record<StructuralChangeKind, number> = { text: 0, label: 0, added: 1, removed: 1, resized: 2, moved: 3 };
  return changes.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, MAX_CHANGES);
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
      change.kind === 'text' || change.kind === 'label'
        ? `${change.kind}:${change.key}:${change.before}→${change.after}`
        : `${change.kind}:${change.key}`
    )
    .sort()
    .join('\n');
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
