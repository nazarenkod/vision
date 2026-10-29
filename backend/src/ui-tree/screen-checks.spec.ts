import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from './ui-tree.parser';
import { diffTrees } from './structure-diff';
import { areaHash, componentChanges, invisibleChanges } from './screen-checks';

const xml = readFileSync(path.join(__dirname, '__fixtures__', 'android-payment.xml'), 'utf8');
const parse = (source: string) => parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
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
