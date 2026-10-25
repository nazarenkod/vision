import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from './ui-tree.parser';
import { compareAcrossDevices } from './cross-device';

const xml = readFileSync(path.join(__dirname, '__fixtures__', 'android-payment.xml'), 'utf8');
const parse = (source: string, width = 1080, height = 2400, densityDpi = 420) =>
  parseUiTree(source, { imageWidth: width, imageHeight: height, densityDpi });

describe('compareAcrossDevices', () => {
  it('finds nothing to report for the same screen laid out for another size', () => {
    // a smaller, denser screen: every position and size differs, which is not reported
    const smaller = xml.replace(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g, (_, x0, y0, x1, y1) => {
      const scale = (value: string) => Math.round(Number(value) * 0.66);
      return `bounds="[${scale(x0)},${scale(y0)}][${scale(x1)},${scale(y1)}]"`;
    });
    const report = compareAcrossDevices(parse(xml), parse(smaller, 720, 1600, 320));
    expect(report.compared).toBeGreaterThan(3);
    expect(report.differences).toEqual([]);
    expect(report.notFound).toEqual([]);
    expect(report.onlyHere).toBe(0);
  });

  it('reports a found element whose state or label differs', () => {
    const here = xml
      .replace(
        'resource-id="com.bank.app:id/btn_pay" clickable="true" enabled="true"',
        'resource-id="com.bank.app:id/btn_pay" clickable="true" enabled="false"'
      )
      .replace('content-desc="Help"', 'content-desc="Support"');
    const report = compareAcrossDevices(parse(xml), parse(here));
    expect(report.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'id:com.bank.app:id/btn_pay',
          field: 'state',
          reference: 'default',
          here: 'disabled',
        }),
        expect.objectContaining({
          key: 'id:com.bank.app:id/btn_help',
          field: 'label',
          reference: 'Help',
          here: 'Support',
        }),
      ])
    );
  });

  it('lists elements it cannot find without calling them missing', () => {
    const here = xml.replace(/<android\.widget\.Button[^>]*btn_pay[^>]*\/>/, '');
    const report = compareAcrossDevices(parse(xml), parse(here));
    expect(report.notFound.map((item) => item.key)).toContain('id:com.bank.app:id/btn_pay');
    expect(report.differences).toEqual([]);
  });
});
