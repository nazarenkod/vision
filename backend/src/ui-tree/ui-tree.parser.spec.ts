import { readFileSync } from 'fs';
import path from 'path';
import { describeNode, detectFormat, parseAndroidBounds, parseUiTree, textsInside } from './ui-tree.parser';
import { UiNode } from './ui-tree.types';

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

    it('ignores a screen density sent with an iOS tree: points are already device-independent', () => {
      const tree = parseUiTree(xml, { imageWidth: 1170, imageHeight: 2532, densityDpi: 480 });
      expect(tree.pixelsPerDp).toBe(3);
      expect(tree.pixelsPerDpEstimated).toBe(false);
    });

    it('treats name as an identifier only when it differs from the label', () => {
      const tree = parseUiTree(xml, { imageWidth: 1170, imageHeight: 2532 });
      const pay = tree.nodes.find((n) => n.label === 'Pay');
      expect(pay.resourceId).toBe('');
      expect(pay.key).toBe('Button:Pay');
    });
  });

  it('rejects input that is neither an Appium page source nor a web page', () => {
    // a web page is a tree of its own now (050)
    expect(() => parseUiTree('<svg><g/></svg>', { imageWidth: 1, imageHeight: 1 })).toThrow('Unknown UI tree format');
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

  it('marks a long name as cut instead of ending it mid-word', () => {
    const text = 'Курс євро. Продаж 49 Гривень 73 копійки. Купівля 48 Гривень 90 копійок. Оновлено сьогодні';
    const tree = parseUiTree(
      `<hierarchy><node class="android.widget.TextView" text="${text}" bounds="[0,0][500,100]" /></hierarchy>`,
      { imageWidth: 1080, imageHeight: 2400 }
    );
    const name = describeNode(tree.nodes.find((n) => n.text === text));
    expect(name).toMatch(/^TextView "Курс євро\. Продаж 49 Гривень 73 копійки\. .+…"$/);
    expect(Array.from(name.slice('TextView "'.length, -1))).toHaveLength(80);
  });

  it('keeps a name that fits whole', () => {
    const text = 'Курс євро. Продаж 49 Гривень 73 копійки';
    const tree = parseUiTree(
      `<hierarchy><node class="android.widget.TextView" text="${text}" bounds="[0,0][500,100]" /></hierarchy>`,
      { imageWidth: 1080, imageHeight: 2400 }
    );
    expect(describeNode(tree.nodes.find((n) => n.text === text))).toBe(`TextView "${text}"`);
  });

  it('shows emoji the dump wrote as character references', () => {
    const tree = parseUiTree(
      `<hierarchy><node class="android.widget.Button" text="Закинь на телефон&amp;#128241; &#x1F686;" resource-id="top_up" clickable="true" bounds="[0,0][500,100]" /></hierarchy>`,
      { imageWidth: 1080, imageHeight: 2400 }
    );
    const button = tree.nodes.find((n) => n.resourceId === 'top_up');
    expect(describeNode(button)).toBe('Button "Закинь на телефон📱 🚆" (top_up)');
    // the tree keeps the text as it came, so problem identities do not change
    expect(button.text).toContain('&#128241;');
  });
});

describe('parseUiTree with a plain uiautomator dump (adb, no Appium)', () => {
  const dump = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0"><node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.bank.app" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][1080,2400]"><node index="0" text="Pay" resource-id="com.bank.app:id/btn_pay" class="android.widget.Button" package="com.bank.app" content-desc="" checkable="false" checked="false" clickable="true" enabled="false" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[42,2200][1038,2326]" /></node></hierarchy>`;

  it('reads nodes by their class attribute and treats them as visible', () => {
    const tree = parseUiTree(dump, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
    expect(tree.format).toBe('appium-android');
    const pay = tree.nodes.find((node) => node.resourceId === 'com.bank.app:id/btn_pay');
    expect(pay).toMatchObject({
      className: 'android.widget.Button',
      text: 'Pay',
      clickable: true,
      enabled: false,
      visible: true,
      bounds: { x: 42, y: 2200, width: 996, height: 126 },
    });
  });
});

describe('textsInside (spec 079)', () => {
  const node = (index: number, parent: number | null, over: Partial<UiNode> = {}): UiNode => ({
    index,
    parent,
    depth: 0,
    key: `path:${index}`,
    className: 'android.view.View',
    resourceId: '',
    text: '',
    label: '',
    hint: '',
    clickable: false,
    focusable: false,
    enabled: true,
    visible: true,
    accessible: true,
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    ...over,
  });

  it('names a nameless element by the first two texts inside it, cut at 24 characters', () => {
    const nodes = [
      node(0, null),
      node(1, 0),
      node(2, 1, { text: 'IBAN' }),
      node(3, 1, { label: '' }),
      node(4, 1, { text: 'Для відображення в Приват24 і не лише' }),
      node(5, 0, { text: 'Валюта рахунку' }),
      node(6, null, { text: 'Продовжити' }),
    ];
    expect(textsInside(nodes, nodes[1])).toEqual(['IBAN', 'Для відображення в Прив…']);
    expect(textsInside(nodes, nodes[0])).toEqual(['IBAN', 'Для відображення в Прив…']);
  });

  it('gives no texts for an element with nothing written inside', () => {
    const nodes = [node(0, null), node(1, 0), node(2, null, { text: 'Поза ним' })];
    expect(textsInside(nodes, nodes[0])).toEqual([]);
  });

  it('gives no texts for an element with an id or a text of its own', () => {
    const nodes = [
      node(0, null, { resourceId: 'app:id/form' }),
      node(1, 0, { text: 'IBAN' }),
      node(2, null, { text: 'Додати' }),
      node(3, 2, { text: 'IBAN' }),
    ];
    expect(textsInside(nodes, nodes[0])).toEqual([]);
    expect(textsInside(nodes, nodes[2])).toEqual([]);
  });
});
