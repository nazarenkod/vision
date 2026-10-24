import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from './ui-tree.parser';
import { changeFingerprint, diffTrees, elementsUnderRegions } from './structure-diff';
import { findNoiseHints } from './noise-hints';

const xml = readFileSync(path.join(__dirname, '__fixtures__', 'android-payment.xml'), 'utf8');
const parse = (source: string) => parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });

describe('diffTrees', () => {
  it('finds no changes between identical trees', () => {
    expect(diffTrees(parse(xml), parse(xml))).toEqual([]);
  });

  it('reports text changes, added and removed elements and resizes', () => {
    const changed = xml
      .replace('text="Pay"', 'text="Pay now"')
      .replace('bounds="[960,100][1054,194]"', 'bounds="[933,73][1080,220]"')
      .replace(/<android\.widget\.Button index="7"[^>]*\/>/, '')
      .replace(
        '</android.widget.FrameLayout>',
        '<android.widget.TextView class="android.widget.TextView" text="Limit 50 000 UAH" resource-id="com.bank.app:id/tv_limit" clickable="false" enabled="true" bounds="[42,1060][700,1090]" displayed="true" /></android.widget.FrameLayout>'
      );

    const changes = diffTrees(parse(xml), parse(changed));

    expect(changes.map((c) => `${c.kind} ${c.key}`)).toEqual([
      'text id:com.bank.app:id/btn_pay',
      'added id:com.bank.app:id/tv_limit',
      'removed id:com.bank.app:id/btn_next_bottom',
      'resized id:com.bank.app:id/btn_help',
    ]);
    expect(changes[0]).toMatchObject({ before: 'Pay', after: 'Pay now', element: 'Button "Pay now" (id/btn_pay)' });
    expect(changes[3]).toMatchObject({ before: '36×36', after: '56×56' });
  });

  it('gives the same fingerprint to the same change however far things moved', () => {
    const base = parse(xml);
    const a = parse(xml.replace('text="Pay"', 'text="Send"'));
    const b = parse(xml.replace('text="Pay"', 'text="Send"').replace('[42,2200][1038,2326]', '[42,2100][1038,2226]'));

    expect(changeFingerprint(diffTrees(base, a))).toBe(changeFingerprint(diffTrees(base, b)));
    expect(changeFingerprint(diffTrees(base, a))).toBe('text:id:com.bank.app:id/btn_pay:Pay→Send');
  });
});

describe('elementsUnderRegions', () => {
  it('names the element that best wraps each changed area', () => {
    const [scan, card] = elementsUnderRegions(parse(xml), [
      { x: 936, y: 624, width: 80, height: 80 },
      { x: 42, y: 2200, width: 996, height: 126 },
    ]);
    expect(scan.element).toBe('ImageButton (id/btn_scan_qr)');
    expect(card.element).toBe('Button "Pay" (id/btn_pay)');
  });
});

describe('findNoiseHints', () => {
  it('recognises a change confined to the status bar', () => {
    const hints = findNoiseHints({
      regions: [{ x: 900, y: 8, width: 120, height: 40 }],
      diffPercent: 0.2,
      imageWidth: 1080,
      imageHeight: 2400,
      tree: parse(xml),
    });
    expect(hints).toEqual([
      expect.objectContaining({ kind: 'status-bar', ignoreArea: { x: 0, y: 0, width: 1080, height: 63 } }),
    ]);
  });

  it('recognises text that holds an amount', () => {
    const tree = parse(xml.replace('text="Commission 0 UAH"', 'text="12,50 UAH"'));
    const hints = findNoiseHints({
      regions: [{ x: 48, y: 1008, width: 200, height: 32 }],
      diffPercent: 0.4,
      imageWidth: 1080,
      imageHeight: 2400,
      tree,
    });
    expect(hints.map((h) => h.kind)).toEqual(['dynamic-text']);
    expect(hints[0].ignoreArea).toEqual({ x: 42, y: 1000, width: 458, height: 50 });
  });

  it('flags a handful of edge pixels as rendering noise', () => {
    const hints = findNoiseHints({
      regions: [{ x: 500, y: 900, width: 8, height: 8 }],
      diffPercent: 0.001,
      imageWidth: 1080,
      imageHeight: 2400,
    });
    expect(hints.map((h) => h.kind)).toEqual(['anti-aliasing']);
  });

  it('says nothing about a real change', () => {
    expect(
      findNoiseHints({
        regions: [{ x: 42, y: 2200, width: 996, height: 126 }],
        diffPercent: 5,
        imageWidth: 1080,
        imageHeight: 2400,
        tree: parse(xml),
      })
    ).toEqual([]);
  });
});
