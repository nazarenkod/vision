import { readFileSync } from 'fs';
import path from 'path';
import { TestRun } from '@prisma/client';
import { generateTestRun, TEST_PROJECT } from '../_data_';
import { parseUiTree } from '../ui-tree/ui-tree.parser';
import { UiTree } from '../ui-tree/ui-tree.types';
import { ChangeGroupsService } from './change-groups.service';

const xml = readFileSync(path.join(__dirname, '../ui-tree/__fixtures__/android-payment.xml'), 'utf8');
const tree = (source: string) => parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });

function setup(runs: TestRun[], trees: Record<string, UiTree>, signatures: Record<string, number[] | null>) {
  const prismaService = {
    testRun: { findMany: jest.fn().mockResolvedValue(runs) },
    project: { findUnique: jest.fn().mockResolvedValue(TEST_PROJECT) },
  };
  const uiTreeService = { load: jest.fn(async (name: string) => trees[name] ?? null) };
  const testRunsService = { getChangeSignature: jest.fn(async (run: TestRun) => signatures[run.id] ?? null) };
  const staticService = { getImageBuffer: jest.fn().mockResolvedValue(null) };
  return new ChangeGroupsService(
    prismaService as never,
    staticService as never,
    uiTreeService as never,
    testRunsService as never
  );
}

const run = (id: string, overrides: Partial<TestRun> = {}) =>
  generateTestRun({ id, status: 'unresolved', baselineName: `${id}.baseline.png`, diffPercent: 2, ...overrides });

describe('ChangeGroupsService', () => {
  it('groups the same element change across screens when UI trees are available', async () => {
    const base = tree(xml);
    const payRenamed = tree(xml.replace('text="Pay"', 'text="Send"'));
    const otherChange = tree(xml.replace('text="Commission 0 UAH"', 'text="Fee 0 UAH"'));
    const runs = [
      run('a', { name: 'Payment', uiTreeName: 'ta', baselineUiTreeName: 'base' }),
      run('b', { name: 'Transfer', uiTreeName: 'tb', baselineUiTreeName: 'base', device: 'Galaxy' }),
      run('c', { name: 'Payment', uiTreeName: 'tc', baselineUiTreeName: 'base' }),
    ];
    const service = setup(runs, { base, ta: payRenamed, tb: payRenamed, tc: otherChange }, {});

    const groups = await service.getGroups('build');

    expect(groups.map((g) => [g.kind, g.title, g.testRuns.map((r) => r.id)])).toEqual([
      ['structural', 'Button "Send" (id/btn_pay)', ['a', 'b']],
      ['structural', 'TextView "Fee 0 UAH" (id/tv_fee)', ['c']],
    ]);
    expect(groups[0].screens).toEqual(['Payment', 'Transfer']);
    expect(groups[0].changes[0]).toMatchObject({ kind: 'text', before: 'Pay', after: 'Send' });
  });

  it('groups runs of one screen with matching change signatures, and lists new screenshots last', async () => {
    const same = Array.from({ length: 64 }, (_, i) => (i === 3 ? 1 : 0));
    const different = Array.from({ length: 64 }, (_, i) => (i === 40 ? 1 : 0));
    const runs = [
      run('a', { name: 'Home', browser: 'chrome' }),
      run('b', { name: 'Home', browser: 'firefox', diffPercent: 2.5 }),
      run('c', { name: 'Home', browser: 'safari' }),
      run('d', { name: 'Home', browser: 'edge', diffPercent: 30 }),
      run('e', { name: 'Login', status: 'new', baselineName: null }),
    ];
    const service = setup(runs, {}, { a: same, b: same, c: different, d: same });

    const groups = await service.getGroups('build');

    expect(groups.map((g) => [g.kind, g.testRuns.map((r) => r.id)])).toEqual([
      ['visual', ['a', 'b']],
      ['visual', ['c']],
      ['visual', ['d']],
      ['new', ['e']],
    ]);
    expect(groups[0].id).toHaveLength(16);
  });

  it('marks a group whose members only changed in the status bar', async () => {
    const regions = JSON.stringify([{ x: 900, y: 10, width: 100, height: 30 }]);
    const runs = [
      run('a', { name: 'Home', diffRegions: regions, uiTreeName: 't', baselineUiTreeName: 't' }),
      run('b', { name: 'Home', diffRegions: regions, uiTreeName: 't', baselineUiTreeName: 't' }),
    ];
    const signature = Array.from({ length: 64 }, (_, i) => (i === 0 ? 1 : 0));
    const service = setup(runs, { t: tree(xml) }, { a: signature, b: signature });

    const [group] = await service.getGroups('build');

    expect(group.testRuns).toHaveLength(2);
    expect(group.noise).toMatchObject({ kind: 'status-bar' });
  });
});
