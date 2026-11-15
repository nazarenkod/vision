import { readFileSync } from 'fs';
import { join } from 'path';
import { parseUiTree } from '../ui-tree/ui-tree.parser';
import { UiTree } from '../ui-tree/ui-tree.types';
import { findViolations } from './a11y.rules';
import { DEFAULT_A11Y_NORMS } from './a11y-norms';
import { RgbaImage } from './a11y.types';

const dir = join(__dirname, '..', 'ui-tree', '__fixtures__', 'web');
// collected in Chromium by web-tree/collect-tree.js
const shop = (): UiTree =>
  parseUiTree(readFileSync(join(dir, 'shop.html'), 'utf8'), { imageWidth: 800, imageHeight: 600 });
const page = (body: string): UiTree =>
  parseUiTree(`<!DOCTYPE html><html><body>${body}</body></html>`, { imageWidth: 800, imageHeight: 600 });

// a white page with light grey text where #faint is: the screenshot the contrast check reads
function whitePageWithFaintText(tree: UiTree): RgbaImage {
  const width = 800;
  const height = 600;
  const data = new Uint8Array(width * height * 4).fill(255);
  const faint = tree.nodes.find((node) => node.resourceId === 'faint').bounds;
  for (let y = faint.y + 4; y < faint.y + faint.height - 4; y++) {
    for (let x = faint.x; x < faint.x + 140; x += 2) {
      data.set([204, 204, 204, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data } as unknown as RgbaImage;
}

describe('accessibility of web pages', () => {
  it('finds an icon button without a label on a web page', () => {
    const issues = findViolations(shop());
    const menu = issues.filter((issue) => issue.nodeKey === 'id:menu');

    expect(menu.map((issue) => issue.rule)).toContain('missing-label');
    expect(menu.find((issue) => issue.rule === 'missing-label').message).toBe(
      'button (menu) has nothing for a screen reader to read out.'
    );
    // a named button, link or field is fine
    expect(issues.some((issue) => issue.rule === 'missing-label' && issue.nodeKey === 'id:pay')).toBe(false);
    expect(issues.some((issue) => issue.rule === 'missing-label' && issue.nodeKey === 'a:Tea')).toBe(false);
  });

  it('finds an input without a label, a hint or a value', () => {
    const issues = findViolations(shop());
    const inputs = issues.filter((issue) => issue.rule === 'input-without-label').map((issue) => issue.nodeKey);

    expect(inputs).toEqual(['id:nameless']);
  });

  it('finds the same label on several controls', () => {
    const issues = findViolations(shop()).filter((issue) => issue.rule === 'duplicate-label');
    expect(issues.map((issue) => issue.label)).toEqual(['Buy', 'Buy']);
  });

  it('measures the tap area in CSS pixels against the web norm', () => {
    const issues = findViolations(shop()).filter((issue) => issue.rule === 'touch-target');
    const menu = issues.find((issue) => issue.nodeKey === 'id:menu');

    // 20 × 20 px under the default 24 px; the 21 px high Buy buttons are under it too
    expect(menu.details).toMatchObject({ widthDp: 20, heightDp: 20, min: 24, unit: 'px' });
    expect(menu.message).toBe('button (menu) is 20 × 20 px, minimum is 24 × 24 px.');
    // the web norm is the one a page is held to; the Android and iOS norms change nothing on it
    const strict = findViolations(shop(), undefined, { ...DEFAULT_A11Y_NORMS, touchTargetWeb: 44 });
    const mobile = findViolations(shop(), undefined, {
      ...DEFAULT_A11Y_NORMS,
      touchTargetAndroid: 96,
      touchTargetIos: 96,
    });
    const strictTargets = strict.filter((issue) => issue.rule === 'touch-target');
    expect(strictTargets.length).toBeGreaterThanOrEqual(issues.length);
    expect(strictTargets.every((issue) => issue.details.min === 44)).toBe(true);
    expect(mobile.filter((issue) => issue.rule === 'touch-target').length).toBe(issues.length);
  });

  it('finds low text contrast on the screenshot of a web page', () => {
    const tree = shop();
    const issues = findViolations(tree, whitePageWithFaintText(tree)).filter((issue) => issue.rule === 'low-contrast');
    expect(issues.map((issue) => issue.nodeKey)).toEqual(['id:faint']);
  });

  it('finds a label that repeats the role', () => {
    const issues = findViolations(page('<button aria-label="Close button" data-x>×</button>'));
    expect(issues.map((issue) => issue.rule)).toContain('redundant-role');
  });

  it('never reports a web element as hidden from VoiceOver', () => {
    const tree = page('<button aria-hidden="true">Pay</button><a href="#" aria-hidden="true"></a>');
    expect(findViolations(tree).filter((issue) => issue.rule === 'not-accessible')).toEqual([]);
    // what aria-hidden takes from a screen reader is not asked for a label either
    expect(findViolations(tree).filter((issue) => issue.rule === 'missing-label')).toEqual([]);
  });

  it('skips contrast and tap area when the page source has no positions', () => {
    const tree = parseUiTree(readFileSync(join(dir, 'shop-page-source.html'), 'utf8'), {
      imageWidth: 800,
      imageHeight: 600,
    });
    const rules = new Set(findViolations(tree, whitePageWithFaintText(shop())).map((issue) => issue.rule));

    expect(tree.positioned).toBe(false);
    // what needs no position is still found
    expect(rules).toEqual(new Set(['missing-label', 'input-without-label', 'duplicate-label']));
  });
});
