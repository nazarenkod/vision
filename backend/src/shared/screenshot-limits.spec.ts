import { PNG } from 'pngjs';
import { generatePng } from '../_data_';
import { deflateSync } from 'zlib';
import { buildPng, ihdr, pngChunk, PNG_SIGNATURE } from './png-test-files';
import { readPng, readPngSize, safeToDecode, screenshotLimits, screenshotProblem } from './screenshot-limits';

const png = (width: number, height: number) => Buffer.from(PNG.sync.write(generatePng(width, height)));
// a small file whose header claims another size, as a decompression bomb does
function claiming(width: number, height: number): Buffer {
  const bytes = png(1, 1);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}
const limits = { maxBytes: 1024 * 1024, maxPixels: 10_000 };

describe('screenshot limits', () => {
  it('reads the size a PNG claims from its header, without decoding it', () => {
    expect(readPngSize(png(3, 2))).toEqual({ width: 3, height: 2 });
    expect(readPngSize(claiming(30000, 30000))).toEqual({ width: 30000, height: 30000 });
  });

  it('does not take what is not a PNG', () => {
    expect(readPngSize(Buffer.from('GIF89a and some more bytes after it'))).toBeNull();
    expect(screenshotProblem(Buffer.from('<html></html>'), limits)).toEqual({
      status: 400,
      message: 'The screenshot is not a PNG image',
    });
    expect(screenshotProblem(undefined, limits)?.status).toBe(400);
  });

  it('takes a screenshot within the limits', () => {
    expect(screenshotProblem(png(100, 100), limits)).toBeNull();
  });

  it('turns away a screenshot that claims more pixels than the limit, however small the file', () => {
    const problem = screenshotProblem(claiming(30000, 30000), limits);

    expect(problem).toMatchObject({ status: 413 });
    expect(problem.message).toContain('30000 × 30000');
  });

  it('turns away a file larger than the limit', () => {
    const big = Buffer.concat([png(1, 1), Buffer.alloc(limits.maxBytes)]);

    expect(screenshotProblem(big, limits)).toMatchObject({
      status: 413,
      message: 'The screenshot is larger than 1 MB',
    });
  });

  it('refuses to decode a stored image that claims too many pixels', () => {
    expect(safeToDecode(png(10, 10), limits)).toBe(true);
    expect(safeToDecode(claiming(30000, 30000), limits)).toBe(false);
    expect(() => readPng(claiming(30000, 30000), limits)).toThrow('too large to decode');
    expect(readPng(png(4, 3), limits)).toMatchObject({ width: 4, height: 3 });
  });

  it('takes the limits from the environment, defaults for anything unset or wrong', () => {
    expect(screenshotLimits({})).toEqual({ maxBytes: 50 * 1024 * 1024, maxPixels: 40_000_000 });
    expect(screenshotLimits({ VISION_MAX_SCREENSHOT_MB: '10', VISION_MAX_SCREENSHOT_PIXELS: 'lots' })).toEqual({
      maxBytes: 10 * 1024 * 1024,
      maxPixels: 40_000_000,
    });
  });

  describe('a file that shows one size and decodes to another (VIS-SEC-045)', () => {
    // pngjs takes the last header it meets, so a small first one hid a huge second one
    const twoHeaders = (width: number, height: number) =>
      Buffer.concat([
        PNG_SIGNATURE,
        ihdr(10, 10),
        ihdr(width, height),
        pngChunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))),
        pngChunk('IEND'),
      ]);

    it('turns away a PNG whose second header claims more pixels than the limit', () => {
      const problem = screenshotProblem(twoHeaders(200, 100), limits);

      expect(problem).toMatchObject({ status: 413 });
      expect(problem.message).toContain('200 × 100');
      expect(safeToDecode(twoHeaders(200, 100), limits)).toBe(false);
      expect(() => readPng(twoHeaders(200, 100), limits)).toThrow('too large to decode');
    });

    it('still reads the size from the first header', () => {
      expect(readPngSize(twoHeaders(200, 100))).toEqual({ width: 10, height: 10 });
    });

    // pngjs unpacks an interlaced image with no bound, and only then sees there is too much
    it('stops unpacking an interlaced PNG at the size its header claims', () => {
      const bomb = Buffer.concat([
        PNG_SIGNATURE,
        ihdr(10, 10, 8, 6, 1),
        pngChunk('IDAT', deflateSync(Buffer.alloc(64 * 1024 * 1024))),
        pngChunk('IEND'),
      ]);
      const before = process.memoryUsage().arrayBuffers;

      expect(() => readPng(bomb, limits)).toThrow('unpacks to more than');
      expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(16 * 1024 * 1024);
    });

    it('decodes an interlaced screenshot as before', () => {
      const png = readPng(buildPng({ width: 37, height: 23, interlace: true }), limits);

      expect(png).toMatchObject({ width: 37, height: 23 });
    });
  });

  // found in review: a header cut short made the intake throw, a 500 instead of a refusal
  it('refuses a header cut short or longer than the file as not a PNG', () => {
    const whole = png(4, 3);
    const cut = whole.subarray(0, 24);
    const shortHeader = Buffer.from(whole);
    shortHeader.writeUInt32BE(12, 8);
    const overlong = Buffer.from(whole);
    overlong.writeUInt32BE(0xffffffff, 8);
    for (const file of [cut, whole.subarray(0, 28), shortHeader, overlong]) {
      expect(screenshotProblem(file, limits)).toEqual({ status: 400, message: 'The screenshot is not a PNG image' });
      expect(safeToDecode(file, limits)).toBe(false);
      expect(() => readPng(file, limits)).toThrow('Not a PNG image');
    }
  });

  it('reads the headers of a file of a million tiny chunks quickly', () => {
    const empty = pngChunk('IDAT');
    const file = Buffer.concat([
      PNG_SIGNATURE,
      ihdr(100, 100),
      Buffer.concat(Array(1_000_000).fill(empty)),
      pngChunk('IEND'),
    ]);
    const started = Date.now();
    expect(screenshotProblem(file)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
