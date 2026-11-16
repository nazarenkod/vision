import { deflateSync } from 'zlib';

/*
 * PNG files built by hand for tests: every colour type and depth, interlaced or not, with the
 * chunks real encoders add, and the malformed files an attacker sends. pngjs writes only a few
 * kinds of PNG, and none interlaced, so the tests make their own.
 */

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function pngChunk(type: string, data: Buffer = Buffer.alloc(0)): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function ihdr(width: number, height: number, depth = 8, colorType = 6, interlace = 0): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = depth;
  data[9] = colorType;
  data[12] = interlace;
  return pngChunk('IHDR', data);
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

// Adam7: where each of the seven passes starts and how far it steps
const PASSES = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

export interface PngSpec {
  width: number;
  height: number;
  depth?: 8 | 16;
  colorType?: 0 | 2 | 3 | 4 | 6;
  interlace?: boolean;
  // split the image data over this many IDAT chunks
  idatChunks?: number;
  // ancillary chunks before and after the image data, as encoders write them
  extraChunks?: boolean;
  seed?: number;
}

/** The scanlines of an image (filter type 0 on every row), interlaced or not. */
function scanlines(spec: Required<PngSpec>): Buffer {
  const { width, height, depth, colorType, seed } = spec;
  const bytesPerPixel = (CHANNELS[colorType] * depth) / 8;
  const sample = (x: number, y: number, i: number) => (x * 31 + y * 17 + i * 7 + seed * 13) & 0xff;
  const rows = (passWidth: number, passHeight: number, at: (px: number, py: number) => [number, number]) => {
    const out: Buffer[] = [];
    for (let py = 0; py < passHeight; py++) {
      const row = Buffer.alloc(1 + passWidth * bytesPerPixel);
      for (let px = 0; px < passWidth; px++) {
        const [x, y] = at(px, py);
        for (let i = 0; i < bytesPerPixel; i++) {
          // a palette index must point at an entry the palette has
          row[1 + px * bytesPerPixel + i] = colorType === 3 ? sample(x, y, 0) % 16 : sample(x, y, i);
        }
      }
      out.push(row);
    }
    return out;
  };
  if (!spec.interlace) return Buffer.concat(rows(width, height, (x, y) => [x, y]));
  return Buffer.concat(
    PASSES.flatMap(([x0, y0, dx, dy]) => {
      const passWidth = Math.ceil((width - x0) / dx);
      const passHeight = Math.ceil((height - y0) / dy);
      return passWidth > 0 && passHeight > 0
        ? rows(passWidth, passHeight, (px, py) => [x0 + px * dx, y0 + py * dy])
        : [];
    })
  );
}

export function buildPng(input: PngSpec): Buffer {
  const spec: Required<PngSpec> = {
    depth: 8,
    colorType: 6,
    interlace: false,
    idatChunks: 1,
    extraChunks: false,
    seed: 1,
    ...input,
  };
  const data = deflateSync(scanlines(spec));
  const parts = Math.max(1, spec.idatChunks);
  const size = Math.ceil(data.length / parts);
  const idats = Array.from({ length: parts }, (_, i) => pngChunk('IDAT', data.subarray(i * size, (i + 1) * size)));
  const palette =
    spec.colorType === 3
      ? [pngChunk('PLTE', Buffer.from(Array.from({ length: 16 * 3 }, (_, i) => (i * 37) & 0xff)))]
      : [];
  const before = spec.extraChunks
    ? [pngChunk('gAMA', Buffer.from([0, 0, 0xb1, 0x8f])), pngChunk('tEXt', Buffer.from('Software\0Appium'))]
    : [];
  const after = spec.extraChunks ? [pngChunk('tEXt', Buffer.from('Comment\0after the image'))] : [];
  return Buffer.concat([
    PNG_SIGNATURE,
    ihdr(spec.width, spec.height, spec.depth, spec.colorType, spec.interlace ? 1 : 0),
    ...before,
    ...palette,
    ...idats,
    ...after,
    pngChunk('IEND'),
  ]);
}
