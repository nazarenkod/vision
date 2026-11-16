import { PNG } from 'pngjs';
import { BugMark } from './visual-bug';

// the blue the review draws a person's marks in: apart from the magenta of
// differences and the orange of accessibility problems
const MARK = [23, 92, 211];
const WHITE = [255, 255, 255];

// 3×5 digits, enough to number a handful of marks without a font library
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

/**
 * The checkpoint with the person's marks: a frame around each and its number
 * in a filled badge at the top-left corner, sized to the screenshot so it
 * reads at the size Jira shows a thumbnail.
 */
export function markImage(image: PNG, marks: BugMark[]): Buffer {
  const out = new PNG({ width: image.width, height: image.height });
  image.data.copy(out.data);
  const scale = Math.max(1, Math.round(image.width / 360));
  for (const mark of marks) {
    drawFrame(out, mark, 2 * scale);
    drawBadge(out, mark, scale);
  }
  return PNG.sync.write(out);
}

function put(out: PNG, x: number, y: number, color: number[]): void {
  if (x < 0 || y < 0 || x >= out.width || y >= out.height) return;
  out.data.set([...color, 255], (y * out.width + x) * 4);
}

function drawFrame(out: PNG, mark: BugMark, width: number): void {
  const x0 = Math.max(0, mark.x);
  const y0 = Math.max(0, mark.y);
  const x1 = Math.min(out.width - 1, mark.x + mark.width - 1);
  const y1 = Math.min(out.height - 1, mark.y + mark.height - 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const onEdge = x - x0 < width || x1 - x < width || y - y0 < width || y1 - y < width;
      if (onEdge) put(out, x, y, MARK);
    }
  }
}

function drawBadge(out: PNG, mark: BugMark, scale: number): void {
  const text = String(mark.n);
  const pixel = 2 * scale;
  const textWidth = text.length * 4 * pixel - pixel;
  const radius = Math.ceil(Math.max(textWidth, 5 * pixel) / 2 + 3 * scale);
  // the badge sits on the frame's corner, pushed inside the screenshot when the corner is at an edge
  const cx = Math.min(out.width - radius, Math.max(radius, mark.x));
  const cy = Math.min(out.height - radius, Math.max(radius, mark.y));
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius) put(out, cx + x, cy + y, MARK);
    }
  }
  const left = cx - Math.floor(textWidth / 2);
  const top = cy - Math.floor((5 * pixel) / 2);
  [...text].forEach((digit, index) => {
    DIGITS[digit].forEach((row, ry) =>
      [...row].forEach((on, rx) => {
        if (on !== '1') return;
        for (let dy = 0; dy < pixel; dy++) {
          for (let dx = 0; dx < pixel; dx++)
            put(out, left + (index * 4 + rx) * pixel + dx, top + ry * pixel + dy, WHITE);
        }
      })
    );
  });
}
