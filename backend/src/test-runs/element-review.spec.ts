import { elementReview, ReviewedRun } from './element-review';
import { StructuralChange } from '../ui-tree/structure-diff';
import { UiNode, UiTree } from '../ui-tree/ui-tree.types';

const node = (key: string, text: string, y = 0): UiNode => ({
  index: 0,
  parent: null,
  depth: 0,
  key,
  className: 'android.widget.TextView',
  resourceId: key.replace(/^id:/, ''),
  text,
  label: '',
  hint: '',
  clickable: false,
  focusable: false,
  enabled: true,
  visible: true,
  accessible: true,
  bounds: { x: 0, y, width: 1080, height: 150 },
});

const tree = (...nodes: UiNode[]): UiTree => ({
  format: 'appium-android',
  scale: 1,
  width: 1080,
  height: 2400,
  pixelsPerDp: 2.625,
  pixelsPerDpEstimated: false,
  nodes,
});

const region = (key: string | null) => ({
  region: { x: 0, y: 0, width: 10, height: 10 },
  key,
  element: key,
  resourceId: null,
});

const run = (
  id: string,
  name: string,
  regions: Array<string | null>,
  changes: Array<Partial<StructuralChange>> = []
): ReviewedRun => ({
  id,
  name,
  customTags: '',
  device: 'Pixel 7',
  os: 'Android 14',
  browser: '',
  viewport: '',
  imageName: `${id}.png`,
  baselineName: `${id}-base.png`,
  merge: false,
  tree: tree(node('id:toolbar', name), node('id:btn_pay', 'Pay', 2000)),
  baselineTree: tree(node('id:toolbar', name), node('id:btn_pay', 'Pay', 2000)),
  regions: regions.map(region),
  changes: changes as StructuralChange[],
});

describe('elementReview', () => {
  it('gathers one element changed differently on several screens', () => {
    const result = elementReview([
      run('r1', 'Payments', ['id:toolbar']),
      run('r2', 'Cards', ['id:toolbar', 'id:toolbar']),
      run('r3', 'Deposits', ['id:toolbar']),
    ]);

    expect(result.map((element) => [element.key, element.screens, element.only])).toEqual([['id:toolbar', 3, 3]]);
    expect(result[0].items[0]).toMatchObject({ name: 'Cards', imageName: 'r2.png', baselineName: 'r2-base.png', only: true });
    expect(result[0].items[0].current).toEqual({ x: 0, y: 0, width: 1080, height: 150 });
  });

  it('marks a screen where something else changed too as not decided by the element', () => {
    const result = elementReview([
      run('r1', 'Payments', ['id:toolbar']),
      run('r2', 'Cards', ['id:toolbar', 'id:btn_pay']),
      run('r3', 'Deposits', ['id:toolbar', null]),
      run('r4', 'Home', ['id:toolbar'], [{ kind: 'text', key: 'id:btn_pay' }]),
    ]);

    const toolbar = result.find((element) => element.key === 'id:toolbar');
    expect(toolbar).toMatchObject({ screens: 4, only: 1 });
    expect(toolbar.items.map((item) => [item.name, item.only])).toEqual([
      ['Payments', true],
      ['Cards', false],
      ['Deposits', false],
      ['Home', false],
    ]);
  });

  it('counts a change of the tree and leaves a move alone', () => {
    const result = elementReview([
      run(
        'r1',
        'Payments',
        [],
        [
          { kind: 'text', key: 'id:toolbar' },
          { kind: 'moved', key: 'id:btn_pay' },
        ]
      ),
      run('r2', 'Cards', [], [{ kind: 'removed', key: 'id:toolbar' }]),
    ]);

    expect(result.map((element) => [element.key, element.only])).toEqual([['id:toolbar', 2]]);
  });

  it('leaves out an element on one screen and keys that do not cross screens', () => {
    const result = elementReview([
      run('r1', 'Payments', ['id:toolbar', 'path:0/1']),
      run('r2', 'Cards', ['id:btn_pay', 'path:0/1']),
    ]);

    expect(result).toEqual([]);
  });

  it('puts the element changed on most screens first', () => {
    const result = elementReview([
      run('r1', 'A', ['id:btn_pay']),
      run('r2', 'B', ['id:btn_pay']),
      run('r3', 'C', ['id:toolbar']),
      run('r4', 'D', ['id:toolbar']),
      run('r5', 'E', ['id:toolbar']),
    ]);

    expect(result.map((element) => element.key)).toEqual(['id:toolbar', 'id:btn_pay']);
  });
});
