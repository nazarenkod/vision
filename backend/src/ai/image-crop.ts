import { PNG } from 'pngjs';
import { downscale } from '../compare/utils';
import { Rect } from '../ui-tree/ui-tree.types';

/**
 * A small PNG of one area of a screenshot, padded for context and shrunk so
 * its longest side is at most `maxSide`. Small crops are what keeps AI calls
 * cheap: a 256 px crop costs a fraction of a full-page screenshot.
 */
export function cropPng(image: PNG, rect: Rect, options: { padding?: number; maxSide?: number } = {}): Buffer {
  const padding = options.padding ?? 16;
  const x0 = Math.max(0, Math.floor(rect.x - padding));
  const y0 = Math.max(0, Math.floor(rect.y - padding));
  const x1 = Math.min(image.width, Math.ceil(rect.x + rect.width + padding));
  const y1 = Math.min(image.height, Math.ceil(rect.y + rect.height + padding));
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const crop = new PNG({ width, height });
  PNG.bitblt(image, crop, x0, y0, width, height, 0, 0);
  const small = downscale({ data: crop.data, width, height }, options.maxSide ?? 384);
  const out = new PNG({ width: small.width, height: small.height });
  small.data.copy(out.data);
  return PNG.sync.write(out);
}
