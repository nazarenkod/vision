import { createHash } from 'crypto';
import { Rect, UiNode, UiTree } from './ui-tree.types';
import { elementsUnderRegions, StructuralChange } from './structure-diff';

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const SEMANTIC_KINDS = new Set(['label', 'state', 'added', 'removed']);

/**
 * Element changes the screenshot does not show: a new label, a control that
 * became disabled or unclickable, an invisible control added on top of the
 * screen. A change counts only where no changed pixels are, so what the
 * pixel diff already flags is not reported twice. Added or removed elements
 * count only when they can be tapped.
 */
export function invisibleChanges(
  changes: StructuralChange[],
  regions: Rect[],
  clickableKeys: Set<string>
): StructuralChange[] {
  return changes.filter((change) => {
    if (!SEMANTIC_KINDS.has(change.kind)) return false;
    if ((change.kind === 'added' || change.kind === 'removed') && !clickableKeys.has(change.key)) return false;
    return !regions.some((region) => intersects(region, change.bounds));
  });
}

// Framework containers are not components; shared chrome like a toolbar is.
const NOT_A_COMPONENT = /^android:id\/|:id\/(content|action_bar_root|decor_content_parent)$/;

export interface ComponentChange {
  // resource id of the component, e.g. com.bank.app:id/bottom_nav
  componentId: string;
  key: string;
  // hashes of the component's pixels in the baseline and now ("none" when it did not exist)
  before: string;
  after: string;
  bounds: Rect;
  // every changed area of the screenshot lies inside this component
  coversAllChanges: boolean;
}

export interface RgbaLike {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
}

const HASH_SIDE = 24;

/** Coarse hash of an area: the same component drawn the same way hashes the same on any screen. */
export function areaHash(image: RgbaLike, rect: Rect): string {
  const x0 = Math.max(0, Math.round(rect.x));
  const y0 = Math.max(0, Math.round(rect.y));
  const width = Math.min(image.width - x0, Math.round(rect.width));
  const height = Math.min(image.height - y0, Math.round(rect.height));
  if (width <= 0 || height <= 0) return 'none';
  const bytes = Buffer.alloc(HASH_SIDE * HASH_SIDE * 3);
  for (let y = 0; y < HASH_SIDE; y++) {
    const sy = y0 + Math.min(height - 1, Math.floor(((y + 0.5) * height) / HASH_SIDE));
    for (let x = 0; x < HASH_SIDE; x++) {
      const sx = x0 + Math.min(width - 1, Math.floor(((x + 0.5) * width) / HASH_SIDE));
      const i = (sy * image.width + sx) * 4;
      const o = (y * HASH_SIDE + x) * 3;
      // 4 bits per channel absorbs anti-aliasing and scaling noise
      bytes[o] = image.data[i] >> 4;
      bytes[o + 1] = image.data[i + 1] >> 4;
      bytes[o + 2] = image.data[i + 2] >> 4;
    }
  }
  return createHash('sha1').update(bytes).digest('hex').slice(0, 16);
}

const MAX_COMPONENTS = 6;
const MAX_COMPONENT_SCREEN_SHARE = 0.6;

// Diff regions are snapped to an 8 px grid, so they can stick out of an element by that much.
const REGION_SNAP_PX = 8;
const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - REGION_SNAP_PX &&
  inner.y >= outer.y - REGION_SNAP_PX &&
  inner.x + inner.width <= outer.x + outer.width + REGION_SNAP_PX &&
  inner.y + inner.height <= outer.y + outer.height + REGION_SNAP_PX;

/**
 * Components (elements with an id, smaller than most of the screen) that
 * hold a change, with hashes of how they looked before and after. The same
 * toolbar changed the same way on many screens gives the same hashes on each,
 * which is what groups those screenshots together.
 */
export function componentChanges(input: {
  tree: UiTree;
  baselineTree: UiTree | null;
  image: RgbaLike;
  baselineImage: RgbaLike | null;
  regions: Rect[];
  changes: StructuralChange[];
}): ComponentChange[] {
  const { tree, baselineTree, image, baselineImage, regions, changes } = input;
  if (!regions.length && !changes.length) return [];
  const screen = tree.width * tree.height;
  const baselineByKey = new Map((baselineTree?.nodes ?? []).map((node) => [node.key, node]));
  const changedAreas = [...regions, ...changes.filter((c) => c.kind !== 'moved').map((c) => c.bounds)];

  // the elements holding each change, then every id'd ancestor of them
  const seeds = new Set<number>();
  elementsUnderRegions(tree, regions).forEach((hit) => {
    const node = hit.key ? tree.nodes.find((n) => n.key === hit.key) : undefined;
    if (node) seeds.add(node.index);
  });
  changes.forEach((change) => {
    const node = tree.nodes.find((n) => n.key === change.key);
    if (node) seeds.add(node.index);
  });

  const candidates = new Map<number, UiNode>();
  seeds.forEach((index) => {
    let current: number | null = index;
    while (current !== null) {
      const node = tree.nodes[current];
      const share = (node.bounds.width * node.bounds.height) / screen;
      if (node.resourceId && !NOT_A_COMPONENT.test(node.resourceId) && share <= MAX_COMPONENT_SCREEN_SHARE) {
        candidates.set(node.index, node);
      }
      current = node.parent;
    }
  });

  return (
    [...candidates.values()]
      .sort((a, b) => b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height)
      .slice(0, MAX_COMPONENTS)
      .map((node) => {
        const old = baselineByKey.get(node.key);
        return {
          componentId: node.resourceId,
          key: node.key,
          before: old && baselineImage ? areaHash(baselineImage, old.bounds) : 'none',
          after: areaHash(image, node.bounds),
          bounds: node.bounds,
          coversAllChanges: changedAreas.every((area) => contains(node.bounds, area)),
        };
      })
      // a component that looks exactly as before did not change
      .filter((component) => component.before !== component.after)
  );
}
