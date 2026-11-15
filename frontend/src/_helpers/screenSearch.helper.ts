import type { Rect, ScreenSearchItem, ScreenSearchRow } from "../types";

/** Shorter than this, a text query finds half of every screen; the server says the same (053). */
export const MIN_QUERY_LENGTH = 2;

const SELECTOR = /^(id|class|text|xpath|component):/i;

/** Whether the page should ask the server yet: a selector always, a text from two characters. */
export const isSearchable = (query: string): boolean => {
  const trimmed = query.trim();
  return SELECTOR.test(trimmed) || trimmed.length >= MIN_QUERY_LENGTH;
};

/**
 * `/` opens the search from anywhere but a field, like in most tools; with a modifier it is
 * someone typing a character on another layout.
 */
export function isSearchHotkey(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey)
    return false;
  const target = event.target as HTMLElement | null;
  const tag = target?.tagName?.toLowerCase();
  return !(
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target?.isContentEditable
  );
}

/** An outline over a picture of the screen, in percent so it follows the picture's size. */
export const boxPercent = (box: Rect, width: number, height: number) => ({
  left: `${(box.x / width) * 100}%`,
  top: `${(box.y / height) * 100}%`,
  width: `${(box.width / width) * 100}%`,
  height: `${(box.height / height) * 100}%`,
});

/** Found elements travel to the baseline page in its address: `x,y,w,h;x,y,w,h` in pixels. */
export const encodeBoxes = (boxes: Rect[]): string =>
  boxes
    .map((box) =>
      [box.x, box.y, box.width, box.height].map(Math.round).join(","),
    )
    .join(";");

export function decodeBoxes(value: string | null): Rect[] {
  if (!value) return [];
  return value.split(";").flatMap((part) => {
    const numbers = part.split(",").map(Number);
    if (numbers.length !== 4 || numbers.some((n) => !Number.isFinite(n)))
      return [];
    const [x, y, width, height] = numbers;
    return width > 0 && height > 0 ? [{ x, y, width, height }] : [];
  });
}

/**
 * How to show one element cut out of a screen: the picture scaled so the element and a margin
 * around it fill a box `width` wide and at most `maxHeight` tall, and where the picture goes
 * inside it. All in CSS pixels; the box keeps the element's own proportions.
 */
export function cropLayout(
  box: Rect,
  image: { width: number; height: number },
  width: number,
  maxHeight: number,
  margin = 16,
) {
  const w = box.width + 2 * margin;
  const h = box.height + 2 * margin;
  const scale = Math.min(width / w, maxHeight / h);
  const boxWidth = Math.round(w * scale);
  const boxHeight = Math.round(h * scale);
  return {
    boxWidth,
    boxHeight,
    imageWidth: image.width * scale,
    imageHeight: image.height * scale,
    left: -(box.x - margin) * scale,
    top: -(box.y - margin) * scale,
  };
}

export interface SearchHitDevice {
  item: ScreenSearchItem;
  box: Rect;
}

/** One found element of one check, with every device it was found on (053, beta). */
export interface SearchHit {
  id: string;
  row: ScreenSearchRow;
  key: string;
  devices: SearchHitDevice[];
}

/** Rows of checks as the cards of found elements, filtered to the devices left on. */
export function searchHits(
  rows: ScreenSearchRow[],
  hiddenDevices: Set<string> = new Set(),
): SearchHit[] {
  return rows.flatMap((row) => {
    const byKey = new Map<string, SearchHit>();
    for (const item of row.items) {
      if (hiddenDevices.has(deviceLabel(item))) continue;
      item.keys.forEach((key, index) => {
        const hit = byKey.get(key) ?? {
          id: `${row.name}\n${row.customTags}\n${key}`,
          row,
          key,
          devices: [],
        };
        hit.devices.push({ item, box: item.boxes[index] });
        byKey.set(key, hit);
      });
    }
    return [...byKey.values()];
  });
}

/** A device as one line: what the filter pills and the dots under a card name. */
export const deviceLabel = (item: { device: string; os: string }) =>
  [item.device, item.os].filter(Boolean).join(" · ");

/** The devices of the found screens, in the order the server sent them. */
export const devicesOf = (rows: ScreenSearchRow[]): string[] => [
  ...new Set(rows.flatMap((row) => row.items.map(deviceLabel))),
];

/**
 * The suggestion the arrows move to: down from the field to the first, past the last back to the
 * field (-1), and up the other way round.
 */
export function nextActive(index: number, step: 1 | -1, count: number): number {
  if (count === 0) return -1;
  const places = count + 1;
  return ((index + 1 + step + places) % places) - 1;
}
