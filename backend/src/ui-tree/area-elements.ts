import { Rect } from './ui-tree.types';

// below this an area also covers its surroundings, or misses part of the element
const MIN_OVERLAP = 0.9;

const areaOf = (rect: Rect) => Math.max(0, rect.width) * Math.max(0, rect.height);

function overlap(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

/**
 * The element a pixel area stands for: the one that covers at least 90 % of
 * the area and is at least 90 % covered by it. A rule for that element follows
 * it when the layout moves; the area does not (REQ-024-40, REQ-024-50).
 */
export function elementForArea<T extends { bounds: Rect }>(area: Rect, elements: T[]): T | null {
  let best: T | null = null;
  let bestShare = 0;
  for (const element of elements) {
    const shared = overlap(area, element.bounds);
    if (!shared) continue;
    const share = Math.min(shared / areaOf(area), shared / areaOf(element.bounds));
    if (share >= MIN_OVERLAP && share > bestShare) {
      best = element;
      bestShare = share;
    }
  }
  return best;
}
