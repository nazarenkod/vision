export interface Size {
  width: number;
  height: number;
}

/**
 * The largest scale at which the image fits the box both in width and in
 * height, without changing its proportions (REQ-046-01): a portrait phone
 * screen fills the height of the area, a landscape tablet its width.
 * An image or a box with no size yet gives 1, so nothing collapses to zero.
 */
export function fitScale(image: Size, box: Size): number {
  if (image.width <= 0 || image.height <= 0) return 1;
  if (box.width <= 0 || box.height <= 0) return 1;
  return Math.min(box.width / image.width, box.height / image.height);
}
