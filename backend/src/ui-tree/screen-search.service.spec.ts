import { NotFoundException } from '@nestjs/common';
import { ScreenSearchService, SEARCH_PAGE_SIZE } from './screen-search.service';
import { UiNode, UiTree } from './ui-tree.types';

const node = (index: number, over: Partial<UiNode>): UiNode => ({
  index,
  parent: null,
  depth: 0,
  key: `path:${index}`,
  className: 'android.widget.TextView',
  resourceId: '',
  text: '',
  label: '',
  hint: '',
  clickable: false,
  focusable: false,
  enabled: true,
  visible: true,
  accessible: true,
  bounds: { x: 10, y: index * 100, width: 300, height: 60 },
  ...over,
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

const variation = (id: string, name: string, device: string, treeName: string | null) => ({
  id,
  name,
  customTags: '',
  device,
  os: 'Android 14',
  browser: '',
  viewport: '',
  baselineName: `${id}.png`,
  baselineUiTreeName: treeName,
});

function setup(
  trees: Record<string, UiTree>,
  variations = [
    variation('v1', 'Cards.Details', 'Pixel 7', 'card-pixel.gz'),
    variation('v2', 'Cards.Details', 'Galaxy S23', 'card-galaxy.gz'),
    variation('v3', 'Home.Main', 'Pixel 7', 'home.gz'),
    variation('v4', 'Profile.Main', 'Pixel 7', null),
  ]
) {
  const prisma = {
    project: {
      findUnique: jest.fn().mockResolvedValue({ mainBranchName: 'master', uiTreeSettings: null }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    testVariation: { findMany: jest.fn().mockResolvedValue(variations) },
    baseline: {
      findMany: jest.fn().mockResolvedValue([
        { testVariationId: 'v1', baselineName: 'v1.png', testRun: { imageThumbnailName: 'v1-small.png' } },
        { testVariationId: 'v1', baselineName: 'older.png', testRun: { imageThumbnailName: 'older-small.png' } },
      ]),
    },
    build: { findFirst: jest.fn().mockResolvedValue({ id: 'b1' }) },
    testRun: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const uiTreeService = { load: jest.fn(async (name: string | null) => (name ? (trees[name] ?? null) : null)) };
  const service = new ScreenSearchService(prisma as never, uiTreeService as never);
  return { service, prisma, uiTreeService };
}

const cashback = (index: number) => node(index, { key: `id:cashback${index}`, text: 'Кешбек 5 %' });

describe('ScreenSearchService', () => {
  it('searches the latest baseline of every device on the main branch', async () => {
    const { service, prisma } = setup({ 'card-pixel.gz': tree(cashback(0)), 'card-galaxy.gz': tree(cashback(0)) });

    const result = await service.search('p1', 'кешбек', {});

    expect(prisma.testVariation.findMany.mock.calls[0][0].where).toEqual({
      projectId: 'p1',
      branchName: 'master',
      baselineName: { not: null },
    });
    expect(result.rows[0].items.map((item) => item.device)).toEqual(['Galaxy S23', 'Pixel 7']);
  });

  it('returns one row per check by name with a picture per device', async () => {
    const { service } = setup({
      'card-pixel.gz': tree(cashback(0), cashback(1)),
      'card-galaxy.gz': tree(cashback(0)),
      'home.gz': tree(cashback(3)),
    });

    const result = await service.search('p1', 'кешбек', {});

    expect(result.rows.map((row) => [row.name, row.matches, row.items.length])).toEqual([
      ['Cards.Details', 3, 2],
      ['Home.Main', 1, 1],
    ]);
    const pixel = result.rows[0].items.find((item) => item.device === 'Pixel 7');
    expect(pixel).toMatchObject({
      imageName: 'v1.png',
      imageThumbnailName: 'v1-small.png',
      width: 1080,
      keys: ['id:cashback0', 'id:cashback1'],
    });
    expect(result.rows[0].where).toEqual(['text']);
  });

  it('counts screens without a UI tree as not scanned', async () => {
    const { service } = setup({ 'card-pixel.gz': tree(), 'card-galaxy.gz': tree(), 'home.gz': tree() });

    const result = await service.search('p1', 'кешбек', {});

    expect(result).toMatchObject({ scanned: 3, withoutTree: 1, total: 0, rows: [] });
  });

  it('pages a hundred checks at a time with the total', async () => {
    const many = Array.from({ length: SEARCH_PAGE_SIZE + 5 }, (_, i) =>
      variation(`v${i}`, `Check.${String(i).padStart(3, '0')}`, 'Pixel 7', `t${i}.gz`)
    );
    const trees = Object.fromEntries(many.map((_, i) => [`t${i}.gz`, tree(cashback(0))]));
    const { service } = setup(trees, many);

    const first = await service.search('p1', 'кешбек', {});
    const second = await service.search('p1', 'кешбек', {}, 1);

    expect([first.total, first.rows.length, second.rows.length]).toEqual([SEARCH_PAGE_SIZE + 5, SEARCH_PAGE_SIZE, 5]);
    expect(second.rows[0].name).toBe(`Check.${SEARCH_PAGE_SIZE}`);
  });

  it('explains a selector it cannot read and returns no rows', async () => {
    const { service, prisma } = setup({});

    const result = await service.search('p1', 'text:/(a)\\1/', {});

    expect(result).toMatchObject({ problem: 'pattern', rows: [], total: 0 });
    expect(prisma.testVariation.findMany).not.toHaveBeenCalled();
  });

  it('answers not found for an unknown project', async () => {
    const { service, prisma } = setup({});
    prisma.project.findUnique.mockResolvedValue(null);

    await expect(service.search('nope', 'кешбек', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('searches the screens of a build instead of baselines', async () => {
    const { service, prisma } = setup({ 'run.gz': tree(node(0, { key: 'id:new', text: 'Нова функція' })) });
    prisma.testRun.findMany.mockResolvedValue([
      {
        id: 'r1',
        testVariationId: 'v1',
        name: 'Home.Main',
        customTags: '',
        device: 'Pixel 7',
        os: 'Android 14',
        browser: '',
        viewport: '',
        imageName: 'r1.png',
        imageThumbnailName: 'r1-small.png',
        uiTreeName: 'run.gz',
      },
    ]);

    const result = await service.search('p1', 'нова функція', { buildId: 'b1' });

    expect(prisma.build.findFirst).toHaveBeenCalledWith({ where: { id: 'b1', projectId: 'p1' }, select: { id: true } });
    expect(prisma.testVariation.findMany).not.toHaveBeenCalled();
    expect(result.rows[0].items[0]).toMatchObject({ id: 'r1', imageThumbnailName: 'r1-small.png' });
  });

  it('never returns screens of a build of another project', async () => {
    const { service, prisma } = setup({});
    prisma.build.findFirst.mockResolvedValue(null);

    await expect(service.search('p1', 'кешбек', { buildId: 'theirs' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.testRun.findMany).not.toHaveBeenCalled();
  });

  it('never returns checks of another project', async () => {
    const { service, prisma } = setup({});

    await service.search('p1', 'кешбек', {});

    expect(prisma.testVariation.findMany.mock.calls[0][0].where.projectId).toBe('p1');
  });

  it('searches without calling the AI service', () => {
    // the service is built from the database and the tree files alone: nothing else to call
    expect(ScreenSearchService.length).toBe(2);
  });
});

describe('ScreenSearchService.suggest', () => {
  it('suggests from the latest baselines, counting each check once', async () => {
    const { service } = setup({
      'card-pixel.gz': tree(cashback(0)),
      'card-galaxy.gz': tree(cashback(0)),
      'home.gz': tree(cashback(1)),
    });

    expect(await service.suggest('p1', 'кеш', {})).toEqual([{ kind: 'text', query: 'Кешбек 5 %', screens: 2 }]);
  });
});
