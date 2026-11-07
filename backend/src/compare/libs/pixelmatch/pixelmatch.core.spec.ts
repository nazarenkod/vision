import { PNG } from 'pngjs';
import { computePixelmatchDiff } from './pixelmatch.core';
import { includeAAFor } from './pixelmatch.types';
import { computeChangeSignature } from './signature.core';
import { THUMBNAIL_MAX_DIMENSION } from './thumbnail.core';

const WIDTH = 60;
const HEIGHT = 60;

const png = (paint: (set: (x: number, y: number, rgb: [number, number, number]) => void) => void): Buffer => {
  const image = new PNG({ width: WIDTH, height: HEIGHT });
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    image.data[i * 4] = 255;
    image.data[i * 4 + 1] = 255;
    image.data[i * 4 + 2] = 255;
    image.data[i * 4 + 3] = 255;
  }
  paint((x, y, [r, g, b]) => {
    const index = (y * WIDTH + x) * 4;
    image.data[index] = r;
    image.data[index + 1] = g;
    image.data[index + 2] = b;
  });
  return PNG.sync.write(image);
};

const block = (left: number, top: number, rgb: [number, number, number]): Buffer =>
  png((set) => {
    for (let y = top; y < top + 12; y++) {
      for (let x = left; x < left + 12; x++) {
        set(x, y, rgb);
      }
    }
  });

const blank = png(() => undefined);
const RED: [number, number, number] = [255, 0, 0];

const diffJob = (
  baseline: Buffer,
  image: Buffer,
  withSignature: boolean,
  withThumbnails = false,
  { saveDiff = true, diffTolerancePercent = 0 } = {}
) =>
  computePixelmatchDiff({
    kind: 'diff',
    baseline,
    image,
    ignoreAreas: [],
    threshold: 0.1,
    includeAA: false,
    allowDiffDimensions: false,
    diffTolerancePercent,
    saveDiff,
    withSignature,
    withThumbnails,
  });

describe('computePixelmatchDiff with a signature', () => {
  // The whole point of computing it here is to reuse the decode the diff
  // already paid for. If the fused version answered differently from the
  // standalone one, stored signatures would stop matching computed ones and
  // variations would silently stop grouping.
  it('gives the same signature the standalone job would', () => {
    const image = block(10, 10, RED);

    const fused = diffJob(blank, image, true).signature;
    const standalone = computeChangeSignature({
      kind: 'signature',
      baseline: blank,
      image,
      ignoreAreas: [],
      threshold: 0.1,
      includeAA: false,
    }).signature;

    expect(fused).toEqual(standalone);
    expect(fused).not.toBeNull();
  });

  it('leaves the signature out when it was not asked for', () => {
    expect(diffJob(blank, block(10, 10, RED), false).signature).toBeUndefined();
  });

  it('has no signature when the screenshots are identical', () => {
    expect(diffJob(blank, blank, true).signature).toBeUndefined();
  });

  it('still reports the diff it was asked for', () => {
    const result = diffJob(blank, block(10, 10, RED), true);

    expect(result.equal).toBe(false);
    expect(result.pixelMisMatchCount).toBe(144);
  });
});

describe('computePixelmatchDiff with thumbnails', () => {
  // Made here from the pixels the diff has already decoded and already drawn,
  // so a thumbnail costs a resize rather than a second read of the screenshot.
  it('returns a small picture of both the checkpoint and the diff', () => {
    const result = diffJob(blank, block(10, 10, RED), false, true);

    const image = PNG.sync.read(Buffer.from(result.imageThumbnail));
    const diff = PNG.sync.read(Buffer.from(result.diffThumbnail));
    expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(THUMBNAIL_MAX_DIMENSION);
    expect(Math.max(diff.width, diff.height)).toBeLessThanOrEqual(THUMBNAIL_MAX_DIMENSION);
  });

  it('makes none when they were not asked for', () => {
    const result = diffJob(blank, block(10, 10, RED), false, false);

    expect(result.imageThumbnail).toBeUndefined();
    expect(result.diffThumbnail).toBeUndefined();
  });

  // A build is mostly runs that pass. Resizing two images for each of those,
  // when the diff they belong to is thrown away seconds later, is work nobody
  // ever sees the result of.
  it('makes none when the change is under tolerance', () => {
    const result = diffJob(blank, block(10, 10, RED), false, true, { diffTolerancePercent: 90 });

    expect(result.imageThumbnail).toBeUndefined();
    expect(result.diffThumbnail).toBeUndefined();
  });

  it('makes none when the caller is not keeping the diff', () => {
    const result = diffJob(blank, block(10, 10, RED), false, true, { saveDiff: false });

    expect(result.imageThumbnail).toBeUndefined();
  });

  // nothing to show and nothing to shrink
  it('makes none when the screenshots are identical', () => {
    expect(diffJob(blank, blank, false, true).imageThumbnail).toBeUndefined();
  });
});

describe('computePixelmatchDiff with measure areas', () => {
  const job = (image: Buffer, extra = {}) =>
    computePixelmatchDiff({
      kind: 'diff',
      baseline: blank,
      image,
      ignoreAreas: [],
      threshold: 0.1,
      includeAA: true,
      allowDiffDimensions: false,
      diffTolerancePercent: 0,
      saveDiff: false,
      ...extra,
    });
  // the red block covers 12 × 12 at 24, 24; the compared element is 24 × 24 around it
  const element = { x: 18, y: 18, width: 24, height: 24 };
  const outside = [
    { x: 0, y: 0, width: WIDTH, height: 18 },
    { x: 0, y: 42, width: WIDTH, height: 18 },
    { x: 0, y: 18, width: 18, height: 24 },
    { x: 42, y: 18, width: 18, height: 24 },
  ];

  it('measures the difference against the whole screenshot without them', () => {
    expect(job(block(24, 24, RED)).diffPercent).toBeCloseTo((144 * 100) / 3600);
  });

  it('measures it against the areas, each pixel once', () => {
    expect(job(block(24, 24, RED), { measureAreas: [element, element] }).diffPercent).toBe(25);
  });

  it('counts no change outside the compared elements', () => {
    const result = job(block(0, 0, RED), { ignoreAreas: outside, measureAreas: [element] });
    expect(result.pixelMisMatchCount).toBe(0);
    expect(result.diffPercent).toBe(0);
  });
});

describe('anti-aliasing setting', () => {
  // A disk whose edge is shaded by coverage, as any renderer does. Two radii a
  // fraction of a pixel apart are what the same screen looks like on another
  // GPU or Flutter engine: the shape is identical, only edge shades differ.
  const disk = (radius: number): Buffer => {
    const image = new PNG({ width: WIDTH, height: HEIGHT });
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        let covered = 0;
        for (let sy = 0; sy < 4; sy++) {
          for (let sx = 0; sx < 4; sx++) {
            const dx = x + (sx + 0.5) / 4 - WIDTH / 2;
            const dy = y + (sy + 0.5) / 4 - HEIGHT / 2;
            if (dx * dx + dy * dy <= radius * radius) covered++;
          }
        }
        const shade = Math.round(255 - (covered / 16) * 255);
        const index = (y * WIDTH + x) * 4;
        image.data.set([shade, shade, shade, 255], index);
      }
    }
    return PNG.sync.write(image);
  };

  const mismatches = (ignoreAntialiasing: boolean) =>
    computePixelmatchDiff({
      kind: 'diff',
      baseline: disk(20),
      image: disk(20.3),
      ignoreAreas: [],
      threshold: 0.1,
      includeAA: includeAAFor({ ignoreAntialiasing }),
      allowDiffDimensions: false,
      diffTolerancePercent: 0,
      saveDiff: false,
    }).pixelMisMatchCount;

  it('does not count edge shading as a change when the project ignores anti-aliasing', () => {
    expect(mismatches(true)).toBe(0);
  });

  it('counts edge shading as a change when the project does not ignore anti-aliasing', () => {
    expect(mismatches(false)).toBeGreaterThan(0);
  });
});
