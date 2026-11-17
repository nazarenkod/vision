export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a mark's frame is drawn so the whole line stays on the screenshot. A
 * line is centred on the rect's edge, so on an element as wide as the screen
 * half of it fell outside and the mark was a hairline nobody noticed. Edges at
 * or past the screenshot's are moved in by half the line; the rest stay.
 */
export function frameInside(rect: Box, line: number, stage: Box): Box {
  const half = line / 2;
  const left = Math.max(rect.x, stage.x + half);
  const top = Math.max(rect.y, stage.y + half);
  const right = Math.min(rect.x + rect.width, stage.x + stage.width - half);
  const bottom = Math.min(rect.y + rect.height, stage.y + stage.height - half);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * The top of a mark's label: above the frame, or just inside it when the frame
 * starts at the top of the screenshot and the label would be cut off.
 */
export function labelTop(frame: Box, labelHeight: number, stageTop = 0) {
  const above = frame.y - labelHeight;
  return above >= stageTop ? above : frame.y;
}
