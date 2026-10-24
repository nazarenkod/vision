export interface DiffRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Pixelmatch paints changed pixels in its diff colour (pure red by default);
// anti-aliased ones are yellow and everything else is a faded grey.
const isChangedPixel = (data: Uint8Array | Buffer, i: number) =>
  data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0;

const CELL = 8;
// Changes this many cells apart still count as one region: a button whose label
// changed is one change, not one per letter.
const GAP_CELLS = 2;
const MAX_REGIONS = 20;

/**
 * Bounding boxes of the changed areas in a pixelmatch diff, largest first. The
 * diff is reduced to a grid of 8 px cells and nearby cells are joined, so the
 * result describes changes the way a person would point at them.
 */
export function findDiffRegions(diff: { width: number; height: number; data: Uint8Array | Buffer }): DiffRegion[] {
  const cols = Math.ceil(diff.width / CELL);
  const rows = Math.ceil(diff.height / CELL);
  const marked = new Uint8Array(cols * rows);
  let any = false;
  for (let y = 0; y < diff.height; y++) {
    const row = Math.floor(y / CELL) * cols;
    for (let x = 0; x < diff.width; x++) {
      if (isChangedPixel(diff.data, (y * diff.width + x) * 4)) {
        marked[row + Math.floor(x / CELL)] = 1;
        any = true;
      }
    }
  }
  if (!any) return [];

  const seen = new Uint8Array(cols * rows);
  const regions: Array<DiffRegion & { cells: number }> = [];
  const stack: number[] = [];
  for (let start = 0; start < marked.length; start++) {
    if (!marked[start] || seen[start]) continue;
    let minC = cols;
    let minR = rows;
    let maxC = -1;
    let maxR = -1;
    let cells = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const cell = stack.pop();
      const c = cell % cols;
      const r = (cell - c) / cols;
      cells++;
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      for (let dr = -GAP_CELLS; dr <= GAP_CELLS; dr++) {
        for (let dc = -GAP_CELLS; dc <= GAP_CELLS; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          const next = nr * cols + nc;
          if (marked[next] && !seen[next]) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
    }
    const x = minC * CELL;
    const y = minR * CELL;
    regions.push({
      x,
      y,
      width: Math.min(diff.width, (maxC + 1) * CELL) - x,
      height: Math.min(diff.height, (maxR + 1) * CELL) - y,
      cells,
    });
  }

  return regions
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, MAX_REGIONS)
    .map(({ x, y, width, height }) => ({ x, y, width, height }));
}
