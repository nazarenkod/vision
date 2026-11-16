import { findDiffRegions } from './regions.core';

function diffImage(width: number, height: number) {
  const data = new Uint8Array(width * height * 4);
  // pixelmatch's faded grey for unchanged pixels
  for (let i = 0; i < width * height; i++) data.set([230, 230, 230, 255], i * 4);
  const paint = (x: number, y: number, w: number, h: number, rgb = [255, 0, 0]) => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) data.set([...rgb, 255], (yy * width + xx) * 4);
  };
  return { image: { width, height, data }, paint };
}

describe('findDiffRegions', () => {
  it('returns nothing for a diff without changed pixels', () => {
    const { image, paint } = diffImage(100, 100);
    paint(10, 10, 5, 5, [255, 255, 0]); // anti-aliasing only
    expect(findDiffRegions(image)).toEqual([]);
  });

  it('finds separate changes, largest first, aligned to 8 px cells', () => {
    const { image, paint } = diffImage(400, 400);
    paint(20, 20, 30, 10);
    paint(200, 300, 100, 60);

    expect(findDiffRegions(image)).toEqual([
      { x: 200, y: 296, width: 104, height: 64 },
      { x: 16, y: 16, width: 40, height: 16 },
    ]);
  });

  it('joins changes a few pixels apart into one region', () => {
    const { image, paint } = diffImage(200, 100);
    // letters of one label: small gaps between them
    paint(10, 40, 6, 12);
    paint(22, 40, 6, 12);
    paint(34, 40, 6, 12);

    expect(findDiffRegions(image)).toEqual([{ x: 8, y: 40, width: 32, height: 16 }]);
  });

  it('clips regions to the image size', () => {
    const { image, paint } = diffImage(30, 30);
    paint(25, 25, 5, 5);
    expect(findDiffRegions(image)).toEqual([{ x: 24, y: 24, width: 6, height: 6 }]);
  });
});
