import { PNG } from 'pngjs';
import Pixelmatch from 'pixelmatch';
import { IgnoreAreaDto } from '../../../test-runs/dto/ignore-area.dto';
import { applyIgnoreAreas, scaleImageToSize } from '../../utils';
import { signatureOfDecoded } from './signature.core';
import { encodeThumbnail } from './thumbnail.core';
import { DiffRegion, findDiffRegions } from './regions.core';

/**
 * CPU-bound part of the pixelmatch comparison, extracted so it can run inside
 * a worker thread (see pixelmatch.worker.ts / DiffWorkerPool): PNG decode,
 * scaling, pixelmatch and diff encode of full-size screenshots block the event
 * loop for ~a second each, which makes the whole API unresponsive during
 * build ingestion. All input/output must stay structured-clone serializable.
 */
export interface PixelmatchJobInput {
  kind: 'diff';
  baseline: Buffer | Uint8Array;
  image: Buffer | Uint8Array;
  ignoreAreas: IgnoreAreaDto[];
  threshold: number;
  includeAA: boolean;
  allowDiffDimensions: boolean;
  diffTolerancePercent: number;
  saveDiff: boolean;
  /**
   * Also produce the change signature the variations dialog matches on. Free
   * here next to the diff — the images are decoded already — and computed once
   * at ingest so reviewing never has to fetch and decode a build's screenshots
   * again just to group them.
   */
  withSignature?: boolean;
  /**
   * Also return small PNGs of the checkpoint and of the diff. The grids draw
   * these a hundred-odd pixels wide; sending the full-size files and letting
   * CSS shrink them is what made opening the variations dialog cost megabytes.
   */
  withThumbnails?: boolean;
  /**
   * Also return bounding boxes of the changed areas, for mapping a change to
   * the UI element under it and for cropping it for AI. Read off the diff that
   * is already in memory.
   */
  withRegions?: boolean;
  /**
   * Elements that moved without changing size, in baseline (from) and image
   * (to) pixels. Each is copied to its new place in the baseline before the
   * comparison, so a shift on its own is not a difference.
   */
  moves?: Array<{ from: AreaRect; to: AreaRect }>;
  /**
   * Areas where a change covering at most maxDiffPercent of the area's pixels
   * is not counted (images, maps, charts that re-render slightly).
   */
  toleranceAreas?: Array<AreaRect & { maxDiffPercent: number }>;
}

export interface AreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelmatchJobOutput {
  equal?: boolean;
  isSameDimension?: boolean;
  pixelMisMatchCount?: number;
  diffPercent?: number;
  diffBuffer?: Buffer | Uint8Array;
  // absent when not asked for, when the screenshots are identical, or when
  // their dimensions differ and there is nothing meaningful to sign
  signature?: number[];
  // absent when not asked for, or when the screenshots matched and there is
  // nothing to show
  imageThumbnail?: Buffer | Uint8Array;
  diffThumbnail?: Buffer | Uint8Array;
  // absent when not asked for or when the diff is not kept
  regions?: DiffRegion[];
  // changed pixels left out because they fell under an area's tolerance
  toleratedPixels?: number;
}

function clonePng(source: PNG): PNG {
  const copy = new PNG({ width: source.width, height: source.height });
  source.data.copy(copy.data);
  return copy;
}

/** The baseline with every moved element copied to where it is now. */
export function shiftBaseline(baseline: PNG, moves: Array<{ from: AreaRect; to: AreaRect }>): PNG {
  const shifted = clonePng(baseline);
  for (const { from, to } of moves) {
    // clamp the copy to both images, keeping source and target aligned
    const left = Math.max(0, -from.x, -to.x);
    const top = Math.max(0, -from.y, -to.y);
    const width = Math.min(from.width, baseline.width - from.x, baseline.width - to.x) - left;
    const height = Math.min(from.height, baseline.height - from.y, baseline.height - to.y) - top;
    if (width <= 0 || height <= 0) continue;
    PNG.bitblt(baseline, shifted, from.x + left, from.y + top, width, height, to.x + left, to.y + top);
  }
  return shifted;
}

const isDiffPixel = (data: Buffer | Uint8Array, i: number) => data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0;

/**
 * Clears changed pixels inside each area whose change stays within its
 * tolerance. Returns how many pixels were cleared.
 */
export function applyTolerance(
  diff: { width: number; height: number; data: Buffer | Uint8Array },
  areas: Array<AreaRect & { maxDiffPercent: number }>
): number {
  let cleared = 0;
  for (const area of areas) {
    const x0 = Math.max(0, Math.floor(area.x));
    const y0 = Math.max(0, Math.floor(area.y));
    const x1 = Math.min(diff.width, Math.ceil(area.x + area.width));
    const y1 = Math.min(diff.height, Math.ceil(area.y + area.height));
    const size = (x1 - x0) * (y1 - y0);
    if (size <= 0) continue;
    let changed = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) if (isDiffPixel(diff.data, (y * diff.width + x) * 4)) changed++;
    }
    if (!changed || (changed * 100) / size > area.maxDiffPercent) continue;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * diff.width + x) * 4;
        if (isDiffPixel(diff.data, i)) {
          // the faded grey pixelmatch draws for unchanged pixels
          diff.data[i] = diff.data[i + 1] = diff.data[i + 2] = 230;
          cleared++;
        }
      }
    }
  }
  return cleared;
}

// postMessage turns Buffers into Uint8Array views over their own ArrayBuffer.
function toBuffer(data: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

export function computePixelmatchDiff(input: PixelmatchJobInput): PixelmatchJobOutput {
  const baseline = PNG.sync.read(toBuffer(input.baseline));
  const image = PNG.sync.read(toBuffer(input.image));

  if (baseline.data.equals(new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength))) {
    return { equal: true };
  }

  const isSameDimension = baseline.width === image.width && baseline.height === image.height;
  if (!isSameDimension && !input.allowDiffDimensions) {
    return { equal: false, isSameDimension };
  }

  // scale image to max size
  const maxWidth = Math.max(baseline.width, image.width);
  const maxHeight = Math.max(baseline.height, image.height);
  const scaledBaseline = scaleImageToSize(baseline, maxWidth, maxHeight);
  const scaledImage = scaleImageToSize(image, maxWidth, maxHeight);

  // move shifted elements to their new place, then apply ignore areas to both
  const baselineShifted = input.moves?.length ? shiftBaseline(scaledBaseline, input.moves) : scaledBaseline;
  const baselineIgnored = applyIgnoreAreas(baselineShifted, input.ignoreAreas);
  const imageIgnored = applyIgnoreAreas(scaledImage, input.ignoreAreas);

  // compare
  const diff = new PNG({
    width: maxWidth,
    height: maxHeight,
  });
  const rawMisMatchCount = Pixelmatch(baselineIgnored.data, imageIgnored.data, diff.data, maxWidth, maxHeight, {
    includeAA: input.includeAA,
    threshold: input.threshold,
  });
  const toleratedPixels = input.toleranceAreas?.length ? applyTolerance(diff, input.toleranceAreas) : 0;
  const pixelMisMatchCount = rawMisMatchCount - toleratedPixels;
  const diffPercent = (pixelMisMatchCount * 100) / (scaledImage.width * scaledImage.height);

  // A build is mostly runs that pass, so anything produced for a diff that is
  // about to be thrown away is work nobody ever sees the result of.
  const keepingTheDiff = diffPercent > input.diffTolerancePercent && input.saveDiff;

  let diffBuffer: Buffer;
  if (keepingTheDiff) {
    diffBuffer = PNG.sync.write(diff);
  }

  // Same source images, same ignore areas, same threshold as the standalone
  // signature job — sharing signatureOfDecoded is what keeps the two answers
  // identical, so a stored signature still matches one computed on the fly.
  const signature =
    input.withSignature && isSameDimension
      ? signatureOfDecoded(baselineIgnored, imageIgnored, {
          threshold: input.threshold,
          includeAA: input.includeAA,
        })
      : null;

  const thumbnails =
    input.withThumbnails && keepingTheDiff
      ? { imageThumbnail: encodeThumbnail(imageIgnored), diffThumbnail: encodeThumbnail(diff) }
      : {};

  const regions = input.withRegions && keepingTheDiff ? findDiffRegions(diff) : null;

  return {
    equal: false,
    isSameDimension,
    pixelMisMatchCount,
    diffPercent,
    diffBuffer,
    ...(signature ? { signature } : {}),
    ...thumbnails,
    ...(regions?.length ? { regions } : {}),
    ...(toleratedPixels ? { toleratedPixels } : {}),
  };
}
