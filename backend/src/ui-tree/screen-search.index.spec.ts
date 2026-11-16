import { ScreenSearchIndex } from './screen-search.index';
import { UiTree } from './ui-tree.types';

const treeNamed = (name: string) => ({ nodes: [], format: 'appium-android', name }) as unknown as UiTree;

describe('ScreenSearchIndex', () => {
  it('sees the new tree on the next search after a new baseline', async () => {
    const load = jest.fn(async (name: string) => treeNamed(name));
    const index = new ScreenSearchIndex(load);

    await index.treesFor('p', [{ variationId: 'v1', treeName: 'old.gz' }]);
    const trees = await index.treesFor('p', [{ variationId: 'v1', treeName: 'new.gz' }]);

    expect((trees.get('v1') as unknown as { name: string }).name).toBe('new.gz');
    expect(load.mock.calls.map(([name]) => name)).toEqual(['old.gz', 'new.gz']);
  });

  it('reads a tree once while its baseline stays', async () => {
    const load = jest.fn(async (name: string) => treeNamed(name));
    const index = new ScreenSearchIndex(load);

    await index.treesFor('p', [{ variationId: 'v1', treeName: 'a.gz' }]);
    await index.treesFor('p', [{ variationId: 'v1', treeName: 'a.gz' }]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('forgets a variation that is gone and a tree it cannot read', async () => {
    const index = new ScreenSearchIndex(async (name) => (name === 'broken.gz' ? null : treeNamed(name)));

    await index.treesFor('p', [{ variationId: 'v1', treeName: 'a.gz' }]);
    const trees = await index.treesFor('p', [{ variationId: 'v2', treeName: 'broken.gz' }]);

    expect([...trees.keys()]).toEqual([]);
  });

  it('drops the project used longest ago', async () => {
    const index = new ScreenSearchIndex(async (name) => treeNamed(name), 2);

    await index.treesFor('a', []);
    await index.treesFor('b', []);
    await index.treesFor('a', []);
    await index.treesFor('c', []);

    expect(['a', 'b', 'c'].filter((id) => index.has(id))).toEqual(['a', 'c']);
  });
});
