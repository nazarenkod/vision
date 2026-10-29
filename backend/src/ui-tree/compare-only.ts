import { ElementMove, ElementRule, matchesSelector, parseSelector } from './comparison-inputs';
import { describeNode } from './ui-tree.parser';
import { Rect, UiNode, UiTree } from './ui-tree.types';

/** Why a compare-only run cannot be trusted to its pixels (spec 015). */
export type CompareOnlyProblem =
  | { kind: 'no-tree' }
  | { kind: 'nothing-found'; ruleId: string; selector: string }
  | { kind: 'disappeared' | 'appeared'; ruleId: string; selector: string; element: string }
  | { kind: 'count'; ruleId: string; selector: string; baseline: number; current: number }
  | { kind: 'resized'; ruleId: string; selector: string; element: string; before: Rect; after: Rect };

export interface CompareOnlyPlan {
  // the check has a compare-only rule
  active: boolean;
  // compared elements copied in the baseline to where they are now
  moves: ElementMove[];
  // what is compared, in checkpoint pixels; also what the difference is measured against
  keep: Rect[];
  // the rest of the screenshot, as ignore areas
  ignoreOutside: Rect[];
  problems: CompareOnlyProblem[];
}

const INACTIVE: CompareOnlyPlan = { active: false, moves: [], keep: [], ignoreOutside: [], problems: [] };

// a redrawn element can come out a pixel larger or smaller
const SIZE_TOLERANCE_PX = 1;

const sameSize = (a: Rect, b: Rect) =>
  Math.abs(a.width - b.width) <= SIZE_TOLERANCE_PX && Math.abs(a.height - b.height) <= SIZE_TOLERANCE_PX;

/** Elements in screen order, so the n-th match on each side is the same element (REQ-015-14). */
function matchesOf(tree: UiTree, rule: ElementRule): UiNode[] {
  const selector = parseSelector(rule.selector);
  if (!selector) return [];
  return tree.nodes
    .filter((node) => node.visible && node.bounds.width && node.bounds.height && matchesSelector(node, selector))
    .sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
}

/**
 * How to compare only the elements a check's compare-only rules name: each
 * one against itself in the baseline, wherever it is now, with everything
 * else ignored. What the pixels cannot tell (an element gone, resized, a rule
 * that found nothing, no tree) comes back as problems that keep the run in
 * review.
 */
export function planCompareOnly(
  rules: ElementRule[],
  baseline: UiTree | null,
  current: UiTree | null
): CompareOnlyPlan {
  const compareRules = rules.filter((rule) => rule.action === 'compare');
  if (!compareRules.length) return INACTIVE;
  if (!baseline || !current) return { ...INACTIVE, active: true, problems: [{ kind: 'no-tree' }] };

  const moves: ElementMove[] = [];
  const keep: Rect[] = [];
  const problems: CompareOnlyProblem[] = [];
  // an element two rules match is compared once
  const taken = new Set<number>();

  for (const rule of compareRules) {
    const before = matchesOf(baseline, rule);
    const after = matchesOf(current, rule).filter((node) => !taken.has(node.index));
    after.forEach((node) => taken.add(node.index));
    const base = { ruleId: rule.id, selector: rule.selector };

    if (!before.length && !after.length) {
      problems.push({ kind: 'nothing-found', ...base });
      continue;
    }
    if (!before.length || !after.length) {
      const kind = before.length ? 'disappeared' : 'appeared';
      for (const node of before.length ? before : after) {
        problems.push({ kind, ...base, element: describeNode(node) });
        keep.push(node.bounds);
      }
      continue;
    }
    if (before.length !== after.length) {
      problems.push({ kind: 'count', ...base, baseline: before.length, current: after.length });
    }

    after.forEach((node, i) => {
      keep.push(node.bounds);
      const old = before[i];
      if (!old) return;
      if (!sameSize(old.bounds, node.bounds)) {
        problems.push({
          kind: 'resized',
          ...base,
          element: describeNode(node),
          before: old.bounds,
          after: node.bounds,
        });
        return;
      }
      if (old.bounds.x !== node.bounds.x || old.bounds.y !== node.bounds.y) {
        moves.push({ from: old.bounds, to: node.bounds, key: node.key });
      }
    });
  }

  const width = Math.max(baseline.width, current.width);
  const height = Math.max(baseline.height, current.height);
  return { active: true, moves, keep, ignoreOutside: complement(keep, width, height), problems };
}

/**
 * The parts of a width × height canvas no rect covers, as rects: one band per
 * run of rows with the same covered spans, so n rects give at most 2n + 1 bands.
 */
export function complement(rects: Rect[], width: number, height: number): Rect[] {
  const clipped = rects
    .map((rect) => {
      const x0 = Math.max(0, Math.floor(rect.x));
      const y0 = Math.max(0, Math.floor(rect.y));
      const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
      const y1 = Math.min(height, Math.ceil(rect.y + rect.height));
      return { x0, y0, x1, y1 };
    })
    .filter((rect) => rect.x1 > rect.x0 && rect.y1 > rect.y0);
  const edges = [...new Set([0, height, ...clipped.flatMap((rect) => [rect.y0, rect.y1])])].sort((a, b) => a - b);

  const result: Rect[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const top = edges[i];
    const bottom = edges[i + 1];
    const spans = clipped
      .filter((rect) => rect.y0 <= top && rect.y1 >= bottom)
      .map((rect) => [rect.x0, rect.x1])
      .sort((a, b) => a[0] - b[0]);
    let x = 0;
    for (const [from, to] of spans) {
      if (from > x) result.push({ x, y: top, width: from - x, height: bottom - top });
      x = Math.max(x, to);
    }
    if (x < width) result.push({ x, y: top, width: width - x, height: bottom - top });
  }
  return result;
}

/** A run whose compared elements the pixels cannot vouch for goes to review, never passes. */
export function compareOnlyStatus<S extends string>(status: S, problems: CompareOnlyProblem[]): S | 'unresolved' {
  return problems.length && (status === 'ok' || status === 'autoApproved') ? 'unresolved' : status;
}

// anti-aliased edges, as for element rules
const INSIDE_PADDING_PX = 2;

/**
 * Element changes a compare-only check still cares about: the compared
 * elements and what is inside them. Ignore areas cannot do this on their own,
 * since a change straddling two of the bands around an element lies inside none.
 */
export function insideCompared<T extends { bounds: Rect }>(changes: T[], plan: CompareOnlyPlan): T[] {
  if (!plan.active) return changes;
  const inside = (outer: Rect, inner: Rect) =>
    inner.x >= outer.x - INSIDE_PADDING_PX &&
    inner.y >= outer.y - INSIDE_PADDING_PX &&
    inner.x + inner.width <= outer.x + outer.width + INSIDE_PADDING_PX &&
    inner.y + inner.height <= outer.y + outer.height + INSIDE_PADDING_PX;
  return changes.filter((change) => plan.keep.some((kept) => inside(kept, change.bounds)));
}
