import { PNG } from 'pngjs';
import { IgnoreAreaDto } from '../../test-runs/dto/ignore-area.dto';
import { generatePng } from '../../_data_';
import { applyIgnoreAreas } from '.';

describe('utils', () => {
  it.each<[PNG, IgnoreAreaDto[]]>([
    [generatePng(3, 3), []],
    [generatePng(3, 3), [{ x: 0, y: 0, width: 3, height: 3 }]],
    [generatePng(3, 3), [{ x: -3, y: -3, width: 3, height: 3 }]],
    [generatePng(3, 3), [{ x: 1, y: 1, width: 5, height: 5 }]],
  ])('applyIgnoreAreas', (image, ignoreAreas) => {
    expect(applyIgnoreAreas(image, ignoreAreas).data).toMatchSnapshot();
  });

  it('masks an area that starts far outside the image in no time, only inside the image', () => {
    const started = Date.now();
    const masked = applyIgnoreAreas(generatePng(4, 4), [{ x: -1e9, y: -1e9, width: 1e9 + 2, height: 1e9 + 2 }]);
    expect(Date.now() - started).toBeLessThan(1000);
    const alpha = (x: number, y: number) => masked.data[4 * (4 * y + x) + 3];
    expect([alpha(0, 0), alpha(1, 1)]).toEqual([0, 0]);
    expect(alpha(2, 2)).not.toBe(0);
  });
});
