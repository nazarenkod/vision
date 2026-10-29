import { readFileSync } from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { parseUiTree } from './ui-tree.parser';
import { ElementRule } from './comparison-inputs';
import { complement, compareOnlyStatus, planCompareOnly } from './compare-only';
import { Rect, UiNode, UiTree } from './ui-tree.types';
import { computePixelmatchDiff } from '../compare/libs/pixelmatch/pixelmatch.core';

const xml = readFileSync(path.join(__dirname, '__fixtures__', 'android-payment.xml'), 'utf8');
const parse = (source: string) => parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
const compare = (selector: string, id = selector): ElementRule => ({ id, selector, action: 'compare' });
const area = (rects: Rect[]) => rects.reduce((sum, r) => sum + r.width * r.height, 0);

describe('planCompareOnly', () => {
  const baseline = parse(xml);

  it('does nothing without a compare-only rule', () => {
    const plan = planCompareOnly([{ id: 'r', selector: 'id:tv_fee', action: 'ignore' }], baseline, baseline);
    expect(plan.active).toBe(false);
    expect(plan.ignoreOutside).toEqual([]);
  });

  it('compares every element any compare-only rule matches', () => {
    const plan = planCompareOnly([compare('id:btn_pay'), compare('text:Next')], baseline, baseline);
    expect(plan.keep).toEqual([
      { x: 42, y: 2200, width: 996, height: 126 },
      { x: 42, y: 1300, width: 996, height: 126 },
      { x: 42, y: 1500, width: 996, height: 126 },
    ]);
    expect(plan.problems).toEqual([]);
  });

  it('ignores everything outside the compared elements', () => {
    const plan = planCompareOnly([compare('id:btn_pay'), compare('id:tv_fee')], baseline, baseline);
    // what is compared and what is ignored tile the screen exactly
    expect(area(plan.keep) + area(plan.ignoreOutside)).toBe(1080 * 2400);
    const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
    expect(plan.ignoreOutside.some((r) => inside(r, 100, 2250))).toBe(false);
    expect(plan.ignoreOutside.some((r) => inside(r, 100, 1500))).toBe(true);
  });

  it('compares an element that moved with itself', () => {
    const current = parse(xml.replace('bounds="[42,2200][1038,2326]"', 'bounds="[42,2100][1038,2226]"'));
    const plan = planCompareOnly([compare('id:btn_pay')], baseline, current);
    expect(plan.moves).toEqual([
      {
        from: { x: 42, y: 2200, width: 996, height: 126 },
        to: { x: 42, y: 2100, width: 996, height: 126 },
        key: 'id:com.bank.app:id/btn_pay',
      },
    ]);
    expect(plan.keep).toEqual([{ x: 42, y: 2100, width: 996, height: 126 }]);
    expect(plan.problems).toEqual([]);
  });

  it('treats a resized element as changed', () => {
    const current = parse(xml.replace('bounds="[42,2200][1038,2326]"', 'bounds="[42,2200][1038,2360]"'));
    const plan = planCompareOnly([compare('id:btn_pay')], baseline, current);
    expect(plan.moves).toEqual([]);
    expect(plan.problems).toEqual([
      expect.objectContaining({ kind: 'resized', selector: 'id:btn_pay', element: expect.stringContaining('Pay') }),
    ]);
  });

  it('pairs several matches in screen order and flags a different count', () => {
    const one = parse(xml.replace(/text="Next"([^>]*)btn_next_bottom/, 'text="Later"$1btn_next_bottom'));
    const plan = planCompareOnly([compare('text:Next')], baseline, one);
    expect(plan.problems).toEqual([
      { kind: 'count', ruleId: 'text:Next', selector: 'text:Next', baseline: 2, current: 1 },
    ]);
    // the top button is still compared with the top one
    expect(plan.keep).toEqual([{ x: 42, y: 1300, width: 996, height: 126 }]);
  });

  it('reports an element that disappeared or appeared', () => {
    const without = parse(xml.replace('com.bank.app:id/btn_pay', 'com.bank.app:id/btn_other'));
    expect(planCompareOnly([compare('id:btn_pay')], baseline, without).problems).toEqual([
      expect.objectContaining({ kind: 'disappeared', selector: 'id:btn_pay' }),
    ]);
    expect(planCompareOnly([compare('id:btn_pay')], without, baseline).problems).toEqual([
      expect.objectContaining({ kind: 'appeared', selector: 'id:btn_pay' }),
    ]);
  });

  it('compares only the element an xpath rule finds', () => {
    const offers = readFileSync(path.join(__dirname, '__fixtures__', 'android-offers.xml'), 'utf8');
    const badge = "xpath://*[@text='кешбек до 3%']/..";
    const current = parse(
      offers
        .replace('bounds="[810,1270][995,1310]"', 'bounds="[810,1290][995,1330]"')
        .replace('bounds="[815,1275][990,1305]"', 'bounds="[815,1295][990,1325]"')
    );
    const plan = planCompareOnly([compare(badge)], parse(offers), current);
    expect(plan.keep).toEqual([{ x: 810, y: 1290, width: 185, height: 40 }]);
    expect(plan.moves).toEqual([
      expect.objectContaining({
        from: { x: 810, y: 1270, width: 185, height: 40 },
        to: { x: 810, y: 1290, width: 185, height: 40 },
      }),
    ]);
    expect(plan.problems).toEqual([]);
  });

  it('reports a rule that found nothing', () => {
    expect(planCompareOnly([compare('id:btn_typo', 'r1')], baseline, baseline).problems).toEqual([
      { kind: 'nothing-found', ruleId: 'r1', selector: 'id:btn_typo' },
    ]);
  });

  it('cannot vouch for a run without both trees', () => {
    expect(planCompareOnly([compare('id:btn_pay')], null, baseline)).toEqual(
      expect.objectContaining({ active: true, problems: [{ kind: 'no-tree' }] })
    );
  });
});

describe('complement', () => {
  it('covers what the rects leave free, in bands', () => {
    const rects = complement([{ x: 2, y: 2, width: 2, height: 2 }], 6, 6);
    expect(area(rects)).toBe(36 - 4);
    expect(rects).toEqual([
      { x: 0, y: 0, width: 6, height: 2 },
      { x: 0, y: 2, width: 2, height: 2 },
      { x: 4, y: 2, width: 2, height: 2 },
      { x: 0, y: 4, width: 6, height: 2 },
    ]);
  });
});

describe('compareOnlyStatus', () => {
  it('keeps a run with problems in review', () => {
    expect(compareOnlyStatus('ok', [{ kind: 'no-tree' }])).toBe('unresolved');
    expect(compareOnlyStatus('new', [{ kind: 'no-tree' }])).toBe('new');
    expect(compareOnlyStatus('ok', [])).toBe('ok');
  });
});

describe('compare only, in pixels', () => {
  const W = 100;
  const H = 200;
  function node(index: number, resourceId: string, bounds: Rect): UiNode {
    return {
      index,
      parent: index ? 0 : null,
      depth: index ? 1 : 0,
      key: `id:${resourceId}`,
      className: 'android.view.View',
      resourceId,
      text: '',
      label: '',
      hint: '',
      clickable: false,
      focusable: false,
      enabled: true,
      visible: true,
      accessible: true,
      bounds,
    };
  }
  const tree = (button: Rect): UiTree => ({
    format: 'appium-android',
    scale: 1,
    width: W,
    height: H,
    pixelsPerDp: 1,
    pixelsPerDpEstimated: false,
    nodes: [node(0, 'root', { x: 0, y: 0, width: W, height: H }), node(1, 'card', button)],
  });
  function screen(draw: (fill: (x: number, y: number, w: number, h: number, rgb: number[]) => void) => void) {
    const png = new PNG({ width: W, height: H });
    png.data.fill(255);
    draw((x, y, w, h, rgb) => {
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) png.data.set([...rgb, 255], (yy * W + xx) * 4);
    });
    return PNG.sync.write(png);
  }
  const diff = (baseline: Buffer, image: Buffer, plan: ReturnType<typeof planCompareOnly>, ignoreAreas: Rect[] = []) =>
    computePixelmatchDiff({
      kind: 'diff',
      baseline,
      image,
      ignoreAreas: [...ignoreAreas, ...plan.ignoreOutside],
      threshold: 0.1,
      includeAA: true,
      allowDiffDimensions: false,
      diffTolerancePercent: 0,
      saveDiff: false,
      moves: plan.moves,
      measureAreas: plan.keep,
    });

  const card = { x: 10, y: 50, width: 80, height: 40 };
  const moved = { x: 10, y: 100, width: 80, height: 40 };
  const before = screen((fill) => {
    fill(0, 0, 100, 20, [200, 30, 30]); // a banner
    fill(card.x, card.y, card.width, card.height, [30, 120, 50]);
  });

  it('counts nothing when only the rest of the screen changed and the card moved', () => {
    const after = screen((fill) => {
      fill(0, 0, 100, 40, [30, 30, 200]); // another, taller banner
      fill(moved.x, moved.y, moved.width, moved.height, [30, 120, 50]);
    });
    const plan = planCompareOnly([compare('id:card')], tree(card), tree(moved));
    expect(diff(before, after, plan).diffPercent ?? 0).toBe(0);
  });

  it('keeps ignored elements and areas ignored inside a compared one', () => {
    const after = screen((fill) => {
      fill(card.x, card.y, card.width, card.height, [30, 120, 50]);
      fill(20, 60, 10, 10, [0, 0, 0]); // a clock inside the card
    });
    const plan = planCompareOnly([compare('id:card')], tree(card), tree(card));
    expect(diff(before, after, plan).diffPercent).toBeGreaterThan(0);
    expect(diff(before, after, plan, [{ x: 20, y: 60, width: 10, height: 10 }]).diffPercent ?? 0).toBe(0);
  });

  it('measures the difference against the compared card', () => {
    const after = screen((fill) => fill(card.x, card.y, card.width, card.height, [30, 50, 200]));
    const plan = planCompareOnly([compare('id:card')], tree(card), tree(card));
    expect(diff(before, after, plan).diffPercent).toBe(100);
  });
});
