import { describeNode } from '../ui-tree/ui-tree.parser';
import { RegionElement, StructuralChange } from '../ui-tree/structure-diff';
import { Rect, UiTree } from '../ui-tree/ui-tree.types';

/** A screen of the build waiting for a decision, with what its UI trees say changed (055). */
export interface ReviewedRun {
  id: string;
  name: string;
  customTags: string;
  device: string;
  os: string;
  browser: string;
  viewport: string;
  imageName: string;
  baselineName: string;
  merge: boolean;
  tree: UiTree;
  baselineTree: UiTree;
  // changed areas and the smallest element around each; key null where no element is
  regions: RegionElement[];
  changes: StructuralChange[];
}

export interface ElementReviewScreen {
  id: string;
  name: string;
  customTags: string;
  device: string;
  os: string;
  browser: string;
  viewport: string;
  imageName: string;
  baselineName: string;
  merge: boolean;
  // true when nothing else on the screen changed: the only screens one decision may take
  only: boolean;
  current: Rect | null;
  baseline: Rect | null;
  width: number;
  height: number;
  baselineWidth: number;
  baselineHeight: number;
}

export interface ReviewedElement {
  key: string;
  name: string;
  screens: number;
  only: number;
  items: ElementReviewScreen[];
}

// One screen is reviewed in the comparison as before; an element earns a sheet from two.
export const MIN_SCREENS = 2;

// a move alone is the layout settling around a change, not a change of the element
const counts = (change: StructuralChange) => change.kind !== 'moved';

// only ids name the same element on another screen; a path or a text says nothing across screens
const crossScreen = (key: string) => key.startsWith('id:');

function changedKeys(run: ReviewedRun): { keys: Set<string>; loose: boolean } {
  const keys = new Set<string>();
  let loose = false;
  for (const region of run.regions) {
    if (region.key) keys.add(region.key);
    else loose = true;
  }
  for (const change of run.changes) if (counts(change)) keys.add(change.key);
  return { keys, loose };
}

const nodeOf = (tree: UiTree, key: string) => tree.nodes.find((node) => node.key === key) ?? null;

/**
 * The elements that changed on more than one screen of a build, most screens first, each with
 * the screens it changed on and whether it was the only thing that changed there (055). An
 * element is told apart by its id, so the same toolbar with a different title on every screen is
 * one element.
 */
export function elementReview(runs: ReviewedRun[]): ReviewedElement[] {
  const byKey = new Map<string, ReviewedElement>();
  for (const run of runs) {
    const { keys, loose } = changedKeys(run);
    for (const key of keys) {
      if (!crossScreen(key)) continue;
      const current = nodeOf(run.tree, key);
      const before = nodeOf(run.baselineTree, key);
      const entry = byKey.get(key) ?? {
        key,
        name: describeNode(current ?? before),
        screens: 0,
        only: 0,
        items: [],
      };
      const only = !loose && keys.size === 1;
      entry.screens++;
      if (only) entry.only++;
      entry.items.push({
        id: run.id,
        name: run.name,
        customTags: run.customTags,
        device: run.device,
        os: run.os,
        browser: run.browser,
        viewport: run.viewport,
        imageName: run.imageName,
        baselineName: run.baselineName,
        merge: run.merge,
        only,
        current: current?.bounds ?? null,
        baseline: before?.bounds ?? null,
        width: run.tree.width,
        height: run.tree.height,
        baselineWidth: run.baselineTree.width,
        baselineHeight: run.baselineTree.height,
      });
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .filter((element) => element.screens >= MIN_SCREENS)
    .map((element) => ({
      ...element,
      // the screens one decision takes first, then the ones to open on their own
      items: element.items.sort((a, b) => Number(b.only) - Number(a.only) || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.screens - a.screens || a.name.localeCompare(b.name));
}
