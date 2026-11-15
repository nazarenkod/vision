import type { Rect } from "../types";

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
