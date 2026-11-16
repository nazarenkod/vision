import type { Rect } from "../types";

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
