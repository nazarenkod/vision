import { PNG, PNGWithMetadata } from 'pngjs';
import { inflateSync } from 'zlib';

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

interface PngHeader {
  width: number;
  height: number;
  depth: number;
  colorType: number;
  interlace: number;
}

const asBuffer = (buffer: Buffer | Uint8Array) => Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);

const isPng = (bytes: Buffer) =>
  bytes.length >= 24 && bytes.subarray(0, 8).equals(PNG_SIGNATURE) && bytes.toString('latin1', 12, 16) === 'IHDR';

/**
 * Every IHDR in the file and its image data, read from the chunk headers without unpacking
 * anything. A PNG has one IHDR, but pngjs takes the last it meets: a small first one used to
 * hide a huge second one from the limit (VIS-SEC-045). Stops at IEND, as pngjs does.
 */
function pngChunks(bytes: Buffer): { headers: PngHeader[]; data: Buffer[] } {
  const headers: PngHeader[] = [];
  const data: Buffer[] = [];
  for (let at = 8; at + 8 <= bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('latin1', at + 4, at + 8);
    const start = at + 8;
    if (start + length > bytes.length) break;
    if (type === 'IHDR' && length >= 13) {
      headers.push({
        width: bytes.readUInt32BE(start),
        height: bytes.readUInt32BE(start + 4),
        depth: bytes[start + 8],
        colorType: bytes[start + 9],
        interlace: bytes[start + 12],
      });
    } else if (type === 'IDAT') {
      data.push(bytes.subarray(start, start + length));
    } else if (type === 'IEND') {
      break;
    }
    at = start + length + 4;
  }
  return { headers, data };
}

/** The header claiming the most pixels: the one the limit is about, whichever pngjs ends up using. */
function largestHeader(bytes: Buffer): PngHeader | null {
  if (!isPng(bytes)) return null;
  const { headers } = pngChunks(bytes);
  return headers.reduce<PngHeader | null>(
    (largest, header) => (!largest || header.width * header.height > largest.width * largest.height ? header : largest),
    null
  );
}

/** Width and height a PNG claims in its header; null when the bytes are not a PNG. */
export function readPngSize(buffer: Buffer | Uint8Array | null | undefined): { width: number; height: number } | null {
  if (!buffer) return null;
  const bytes = asBuffer(buffer);
  if (!isPng(bytes)) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
// Adam7: where each of the seven passes starts and how far it steps, as pngjs walks them
const PASSES = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

/** How many bytes the image data of an interlaced PNG unpacks to: the seven passes, a filter byte a row. */
function interlacedSize({ width, height, depth, colorType }: PngHeader): number {
  const bitsPerPixel = (CHANNELS[colorType] ?? 4) * depth;
  return PASSES.reduce((total, [x0, y0, dx, dy]) => {
    const passWidth = Math.ceil((width - x0) / dx);
    const passHeight = Math.ceil((height - y0) / dy);
    return passWidth > 0 && passHeight > 0 ? total + (((passWidth * bitsPerPixel + 7) >> 3) + 1) * passHeight : total;
  }, 0);
}

/**
 * pngjs bounds the unpacking of a plain PNG by the size its header claims, but unpacks an
 * interlaced one with no bound and only then finds there is too much: 50 MB of data could
 * become gigabytes first. A file with more data than its size refuses either way, so it is
 * refused here before any of it is kept (VIS-SEC-045).
 */
function checkInterlacedData(bytes: Buffer): void {
  const { headers, data } = pngChunks(bytes);
  const header = headers[headers.length - 1];
  if (!header?.interlace) return;
  try {
    inflateSync(Buffer.concat(data), { maxOutputLength: Math.max(1, interlacedSize(header)) });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
      throw new Error(`Image data unpacks to more than ${header.width} × ${header.height} pixels`);
    }
    // anything else wrong with the data pngjs reports as it always has
  }
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
  const largest = largestHeader(asBuffer(buffer));
  if (largest.width * largest.height > limits.maxPixels) {
    return {
      status: 413,
      message: `The screenshot is ${largest.width} × ${largest.height} pixels, more than the ${limits.maxPixels} pixels Vision takes`,
    };
  }
  return null;
}

/** Whether a stored image may be decoded: files from before the intake check are not trusted either. */
export function safeToDecode(buffer: Buffer | Uint8Array | null | undefined, limits = screenshotLimits()): boolean {
  const largest = buffer ? largestHeader(asBuffer(buffer)) : null;
  return !!largest && largest.width * largest.height <= limits.maxPixels;
}

/** PNG.sync.read, but only for an image whose headers claim no more pixels than Vision takes. */
export function readPng(buffer: Buffer, limits = screenshotLimits()): PNGWithMetadata {
  if (!safeToDecode(buffer, limits)) {
    const largest = largestHeader(asBuffer(buffer));
    throw new Error(
      largest ? `Image of ${largest.width} × ${largest.height} pixels is too large to decode` : 'Not a PNG image'
    );
  }
  checkInterlacedData(asBuffer(buffer));
  return PNG.sync.read(buffer);
}
