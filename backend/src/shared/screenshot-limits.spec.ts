import { PNG } from 'pngjs';
import { generatePng } from '../_data_';
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
});
