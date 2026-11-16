import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { generatePng } from '../_data_';
import { buildPng, PngSpec } from './png-test-files';
import { readPng, readPngSize, safeToDecode, screenshotProblem } from './screenshot-limits';

/*
 * Pins what intake and decoding do today with every kind of real PNG, so that closing the
 * bypass of the pixel limit (VIS-SEC-045) cannot turn away, or decode differently, a single
 * screenshot that works now. The snapshots were taken before the change.
 */

const testImage = (name: string) => readFileSync(path.join(__dirname, '..', '..', 'test', name));

const built: Record<string, PngSpec> = {
  'rgba 8': { width: 37, height: 23 },
  'rgb 8': { width: 37, height: 23, colorType: 2 },
  'grey 8': { width: 37, height: 23, colorType: 0 },
  'grey + alpha 8': { width: 37, height: 23, colorType: 4 },
  'palette 8': { width: 37, height: 23, colorType: 3 },
  'rgba 16': { width: 37, height: 23, depth: 16 },
  'rgb 16': { width: 37, height: 23, depth: 16, colorType: 2 },
  'grey 16': { width: 37, height: 23, depth: 16, colorType: 0 },
  'interlaced rgba 8': { width: 37, height: 23, interlace: true },
  'interlaced rgb 16': { width: 37, height: 23, depth: 16, colorType: 2, interlace: true },
  'interlaced palette': { width: 37, height: 23, colorType: 3, interlace: true },
  'interlaced 1 × 1': { width: 1, height: 1, interlace: true },
  'interlaced 5 × 3, some passes empty': { width: 5, height: 3, interlace: true },
  'many IDAT chunks': { width: 64, height: 40, idatChunks: 9 },
  'chunks before and after the image': { width: 20, height: 10, extraChunks: true },
  'everything at once': { width: 50, height: 31, depth: 16, interlace: true, idatChunks: 4, extraChunks: true },
  '1 × 1': { width: 1, height: 1 },
  'one long row': { width: 4000, height: 1 },
  'one tall column': { width: 1, height: 4000 },
};

const files: Record<string, () => Buffer> = {
  'backend/test/image.png': () => testImage('image.png'),
  'backend/test/image_edited.png': () => testImage('image_edited.png'),
  'backend/test/image_edited_2.png': () => testImage('image_edited_2.png'),
  'pngjs, as the comparison writes them': () => Buffer.from(PNG.sync.write(generatePng(120, 80))),
  ...Object.fromEntries(Object.entries(built).map(([name, spec]) => [name, () => buildPng(spec)])),
};

const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex').slice(0, 16);
const outcome = (run: () => unknown) => {
  try {
    return run();
  } catch (error) {
    return `throws: ${(error as Error).message}`;
  }
};

const strict = { maxBytes: 1024 * 1024, maxPixels: 1000 };

describe('screenshot limits with real PNGs, as they are (characterization for VIS-SEC-045)', () => {
  for (const [name, read] of Object.entries(files)) {
    it(`treats ${name} as before`, () => {
      const bytes = read();
      expect({
        size: readPngSize(bytes),
        problem: screenshotProblem(bytes),
        problemUnderStrictLimits: screenshotProblem(bytes, strict),
        safeToDecode: safeToDecode(bytes),
        decoded: outcome(() => {
          const png = readPng(bytes);
          return {
            width: png.width,
            height: png.height,
            depth: png.depth,
            colorType: png.colorType,
            data: sha(png.data),
          };
        }),
      }).toMatchSnapshot();
    });
  }

  it('decodes exactly what pngjs decodes, pixel for pixel', () => {
    for (const read of Object.values(files)) {
      const bytes = read();
      expect(sha(readPng(bytes).data)).toBe(sha(PNG.sync.read(bytes).data));
    }
  });
});
