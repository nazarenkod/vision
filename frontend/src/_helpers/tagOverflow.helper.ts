/**
 * How many tags, from the first, fit in one line `available` px wide, given the
 * width of each tag, the gap between chips and the width of the "+N" chip that
 * stands for the rest. All of them when they fit as they are; otherwise as many
 * as leave room for "+N", but never fewer than one: the first tag is what tells
 * the screens apart, and cut short with an ellipsis it still says more than a
 * bare "+5" (REQ-046-31).
 */
export const fittingTagCount = (
  widths: number[],
  available: number,
  gap: number,
  moreWidth: number,
): number => {
  // not laid out (a hidden tab, a test without layout): nothing to measure by
  if (available <= 0) return widths.length;
  const total = widths.reduce(
    (sum, width, index) => sum + width + (index > 0 ? gap : 0),
    0,
  );
  if (total <= available) return widths.length;

  let used = moreWidth;
  let count = 0;
  for (const width of widths) {
    if (used + gap + width > available) break;
    used += gap + width;
    count += 1;
  }
  return Math.max(1, count);
};
