import { PNG, PNGWithMetadata } from 'pngjs';

// A PNG unpacks to 4 bytes per pixel whatever its file size: a few kilobytes that claim
// 30000 × 30000 pixels decode into 3.6 GB and take the API down for everyone (VIS-SEC-014).
// So the claimed size is read from the header and checked before anything decodes the image.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MIB = 1024 * 1024;

// A phone or tablet screenshot is 1–15 Mpx and a few MB; a long full-page one 30 Mpx.
export const DEFAULT_MAX_SCREENSHOT_MB = 50;
export const DEFAULT_MAX_SCREENSHOT_PIXELS = 40_000_000;

export interface ScreenshotLimits {
  maxBytes: number;
  maxPixels: number;
}

const positive = (value: string | undefined, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

export function screenshotLimits(env: NodeJS.ProcessEnv = process.env): ScreenshotLimits {
  return {
    maxBytes: Math.round(positive(env.VISION_MAX_SCREENSHOT_MB, DEFAULT_MAX_SCREENSHOT_MB) * MIB),
    maxPixels: Math.round(positive(env.VISION_MAX_SCREENSHOT_PIXELS, DEFAULT_MAX_SCREENSHOT_PIXELS)),
  };
}

/** Width and height a PNG claims in its header; null when the bytes are not a PNG. */
export function readPngSize(buffer: Buffer | Uint8Array | null | undefined): { width: number; height: number } | null {
  if (!buffer || buffer.length < 24) return null;
  const bytes = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE) || bytes.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export interface ScreenshotProblem {
  // 400: not a screenshot at all; 413: a screenshot too large to take
  status: 400 | 413;
  message: string;
}

export function screenshotProblem(
  buffer: Buffer | Uint8Array | null | undefined,
  limits: ScreenshotLimits = screenshotLimits()
): ScreenshotProblem | null {
  if (buffer && buffer.length > limits.maxBytes) {
    return { status: 413, message: `The screenshot is larger than ${Math.round(limits.maxBytes / MIB)} MB` };
  }
  const size = readPngSize(buffer);
  if (!size || !size.width || !size.height) return { status: 400, message: 'The screenshot is not a PNG image' };
  if (size.width * size.height > limits.maxPixels) {
    return {
      status: 413,
      message: `The screenshot is ${size.width} × ${size.height} pixels, more than the ${limits.maxPixels} pixels Vision takes`,
    };
  }
  return null;
}

/** Whether a stored image may be decoded: files from before the intake check are not trusted either. */
export function safeToDecode(buffer: Buffer | Uint8Array | null | undefined, limits = screenshotLimits()): boolean {
  const size = readPngSize(buffer);
  return !!size && size.width * size.height <= limits.maxPixels;
}

/** PNG.sync.read, but only for an image whose header claims no more pixels than Vision takes. */
export function readPng(buffer: Buffer, limits = screenshotLimits()): PNGWithMetadata {
  if (!safeToDecode(buffer, limits)) {
    const size = readPngSize(buffer);
    throw new Error(size ? `Image of ${size.width} × ${size.height} pixels is too large to decode` : 'Not a PNG image');
  }
  return PNG.sync.read(buffer);
}
