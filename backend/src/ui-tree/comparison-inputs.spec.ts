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
} from './comparison-inputs';
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

describe('resolveRules', () => {
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
