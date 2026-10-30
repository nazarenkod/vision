// the review's side panel: wide enough by default for a long element name on
// one line, and the reviewer's own width after that (REQ-018-37)
export const PANEL_WIDTH = { default: 420, min: 320 } as const;

/** Never narrower than the minimum, never more than half the window: the screenshots need room. */
export function clampPanelWidth(width: number, windowWidth: number): number {
  const max = Math.max(PANEL_WIDTH.min, Math.floor(windowWidth / 2));
  return Math.round(Math.min(max, Math.max(PANEL_WIDTH.min, width)));
}

/** A width remembered by this browser, or the default when there is none or it makes no sense. */
export function readPanelWidth(
  stored: string | null,
  windowWidth: number,
): number {
  const width = Number(stored);
  return clampPanelWidth(
    stored && Number.isFinite(width) ? width : PANEL_WIDTH.default,
    windowWidth,
  );
}
