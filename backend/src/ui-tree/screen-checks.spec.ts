import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from './ui-tree.parser';
import { diffTrees } from './structure-diff';
import { areaHash, componentChanges, detectLoading, invisibleChanges, screenSimilarity } from './screen-checks';

const xml = readFileSync(path.join(__dirname, '__fixtures__', 'android-payment.xml'), 'utf8');
const parse = (source: string, activity?: string) =>
  parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420, activity });
const addNode = (source: string, node: string) =>
  source.replace('</android.widget.FrameLayout>\n</hierarchy>', `${node}</android.widget.FrameLayout>\n</hierarchy>`);

function image(width: number, height: number, fill: number[] = [255, 255, 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...fill, 255], i * 4);
  return { width, height, data };
}
function paint(img: ReturnType<typeof image>, x: number, y: number, w: number, h: number, rgb: number[]) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) img.data.set([...rgb, 255], (yy * img.width + xx) * 4);
}

describe('detectLoading', () => {
  it('finds a visible spinner', () => {
    const tree = parse(
      addNode(
        xml,
        '<android.widget.ProgressBar class="android.widget.ProgressBar" resource-id="com.bank.app:id/progress" bounds="[490,1150][590,1250]" displayed="true"/>'
      )
    );
    const warning = detectLoading(tree);
    expect(warning.kind).toBe('loading');
    expect(warning.message).toContain('ProgressBar (id/progress)');
    expect(warning.elements).toEqual(['id:com.bank.app:id/progress']);
  });

  it('finds a shimmer placeholder and a "Loading…" text', () => {
    const tree = parse(
      addNode(
        xml,
        '<com.facebook.shimmer.ShimmerFrameLayout class="com.facebook.shimmer.ShimmerFrameLayout" bounds="[0,300][1080,600]" displayed="true"/>' +
          '<android.widget.TextView class="android.widget.TextView" text="Loading…" bounds="[400,700][700,760]" displayed="true"/>'
      )
    );
    expect(detectLoading(tree).elements).toHaveLength(2);
  });

  it('ignores hidden spinners and settled screens', () => {
    const hidden = addNode(
      xml,
      '<android.widget.ProgressBar class="android.widget.ProgressBar" bounds="[0,0][0,0]" displayed="false"/>'
    );
    expect(detectLoading(parse(hidden))).toBeNull();
    expect(detectLoading(parse(xml))).toBeNull();
  });
});

describe('invisibleChanges', () => {
  const baseline = parse(xml);

  it('reports a control that became disabled when the pixels did not change', () => {
    const current = parse(
      xml.replace(
        'resource-id="com.bank.app:id/btn_pay" clickable="true" enabled="true"',
        'resource-id="com.bank.app:id/btn_pay" clickable="true" enabled="false"'
      )
    );
    const changes = diffTrees(baseline, current);
    const hidden = invisibleChanges(changes, [], new Set());
    expect(hidden).toEqual([
      expect.objectContaining({
        kind: 'state',
        key: 'id:com.bank.app:id/btn_pay',
        before: 'default',
        after: 'disabled',
      }),
    ]);
  });

  it('does not report what the pixel diff already shows', () => {
    const current = parse(xml.replace('content-desc="Help"', 'content-desc="Support"'));
    const changes = diffTrees(baseline, current);
    expect(invisibleChanges(changes, [], new Set())).toHaveLength(1);
    expect(invisibleChanges(changes, [{ x: 950, y: 90, width: 120, height: 120 }], new Set())).toHaveLength(0);
  });

  it('reports an invisible control added on top of the screen', () => {
    const current = parse(
      addNode(
        xml,
        '<android.view.View class="android.view.View" resource-id="com.bank.app:id/overlay" clickable="true" bounds="[0,0][1080,2400]" displayed="true"/>'
      )
    );
    const changes = diffTrees(baseline, current);
    const clickable = new Set(current.nodes.filter((n) => n.clickable).map((n) => n.key));
    expect(invisibleChanges(changes, [], clickable).map((c) => `${c.kind} ${c.key}`)).toEqual([
      'added id:com.bank.app:id/overlay',
    ]);
  });
});

describe('screenSimilarity', () => {
  const other = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy width="1080" height="2400"><android.widget.FrameLayout class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">
  <android.widget.EditText class="android.widget.EditText" resource-id="com.bank.app:id/et_login" bounds="[0,100][1080,200]"/>
  <android.widget.EditText class="android.widget.EditText" resource-id="com.bank.app:id/et_password" bounds="[0,300][1080,400]"/>
  <android.widget.Button class="android.widget.Button" resource-id="com.bank.app:id/btn_sign_in" text="Sign in" bounds="[0,500][1080,600]"/>
</android.widget.FrameLayout></hierarchy>`;

  it('is high for the same screen and low for another one', () => {
    expect(screenSimilarity(parse(xml), parse(xml.replace('text="Pay"', 'text="Send"')))).toBe(1);
    expect(screenSimilarity(parse(xml), parse(other))).toBe(0);
  });

  it('treats different activities as different screens', () => {
    expect(screenSimilarity(parse(xml, '.PaymentActivity'), parse(xml, '.LoginActivity'))).toBe(0);
  });
});

describe('componentChanges', () => {
  it('hashes a changed component before and after, and tells whether it holds every change', () => {
    const tree = parse(xml);
    const before = image(1080, 2400);
    const after = image(1080, 2400);
    paint(before, 0, 63, 1080, 147, [30, 30, 30]); // toolbar dark
    paint(after, 0, 63, 1080, 147, [30, 60, 200]); // toolbar blue

    const changes = componentChanges({
      tree,
      baselineTree: tree,
      image: after,
      baselineImage: before,
      regions: [{ x: 0, y: 63, width: 1080, height: 147 }],
      changes: [],
    });

    const toolbar = changes.find((c) => c.componentId === 'com.bank.app:id/toolbar');
    expect(toolbar).toMatchObject({ coversAllChanges: true });
    expect(toolbar.before).not.toBe(toolbar.after);
    expect(toolbar.after).toBe(areaHash(after, { x: 0, y: 63, width: 1080, height: 147 }));
  });

  it('marks a component that holds only part of the changes', () => {
    const tree = parse(xml);
    const before = image(1080, 2400);
    const after = image(1080, 2400);
    paint(after, 0, 63, 1080, 147, [30, 60, 200]);
    paint(after, 42, 2200, 996, 126, [200, 0, 0]);

    const changes = componentChanges({
      tree,
      baselineTree: tree,
      image: after,
      baselineImage: before,
      regions: [
        { x: 0, y: 63, width: 1080, height: 147 },
        { x: 42, y: 2200, width: 996, height: 126 },
      ],
      changes: [],
    });

    expect(changes.find((c) => c.componentId === 'com.bank.app:id/toolbar').coversAllChanges).toBe(false);
  });
});
