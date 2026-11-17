import { readFileSync } from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { parseUiTree } from './ui-tree.parser';
import {
  computeMoves,
  findSystemBars,
  matchesSelector,
  parseSelector,
  parseUiTreeSettings,
  resolveRules,
  textParts,
} from './comparison-inputs';
import { diffTrees } from './structure-diff';
import { outsideAreas } from './ui-tree.service';
import { applyTolerance, computePixelmatchDiff, shiftBaseline } from '../compare/libs/pixelmatch/pixelmatch.core';

const xml = readFileSync(path.join(__dirname, '__fixtures__', 'android-payment.xml'), 'utf8');
const parse = (source: string) => parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });

describe('element selectors', () => {
  const tree = parse(xml);
  const find = (selector: string) => tree.nodes.filter((node) => matchesSelector(node, parseSelector(selector)));

  it('matches resource ids with or without the package', () => {
    expect(find('id:btn_pay')).toHaveLength(1);
    expect(find('id:com.bank.app:id/btn_pay')).toHaveLength(1);
    expect(find('id:id/btn_pay')).toHaveLength(1);
    expect(find('id:pay')).toHaveLength(0);
  });

  it('matches classes by full or short name', () => {
    expect(find('class:ImageButton')).toHaveLength(4);
    expect(find('class:android.widget.EditText')).toHaveLength(2);
  });

  it('matches text exactly or by regular expression', () => {
    expect(find('text:Next')).toHaveLength(2);
    expect(find('text:/^commission \\d+/i')).toHaveLength(1);
  });

  it('rejects unknown selector kinds', () => {
    expect(parseSelector('xpath://Button')).toBeNull();
  });
});

const offers = readFileSync(path.join(__dirname, '__fixtures__', 'android-offers.xml'), 'utf8');
// a banner above the list pushes it and everything in it 100 px down
const offersMovedDown = offers.replace(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g, (all, x1, y1, x2, y2) =>
  Number(y1) >= 840 && Number(y2) <= 1540 ? `bounds="[${x1},${Number(y1) + 100}][${x2},${Number(y2) + 100}]"` : all
);
const plusOnFirstCard =
  "xpath://*[@resource-id='com.bank.app:id/offers_list']/android.view.ViewGroup[1]/android.widget.ImageView[1]";

describe('resolveRules', () => {
  it('applies an xpath rule where the element was and where it is', () => {
    const resolved = resolveRules(
      [{ id: 'plus', selector: plusOnFirstCard, action: 'ignore' }],
      [parse(offersMovedDown), parse(offers)]
    );
    expect(resolved.found.plus).toEqual({
      current: [{ x: 925, y: 1025, width: 80, height: 75 }],
      baseline: [{ x: 925, y: 925, width: 80, height: 75 }],
    });
    expect(resolved.ignore).toEqual([
      { x: 923, y: 1023, width: 84, height: 79 },
      { x: 923, y: 923, width: 84, height: 79 },
    ]);
    expect(resolved.matches.plus).toBe(1);
  });

  it('skips a rule whose xpath goes beyond a path from a stable element', () => {
    const resolved = resolveRules(
      [{ id: 'wide', selector: "xpath://*[contains(@text,'Pay')]", action: 'ignore' }],
      [parse(offers), parse(offers)]
    );
    expect(resolved.ignore).toEqual([]);
    expect(resolved.matches.wide).toBeUndefined();
  });

  it('covers an element where it was and where it is now', () => {
    const baseline = parse(xml);
    const current = parse(xml.replace('bounds="[42,1000][500,1050]"', 'bounds="[42,1100][500,1150]"'));

    const resolved = resolveRules(
      [
        { id: 'r1', selector: 'id:tv_fee', action: 'ignore' },
        { id: 'r2', selector: 'class:ImageButton', action: 'tolerate', maxDiffPercent: 10 },
      ],
      [current, baseline]
    );

    expect(resolved.ignore).toEqual([
      { x: 40, y: 1098, width: 462, height: 54 },
      { x: 40, y: 998, width: 462, height: 54 },
    ]);
    expect(resolved.tolerate).toHaveLength(8);
    expect(resolved.tolerate[0].maxDiffPercent).toBe(10);
    // one element on the screen, though it covers two places
    expect(resolved.matches).toEqual({ r1: 1, r2: 4 });
  });
});

describe('resolveRules: compare only', () => {
  it('reads compare-only rules with every kind of selector', () => {
    const tree = parse(xml);
    const settings = parseUiTreeSettings(
      JSON.stringify({
        checkRules: {
          '["Payment",""]': [
            { id: 'a', selector: 'id:btn_pay', action: 'compare' },
            { id: 'b', selector: 'class:ImageButton', action: 'compare' },
            { id: 'c', selector: 'text:Next', action: 'compare' },
            { id: 'd', selector: 'text:/^commission \\d+/i', action: 'compare' },
          ],
        },
      })
    );
    const rules = settings.checkRules['["Payment",""]'];
    const resolved = resolveRules(rules, [tree, tree]);

    // compare-only rules hide nothing by themselves
    expect(resolved.ignore).toEqual([]);
    expect(resolved.tolerate).toEqual([]);
    expect(resolved.matches).toEqual({ a: 1, b: 4, c: 2, d: 1 });
    expect(resolved.found.a.current).toEqual([{ x: 42, y: 2200, width: 996, height: 126 }]);
    expect(resolved.found.a.baseline).toEqual(resolved.found.a.current);
  });
});

describe('findSystemBars', () => {
  it('uses the status and navigation bar views when the tree has them', () => {
    const withBars = xml.replace(
      '</android.widget.FrameLayout>',
      '<android.view.View class="android.view.View" resource-id="android:id/statusBarBackground" bounds="[0,0][1080,63]" displayed="true"/>' +
        '<android.view.View class="android.view.View" resource-id="android:id/navigationBarBackground" bounds="[0,2337][1080,2400]" displayed="true"/></android.widget.FrameLayout>'
    );
    expect(findSystemBars(parse(withBars))).toEqual([
      { x: 0, y: 0, width: 1080, height: 63 },
      { x: 0, y: 2337, width: 1080, height: 63 },
    ]);
  });

  it('falls back to a 24 dp band at the top', () => {
    expect(findSystemBars(parse(xml))).toEqual([{ x: 0, y: 0, width: 1080, height: 63 }]);
  });
});

describe('computeMoves', () => {
  const baseline = parse(xml);
  // everything from the fee down moved 100 px: a banner was inserted above it
  const shifted = xml.replace(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g, (match, x1, y1, x2, y2) =>
    Number(y1) >= 1000 ? `bounds="[${x1},${Number(y1) + 100}][${x2},${Number(y2) + 100}]"` : match
  );
  const current = parse(shifted);

  it('lists moved elements, leaving out children carried by their parent', () => {
    const moves = computeMoves(baseline, current, null);
    const keys = moves.map((move) => move.key);
    expect(keys).toContain('id:com.bank.app:id/btn_pay');
    expect(keys).toContain('id:com.bank.app:id/row_template');
    // the template row's text moved with the row
    expect(keys).not.toContain('TextView:Use template');
    const pay = moves.find((move) => move.key === 'id:com.bank.app:id/btn_pay');
    expect(pay.to.y - pay.from.y).toBe(100);
  });

  it('respects the maximum distance', () => {
    expect(computeMoves(baseline, current, 30)).toEqual([]);
    expect(computeMoves(baseline, current, 40).length).toBeGreaterThan(0);
  });

  it('ignores elements that changed size', () => {
    const resized = parse(xml.replace('bounds="[42,2200][1038,2326]"', 'bounds="[42,2250][1038,2400]"'));
    expect(computeMoves(baseline, resized, null)).toEqual([]);
  });
});

describe('pixelmatch with moves and tolerance', () => {
  const W = 200;
  const H = 300;
  function screen(draw: (fill: (x: number, y: number, w: number, h: number, rgb: number[]) => void) => void) {
    const png = new PNG({ width: W, height: H });
    png.data.fill(255);
    draw((x, y, w, h, rgb) => {
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) png.data.set([...rgb, 255], (yy * W + xx) * 4);
    });
    return png;
  }
  const encode = (png: PNG) => PNG.sync.write(png);
  const run = (baseline: PNG, image: PNG, extra = {}) =>
    computePixelmatchDiff({
      kind: 'diff',
      baseline: encode(baseline),
      image: encode(image),
      ignoreAreas: [],
      threshold: 0.1,
      includeAA: true,
      allowDiffDimensions: false,
      diffTolerancePercent: 0,
      saveDiff: true,
      ...extra,
    });

  // a card that moved down by 50 px because a banner appeared above it
  const before = screen((fill) => fill(20, 40, 160, 60, [30, 120, 50]));
  const after = screen((fill) => {
    fill(20, 20, 160, 20, [200, 30, 30]); // banner
    fill(20, 90, 160, 60, [30, 120, 50]); // the same card, moved
  });
  const move = { from: { x: 20, y: 40, width: 160, height: 60 }, to: { x: 20, y: 90, width: 160, height: 60 } };

  it('flags the moved card without compensation', () => {
    expect(run(before, after).pixelMisMatchCount).toBe(160 * 20 + 160 * 50 + 160 * 50);
  });

  it('only flags what is new once the move is compensated', () => {
    const result = run(before, after, { moves: [move] });
    // the banner (rows 20-40) and the strip the card left (rows 40-90); the card itself no longer counts
    expect(result.pixelMisMatchCount).toBe(160 * 20 + 160 * 50);
  });

  it('still flags a moved card that also changed', () => {
    const changed = screen((fill) => {
      fill(20, 20, 160, 20, [200, 30, 30]);
      fill(20, 90, 160, 60, [30, 50, 200]);
    });
    expect(run(before, changed, { moves: [move] }).pixelMisMatchCount).toBeGreaterThan(160 * 60);
  });

  it('copies elements in the baseline to their new place', () => {
    const shifted = shiftBaseline(before, [move]);
    const at = (x: number, y: number) => Array.from(shifted.data.subarray((y * W + x) * 4, (y * W + x) * 4 + 3));
    expect(at(50, 120)).toEqual([30, 120, 50]);
  });

  it('clears small changes inside a tolerated area', () => {
    const image = screen((fill) => fill(20, 40, 10, 10, [0, 0, 0]));
    const blank = screen(() => undefined);
    const area = { x: 0, y: 0, width: 100, height: 100 };
    expect(run(blank, image, { toleranceAreas: [{ ...area, maxDiffPercent: 2 }] }).pixelMisMatchCount).toBe(0);
    expect(run(blank, image, { toleranceAreas: [{ ...area, maxDiffPercent: 0.5 }] }).pixelMisMatchCount).toBe(100);
  });

  it('counts the cleared pixels', () => {
    const diff = {
      width: 4,
      height: 1,
      data: new Uint8Array([255, 0, 0, 255, 230, 230, 230, 255, 255, 0, 0, 255, 0, 0, 0, 255]),
    };
    expect(applyTolerance(diff, [{ x: 0, y: 0, width: 4, height: 1, maxDiffPercent: 50 }])).toBe(2);
  });
});

describe('parseUiTreeSettings', () => {
  it('fills defaults and survives bad JSON', () => {
    expect(parseUiTreeSettings(null).excludeSystemBars).toBe(true);
    expect(parseUiTreeSettings('{"excludeSystemBars": false}').excludeSystemBars).toBe(false);
    expect(parseUiTreeSettings('nope').compensateMoves).toBe(false);
  });

  it('keeps the project platform', () => {
    for (const platform of ['mobile', 'web', 'both']) {
      expect(parseUiTreeSettings(JSON.stringify({ platform })).platform).toBe(platform);
    }
    // values the page could not have saved read as the default, and the rest of the settings stay
    expect(parseUiTreeSettings('{"platform": "desktop", "compensateMoves": true}')).toMatchObject({
      platform: 'mobile',
      compensateMoves: true,
    });
    expect(
      parseUiTreeSettings(
        JSON.stringify({ platform: 'web', allowedBrowsers: [{ browser: 'Chrome', version: '131.*' }] })
      ).allowedBrowsers
    ).toEqual([{ browser: 'Chrome', version: '131.*', viewport: '' }]);
  });

  it('reads a project saved before platforms as mobile', () => {
    expect(parseUiTreeSettings(null).platform).toBe('mobile');
    expect(parseUiTreeSettings('{"excludeSystemBars": false}').platform).toBe('mobile');
    expect(parseUiTreeSettings('{"excludeSystemBars": false}').allowedBrowsers).toEqual([]);
  });

  it('looks for the screen title in Appbar#Title when the project saved none', () => {
    expect(parseUiTreeSettings(null).screenTitle).toEqual(['id:Appbar#Title']);
    expect(parseUiTreeSettings('{"screenTitle": []}').screenTitle).toEqual(['id:Appbar#Title']);
    expect(parseUiTreeSettings('{"screenTitle": ["id:toolbar_title"]}').screenTitle).toEqual(['id:toolbar_title']);
  });

  it("reads the project's accessibility norms, defaults for the rest", () => {
    const { a11yNorms } = parseUiTreeSettings('{"a11yNorms": {"touchTargetAndroid": 40}}');
    expect(a11yNorms).toMatchObject({ touchTargetAndroid: 40, touchTargetIos: 44, contrast: 4.5 });
    expect(parseUiTreeSettings(null).a11yNorms.touchTargetAndroid).toBe(48);
  });

  it("reads the project's allowed devices, none when it saved none", () => {
    const { allowedDevices } = parseUiTreeSettings('{"allowedDevices": [{"device": "Pixel 7", "os": "Android 15"}]}');
    expect(allowedDevices).toEqual([{ device: 'Pixel 7', os: 'Android 15' }]);
    expect(parseUiTreeSettings(null).allowedDevices).toEqual([]);
    expect(parseUiTreeSettings('{"allowedDevices": "Pixel 7"}').allowedDevices).toEqual([]);
  });
});

describe('parseUiTreeSettings: settings no longer read', () => {
  it('keeps the grouping modes and problem classes of old as they were, so a save does not erase them', () => {
    const old = {
      a11yDuplicates: { 'touch-target': 'screen' },
      a11yClasses: [{ id: 'b', name: 'B', match: '*decor_*' }],
    };
    const settings = parseUiTreeSettings(JSON.stringify(old));
    expect(JSON.parse(JSON.stringify(settings))).toMatchObject(old);
  });
});

describe('resolveRules: variable text (spec 033)', () => {
  const withFee = (text: string) => parse(xml.replace('text="Commission 0 UAH"', `text="${text}"`));
  const parts = [{ text: 'Commission ' }, { pattern: '\\d+' }, { text: ' UAH' }];
  const variable = { id: 'v', selector: 'id:tv_fee', action: 'variable' as const, parts };
  const feeBounds = (tree: ReturnType<typeof parse>) =>
    tree.nodes.find((node) => node.resourceId.endsWith('tv_fee')).bounds;

  it('leaves a variable-text element out of the pixels where it was and where it is', () => {
    const current = withFee('Commission 15 UAH');
    const baseline = withFee('Commission 0 UAH');
    const resolved = resolveRules([variable], [current, baseline]);
    const { x, y, width, height } = feeBounds(current);
    expect(resolved.ignore).toEqual([
      { x: x - 2, y: y - 2, width: width + 4, height: height + 4 },
      { x: x - 2, y: y - 2, width: width + 4, height: height + 4 },
    ]);
    expect(resolved.variable.v).toMatchObject({ gone: false, overridden: false, items: [{ ok: true }] });
  });

  it('keeps the text change of a variable-text element out of the element changes', () => {
    const current = withFee('Commission 15 UAH');
    const baseline = withFee('Commission 0 UAH');
    const changes = diffTrees(baseline, current);
    expect(changes.some((change) => change.resourceId.endsWith('tv_fee'))).toBe(true);
    const resolved = resolveRules([variable], [current, baseline]);
    expect(outsideAreas(changes, resolved.ignore).some((change) => change.resourceId.endsWith('tv_fee'))).toBe(false);
  });

  it('says why a text does not hold', () => {
    const resolved = resolveRules([variable], [withFee('Commission NaN UAH'), withFee('Commission 0 UAH')]);
    expect(resolved.variable.v.items).toEqual([
      expect.objectContaining({ ok: false, reason: 'pattern', text: 'Commission NaN UAH' }),
    ]);
  });

  it('reports a variable-text element that is gone from the snapshot', () => {
    const gone = parse(xml.replace('com.bank.app:id/tv_fee', 'com.bank.app:id/tv_other'));
    const resolved = resolveRules([variable], [gone, withFee('Commission 0 UAH')]);
    expect(resolved.variable.v).toMatchObject({ gone: true, items: [] });
  });

  it('checks every element a variable-text rule finds', () => {
    const tree = parse(xml);
    const words = { id: 'w', selector: 'text:/^Next$/', action: 'variable' as const, parts: [{ pattern: '\\p{L}+' }] };
    const digits = { id: 'd', selector: 'text:/^Next$/', action: 'variable' as const, parts: [{ pattern: '\\d+' }] };
    const resolved = resolveRules([words, digits], [tree, tree]);
    expect(resolved.variable.w.items.map((item) => item.ok)).toEqual([true, true]);
    expect(resolved.variable.d.items.map((item) => item.ok)).toEqual([false, false]);
  });

  it('lets an ignore rule win over a variable-text rule on the same element', () => {
    const tree = withFee('Commission NaN UAH');
    const ignore = { id: 'i', selector: 'id:tv_fee', action: 'ignore' as const };
    const resolved = resolveRules([ignore, variable], [tree, tree]);
    expect(resolved.variable.v).toMatchObject({ overridden: true, items: [] });
  });

  it('finds an element by a text pattern with letters classes', () => {
    const tree = withFee('Комісія 15 грн');
    const find = (selector: string) => tree.nodes.filter((node) => matchesSelector(node, parseSelector(selector)));
    expect(find('text:/^\\p{L}+\\s+.*?\\s+\\p{L}+$/u')).toHaveLength(1);
  });
});

describe('resolveRules: variable text leaves out only the text (spec 066)', () => {
  // a tile like the bank's "History" button: an icon and the shown text inside a labelled button
  const tile = (o: { label?: string; text?: string; icon?: string; width?: number } = {}) => {
    const right = 400 + (o.width ?? 0);
    return parse(`<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy index="0" class="hierarchy" rotation="0" width="1080" height="2400">
  <android.widget.FrameLayout index="0" class="android.widget.FrameLayout" text="" resource-id="" bounds="[0,0][1080,2400]" displayed="true">
    <android.view.View index="0" class="android.view.View" text="" content-desc="${o.label ?? 'History'}" resource-id="" clickable="true" bounds="[100,1000][${right},1100]" displayed="true">
      <android.widget.ImageView index="0" class="android.widget.ImageView" text="" content-desc="${o.icon ?? 'clock'}" resource-id="com.bank.app:id/history_icon" bounds="[110,1010][190,1090]" displayed="true" />
      <android.widget.TextView index="1" class="android.widget.TextView" text="${o.text ?? 'History'}" resource-id="" bounds="[200,1020][380,1080]" displayed="true" />
      <android.widget.TextView index="2" class="android.widget.TextView" text="new" resource-id="com.bank.app:id/badge" bounds="[385,1000][${right},1030]" displayed="true" />
    </android.view.View>
  </android.widget.FrameLayout>
</hierarchy>`);
  };
  const words = [{ pattern: '\\p{L}+', sample: 'History' }];
  const rule = { id: 'v', selector: 'class:android.view.View', action: 'variable' as const, parts: words };
  const button = (tree: ReturnType<typeof parse>) =>
    tree.nodes.find((node) => node.label === 'History' || node.className === 'android.view.View');
  const byText = (tree: ReturnType<typeof parse>, text: string) => tree.nodes.find((node) => node.text === text);
  const padded = ({ x, y, width, height }: { x: number; y: number; width: number; height: number }) => ({
    x: x - 2,
    y: y - 2,
    width: width + 4,
    height: height + 4,
  });

  it('takes as text parts the descendants whose text passes the check', () => {
    const tree = tile();
    const digitsOnly = [{ pattern: '\\d+' }];
    expect(textParts(tree, button(tree), [{ pattern: '\\p{L}+' }]).map((node) => node.text)).toEqual([
      'History',
      'new',
    ]);
    expect(textParts(tree, button(tree), [{ pattern: 'Hist\\p{L}+' }]).map((node) => node.text)).toEqual(['History']);
    expect(textParts(tree, button(tree), digitsOnly)).toEqual([]);
  });

  it('takes the label as the shown text on iOS, but not the label of an image', () => {
    const ios = parseUiTree(
      `<?xml version="1.0" encoding="UTF-8"?>
<XCUIElementTypeApplication type="XCUIElementTypeApplication" name="Bank" label="Bank" enabled="true" visible="true" accessible="false" x="0" y="0" width="390" height="844" index="0">
  <XCUIElementTypeButton type="XCUIElementTypeButton" name="history" label="History" enabled="true" visible="true" accessible="true" x="16" y="300" width="160" height="44" index="0">
    <XCUIElementTypeImage type="XCUIElementTypeImage" name="clock" label="clock" enabled="true" visible="true" accessible="false" x="20" y="306" width="32" height="32" index="0"/>
    <XCUIElementTypeStaticText type="XCUIElementTypeStaticText" label="History" enabled="true" visible="true" accessible="true" x="60" y="310" width="100" height="24" index="1"/>
  </XCUIElementTypeButton>
</XCUIElementTypeApplication>`,
      { imageWidth: 1170, imageHeight: 2532 }
    );
    const history = ios.nodes.find((node) => node.resourceId === 'history');
    expect(textParts(ios, history, [{ pattern: '\\p{L}+' }]).map((node) => node.className)).toEqual([
      'XCUIElementTypeStaticText',
    ]);
  });

  it('leaves out only the text parts when the element keeps its size', () => {
    const history = { ...rule, parts: [{ pattern: 'Hist\\p{L}+', sample: 'History' }] };
    const current = tile({ text: 'Historie' });
    const baseline = tile();
    const resolved = resolveRules([history], [current, baseline]);
    expect(resolved.ignore).toEqual([
      padded(byText(current, 'Historie').bounds),
      padded(byText(baseline, 'History').bounds),
    ]);
    expect(resolved.leftOut.v).toEqual([
      { side: 'current', element: button(current).bounds, areas: [byText(current, 'Historie').bounds] },
      { side: 'baseline', element: button(baseline).bounds, areas: [byText(baseline, 'History').bounds] },
    ]);
  });

  it('leaves out the whole element when its text is its own or its size changed', () => {
    const own = resolveRules(
      [
        {
          id: 'v',
          selector: 'id:tv_fee',
          action: 'variable',
          parts: [{ text: 'Commission ' }, { pattern: '\\d+' }, { text: ' UAH' }],
        },
      ],
      [parse(xml), parse(xml)]
    );
    expect(own.leftOut.v.map((item) => item.reason)).toEqual(['own-text', 'own-text']);
    expect(own.leftOut.v[0].areas).toEqual([own.leftOut.v[0].element]);

    const history = { ...rule, parts: [{ pattern: 'Hist\\p{L}+', sample: 'History' }] };
    const wider = resolveRules([history], [tile({ width: 60 }), tile()]);
    expect(wider.leftOut.v.map((item) => item.reason)).toEqual(['resized', 'resized']);
    expect(wider.ignore).toEqual([padded(button(tile({ width: 60 })).bounds), padded(button(tile()).bounds)]);

    const noBaseline = resolveRules([history], [tile(), null]);
    expect(noBaseline.leftOut.v).toEqual([
      { side: 'current', element: button(tile()).bounds, areas: [button(tile()).bounds], reason: 'unpaired' },
    ]);
  });

  it('counts a change of the icon next to a variable text', () => {
    const history = { ...rule, parts: [{ pattern: 'Hist\\p{L}+', sample: 'History' }] };
    const current = tile({ text: 'Historie', icon: 'calendar' });
    const baseline = tile();
    const changes = diffTrees(baseline, current);
    const resolved = resolveRules([history], [current, baseline]);
    const counted = outsideAreas(changes, resolved.ignore, resolved.quietKeys);
    expect(counted.map((change) => [change.kind, change.resourceId])).toEqual([
      ['label', 'com.bank.app:id/history_icon'],
    ]);
  });

  it('keeps the changes of the element a variable-text rule found out of the element changes', () => {
    const history = { ...rule, parts: [{ pattern: 'Hist\\p{L}+', sample: 'History' }] };
    const current = tile({ text: 'Historie', label: 'Historie' });
    const baseline = tile();
    const resolved = resolveRules([{ ...history, selector: 'class:android.view.View' }], [current, baseline]);
    expect(outsideAreas(diffTrees(baseline, current), resolved.ignore, resolved.quietKeys)).toEqual([]);
  });
});

describe('resolveRules: variable text on the rows of a list (spec 069)', () => {
  // the bank's history: every row is one merged button with the same id, its text only in the label
  const history = (labels: string[]) =>
    parse(`<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy index="0" class="hierarchy" rotation="0" width="1080" height="2400">
  <android.widget.FrameLayout index="0" class="android.widget.FrameLayout" text="" resource-id="" bounds="[0,0][1080,2400]" displayed="true">
${labels
  .map(
    (label, n) =>
      `    <android.widget.Button index="${n}" class="android.widget.Button" text="" content-desc="${label}" resource-id="activity_list_item" bounds="[40,${400 + n * 300}][1040,${650 + n * 300}]" displayed="true" />`
  )
  .join('\n')}
  </android.widget.FrameLayout>
</hierarchy>`);
  const own = (number: string, sum: string, time: string) => `Зі своєї картки *${number} ${sum} UAH 17 серпня, ${time} `;
  const other = 'На свою картку *7101 -5.03 UAH 11 серпня, 11:41 ';
  // what the review screen saves for "Зі своєї картки *1050 +1.01 UAH 17 серпня, 13:59" with the number, sum and time marked
  const parts = [
    { text: 'Зі своєї картки *' },
    { pattern: '\\d+', sample: '1050' },
    { text: ' ' },
    { pattern: '[+\\-−]?\\d+\\.\\d{2}', sample: '+1.01' },
    { text: ' UAH 17 серпня, ' },
    { pattern: '\\d+:\\d{2}', sample: '13:59' },
  ];
  const rule = { id: 'v', selector: 'id:activity_list_item', action: 'variable' as const, parts };
  const row = (tree: ReturnType<typeof parse>, n: number) =>
    tree.nodes.filter((node) => node.resourceId === 'activity_list_item')[n];

  it("finds by id only the rows that keep the rule's fixed text", () => {
    const current = history([other, own('8353', '+5.00', '11:25'), own('1051', '+1.05', '13:59')]);
    const baseline = history([other, own('8352', '+3.00', '11:25'), own('1050', '+1.01', '13:59')]);
    const resolved = resolveRules([rule], [current, baseline]);
    expect(resolved.matches.v).toBe(2);
    expect(resolved.found.v.current).toEqual([row(current, 1).bounds, row(current, 2).bounds]);
    expect(resolved.variable.v.items.map((item) => item.ok)).toEqual([true, true]);
  });

  it('compares a row of another kind with the same id as any part of the screen', () => {
    const current = history([other.replace('-5.03', '-7.00'), own('1051', '+1.05', '13:59')]);
    const baseline = history([other, own('1050', '+1.01', '13:59')]);
    const resolved = resolveRules([rule], [current, baseline]);
    const otherRow = row(current, 0).bounds;
    const overlaps = (area: { x: number; y: number; width: number; height: number }) =>
      area.y < otherRow.y + otherRow.height && otherRow.y < area.y + area.height;
    expect(resolved.ignore.some(overlaps)).toBe(false);
    expect(resolved.quietKeys).not.toContain(row(current, 0).key);
    const changes = diffTrees(baseline, current);
    expect(
      outsideAreas(changes, resolved.ignore, resolved.quietKeys).some((change) => change.key === row(current, 0).key)
    ).toBe(true);
  });

  it('tells the text does not match when no row with the id keeps the fixed text', () => {
    const current = history([other, 'From your card *1051 +1.05 UAH 17 серпня, 13:59']);
    const baseline = history([other, own('1050', '+1.01', '13:59')]);
    const resolved = resolveRules([rule], [current, baseline]);
    expect(resolved.variable.v.gone).toBe(false);
    expect(resolved.variable.v.items).toEqual([
      expect.objectContaining({ ok: false, reason: 'text', text: other.trim() }),
      expect.objectContaining({ ok: false, reason: 'text', text: 'From your card *1051 +1.05 UAH 17 серпня, 13:59' }),
    ]);
  });

  it('still reports the element gone when no row with the id is left', () => {
    const resolved = resolveRules([rule], [history([]), history([own('1050', '+1.01', '13:59')])]);
    expect(resolved.variable.v).toMatchObject({ gone: true, items: [] });
  });

  it('applies to a rule saved before, by its parts', () => {
    // a rule as 033 saved it: the same selector and parts, nothing new stored
    const saved = JSON.parse(JSON.stringify(rule));
    const tree = history([other, own('1050', '+1.01', '13:59')]);
    expect(resolveRules([saved], [tree, tree]).matches.v).toBe(1);
  });
});
