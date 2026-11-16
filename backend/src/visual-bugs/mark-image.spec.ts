import { PNG } from 'pngjs';
import { markImage } from './mark-image';

const BLUE = [23, 92, 211];
const WHITE = [255, 255, 255];

const blank = (width: number, height: number) => {
  const image = new PNG({ width, height });
  image.data.fill(255);
  return image;
};
const pixelOf = (png: PNG, x: number, y: number) =>
  Array.from(png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3));

describe('markImage', () => {
  it('draws a numbered frame and leaves the rest alone', () => {
    const image = blank(360, 600);
    const out = PNG.sync.read(markImage(image, [{ n: 1, x: 100, y: 200, width: 120, height: 60 }]));

    // the frame: its bottom edge, far from the badge
    expect(pixelOf(out, 160, 259)).toEqual(BLUE);
    // inside the frame and elsewhere nothing changes
    expect(pixelOf(out, 160, 230)).toEqual(WHITE);
    expect(pixelOf(out, 10, 10)).toEqual(WHITE);
    // the badge on the top-left corner is blue with a white digit in it
    const badge = [];
    for (let y = 190; y <= 210; y++) for (let x = 90; x <= 110; x++) badge.push(pixelOf(out, x, y).join());
    expect(badge).toContain(BLUE.join());
    expect(badge).toContain(WHITE.join());
    // the source image is untouched
    expect(pixelOf(image, 160, 259)).toEqual(WHITE);
  });

  it('keeps a badge on a corner at the edge inside the screenshot', () => {
    const out = PNG.sync.read(markImage(blank(360, 600), [{ n: 12, x: 0, y: 0, width: 50, height: 50 }]));
    expect(pixelOf(out, 1, 8)).toEqual(BLUE);
    expect(out.width).toBe(360);
  });
});
