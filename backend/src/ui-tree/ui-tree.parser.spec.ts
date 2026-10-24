import { readFileSync } from 'fs';
import path from 'path';
import { describeNode, detectFormat, parseAndroidBounds, parseUiTree } from './ui-tree.parser';

const fixture = (name: string) => readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');

describe('parseUiTree', () => {
  describe('Android (UiAutomator2)', () => {
    const xml = fixture('android-payment.xml');

    it('detects the format', () => {
      expect(detectFormat(xml)).toBe('appium-android');
    });

    it('flattens elements with pixel bounds and skips the hierarchy wrapper', () => {
      const tree = parseUiTree(xml, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });

      expect(tree.format).toBe('appium-android');
      expect(tree.scale).toBe(1);
      expect(tree.nodes[0].className).toBe('android.widget.FrameLayout');
      const scan = tree.nodes.find((n) => n.resourceId.endsWith('btn_scan_qr'));
      expect(scan.bounds).toEqual({ x: 930, y: 618, width: 90, height: 90 });
      expect(scan.clickable).toBe(true);
      expect(tree.nodes[scan.parent].className).toBe('android.widget.FrameLayout');
    });

    it('converts pixels to dp from the device density', () => {
      const tree = parseUiTree(xml, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
      expect(tree.pixelsPerDp).toBeCloseTo(2.625);
      expect(tree.pixelsPerDpEstimated).toBe(false);
    });

    it('estimates density when the client did not send it', () => {
      const tree = parseUiTree(xml, { imageWidth: 1080, imageHeight: 2400 });
      expect(tree.pixelsPerDp).toBeCloseTo(1080 / 411);
      expect(tree.pixelsPerDpEstimated).toBe(true);
    });

    it('gives every node a unique key, preferring resource ids', () => {
      const tree = parseUiTree(xml, { imageWidth: 1080, imageHeight: 2400 });
      const keys = tree.nodes.map((n) => n.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).toContain('id:com.bank.app:id/btn_pay');
      expect(keys).toContain('ImageButton:Navigate up');
    });

    it('scales bounds when the screenshot is smaller than the screen', () => {
      const tree = parseUiTree(xml, { imageWidth: 540, imageHeight: 1200, densityDpi: 420 });
      const pay = tree.nodes.find((n) => n.resourceId.endsWith('btn_pay'));
      expect(pay.bounds).toEqual({ x: 21, y: 1100, width: 498, height: 63 });
    });
  });

  describe('iOS (XCUITest)', () => {
    const xml = fixture('ios-payment.xml');

    it('detects the format and converts points to screenshot pixels', () => {
      const tree = parseUiTree(xml, { imageWidth: 1170, imageHeight: 2532 });

      expect(tree.format).toBe('appium-ios');
      expect(tree.scale).toBe(3);
      expect(tree.pixelsPerDp).toBe(3);
      const close = tree.nodes.find((n) => n.resourceId === 'closeButton');
      expect(close.bounds).toEqual({ x: 1020, y: 168, width: 90, height: 90 });
      expect(close.clickable).toBe(true);
    });

    it('treats name as an identifier only when it differs from the label', () => {
      const tree = parseUiTree(xml, { imageWidth: 1170, imageHeight: 2532 });
      const pay = tree.nodes.find((n) => n.label === 'Pay');
      expect(pay.resourceId).toBe('');
      expect(pay.key).toBe('Button:Pay');
    });
  });

  it('rejects input that is not an Appium page source', () => {
    expect(() => parseUiTree('<html><body/></html>', { imageWidth: 1, imageHeight: 1 })).toThrow(
      'Unknown UI tree format'
    );
  });

  it('parses Android bounds strings', () => {
    expect(parseAndroidBounds('[0,63][1080,210]')).toEqual({ x: 0, y: 63, width: 1080, height: 147 });
    expect(parseAndroidBounds('')).toBeNull();
  });

  it('describes nodes for messages', () => {
    const tree = parseUiTree(fixture('android-payment.xml'), { imageWidth: 1080, imageHeight: 2400 });
    const pay = tree.nodes.find((n) => n.resourceId.endsWith('btn_pay'));
    expect(describeNode(pay)).toBe('Button "Pay" (id/btn_pay)');
  });
});
