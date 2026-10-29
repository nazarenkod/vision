import { readFileSync } from 'fs';
import path from 'path';
import { TestRun } from '@prisma/client';
import { UiTreeService } from './ui-tree.service';
import { parseUiTree } from './ui-tree.parser';
import { parseUiTreeSettings } from './comparison-inputs';

const xml = readFileSync(path.join(__dirname, '__fixtures__', 'android-payment.xml'), 'utf8');
const tree = parseUiTree(xml, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
const disabled = parseUiTree(
  xml.replace(
    'resource-id="com.bank.app:id/btn_pay" clickable="true" enabled="true"',
    'resource-id="com.bank.app:id/btn_pay" clickable="true" enabled="false"'
  ),
  { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 }
);

const reference = { os: 'Android 15', device: 'Pixel 7 emulator', browser: '', viewport: '' };
const run = (fields: Partial<TestRun> = {}) =>
  ({
    id: 'run',
    projectId: 'p1',
    buildId: 'b1',
    branchName: 'feature',
    name: 'Payment',
    customTags: '',
    os: 'Android 14',
    device: 'Galaxy S23',
    browser: '',
    viewport: '',
    uiTreeName: 'here.json.gz',
    ...fields,
  }) as TestRun;

function service(prisma: Record<string, unknown>, trees: Record<string, unknown>) {
  const instance = new UiTreeService({} as never, prisma as never);
  jest.spyOn(instance, 'load').mockImplementation(async (name) => (name ? ((trees[name] as never) ?? null) : null));
  return instance;
}

describe('UiTreeService.checkRules', () => {
  it('joins the rules kept by check with rules older versions kept on device variations', async () => {
    const settings = parseUiTreeSettings(
      JSON.stringify({ checkRules: { '["Payment",""]': [{ id: 'a', selector: 'id:banner', action: 'ignore' }] } })
    );
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { elementRules: JSON.stringify([{ id: 'b', selector: 'id:clock', action: 'ignore' }]) },
        { elementRules: JSON.stringify([{ id: 'a', selector: 'id:banner', action: 'ignore' }]) },
      ]);
    const rules = await service({ testVariation: { findMany } }, {}).checkRules(run(), settings);

    expect(rules.map((rule) => rule.id)).toEqual(['a', 'b']);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ projectId: 'p1', name: 'Payment', customTags: '' });
  });
});

const login = parseUiTree(
  `<hierarchy width="1080" height="2400"><android.widget.FrameLayout class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">` +
    `<android.widget.EditText class="android.widget.EditText" resource-id="com.bank.app:id/et_login" bounds="[0,100][1080,200]"/>` +
    `<android.widget.EditText class="android.widget.EditText" resource-id="com.bank.app:id/et_password" bounds="[0,300][1080,400]"/>` +
    `<android.widget.Button class="android.widget.Button" resource-id="com.bank.app:id/btn_sign_in" bounds="[0,500][1080,600]"/>` +
    `<android.widget.ProgressBar class="android.widget.ProgressBar" resource-id="com.bank.app:id/spinner" bounds="[490,1150][590,1250]"/>` +
    `</android.widget.FrameLayout></hierarchy>`,
  { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 }
);

/** analyze() with its file and image work stubbed: what it decides from the trees and the project. */
function analyzing(prisma: Record<string, unknown>, trees: Record<string, unknown>) {
  const saveFile = jest.fn().mockResolvedValue('a11y.json');
  const instance = new UiTreeService({ saveFile } as never, prisma as never);
  const load = jest
    .spyOn(instance, 'load')
    .mockImplementation(async (name) => (name ? ((trees[name] as never) ?? null) : null));
  jest.spyOn(instance as never, 'decode').mockResolvedValue(undefined as never);
  jest.spyOn(instance, 'comparisonInputs').mockResolvedValue({
    ignoreAreas: [],
    compareOnly: { active: false, moves: [], keep: [], ignoreOutside: [], problems: [] },
  } as never);
  return { instance, load };
}

describe('UiTreeService.analyze', () => {
  it('warns about neither a spinner nor another screen', async () => {
    const project = {
      mainBranchName: 'master',
      // switches an older version read; they turn nothing on now
      uiTreeSettings: JSON.stringify({ detectLoading: true, detectScreenMismatch: true }),
    };
    const { instance } = analyzing(
      {
        project: { findUnique: jest.fn().mockResolvedValue(project) },
        testVariation: { findMany: jest.fn().mockResolvedValue([]) },
      },
      { 'payment.json.gz': tree }
    );

    const result = await instance.analyze(run({ baselineUiTreeName: 'payment.json.gz' }), login);

    expect(Object.keys(result).sort()).toEqual(['components', 'invisible', 'report', 'reportName']);
  });
});

describe('UiTreeService, a device without its own baseline', () => {
  const candidates = [
    // newest first, as asked for
    { id: 'a', branchName: 'master', device: 'Galaxy S24', baselineUiTreeName: 'a.json.gz' },
    { id: 'b', branchName: 'feature', device: 'BrowserStack Pixel 6', baselineUiTreeName: 'b.json.gz' },
    { id: 'c', branchName: 'feature', device: 'Pixel 7 emulator', baselineUiTreeName: 'c.json.gz' },
  ];

  it('takes the newest baseline of the check on another device, on the run branch first', async () => {
    const findMany = jest.fn().mockResolvedValue(candidates);
    const picked = await service({ testVariation: { findMany } }, {})['otherDeviceBaseline'](
      run({ testVariationId: 'own' }),
      { mainBranchName: 'master' }
    );

    expect(picked.id).toBe('b');
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: {
        name: 'Payment',
        customTags: '',
        branchName: { in: ['feature', 'master'] },
        id: { not: 'own' },
      },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('ignores a reference device chosen before', async () => {
    const project = { mainBranchName: 'master', uiTreeSettings: JSON.stringify({ referenceDevice: reference }) };
    const { instance, load } = analyzing(
      {
        project: { findUnique: jest.fn().mockResolvedValue(project) },
        testVariation: { findMany: jest.fn().mockResolvedValue(candidates) },
      },
      { 'b.json.gz': tree, 'c.json.gz': tree }
    );

    await instance.analyze(run({ testVariationId: 'own', baselineUiTreeName: null }), tree);

    const loaded = load.mock.calls.map(([name]) => name);
    expect(loaded).toContain('b.json.gz');
    expect(loaded).not.toContain('c.json.gz');
  });
});

describe('UiTreeService, compare only', () => {
  const compareSettings = (selector = 'id:btn_pay') =>
    JSON.stringify({ checkRules: { '["Payment",""]': [{ id: 'c1', selector, action: 'compare' }] } });
  function compareService(trees: Record<string, unknown>, settings = compareSettings()) {
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ uiTreeSettings: settings }) },
      testVariation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const instance = new UiTreeService({ getImageBuffer: async () => null } as never, prisma as never);
    jest.spyOn(instance, 'load').mockImplementation(async (name) => (name ? ((trees[name] as never) ?? null) : null));
    return instance;
  }

  it("applies a check's compare-only rule on every device and branch", async () => {
    const instance = compareService({ 'here.json.gz': tree, 'base.json.gz': tree });
    for (const fields of [
      { device: 'Galaxy S23', branchName: 'feature' },
      { device: 'Pixel 7', os: 'Android 15', branchName: 'master' },
    ]) {
      const inputs = await instance.comparisonInputs(run({ ...fields, baselineUiTreeName: 'base.json.gz' }));
      expect(inputs.compareOnly.active).toBe(true);
      expect(inputs.compareOnly.keep).toEqual([{ x: 42, y: 2200, width: 996, height: 126 }]);
    }
  });

  it('never passes a compare-only run without a UI tree', async () => {
    const inputs = await compareService({}).comparisonInputs(run({ uiTreeName: null }));
    expect(inputs.compareOnly.problems).toEqual([{ kind: 'no-tree' }]);
    // without a tree nothing can be left out of the comparison either
    expect(inputs.ignoreAreas).toEqual([]);
  });

  it('reports no hidden change outside the compared elements', async () => {
    // the pay button got disabled; only the fee is compared
    const instance = compareService({ 'here.json.gz': disabled, 'base.json.gz': tree }, compareSettings('id:tv_fee'));
    const structure = await instance.structure(run({ baselineUiTreeName: 'base.json.gz' }));
    expect(structure.changes).toEqual([]);
    expect(structure.invisible).toEqual([]);

    const payOnly = compareService({ 'here.json.gz': disabled, 'base.json.gz': tree });
    const compared = await payOnly.structure(run({ baselineUiTreeName: 'base.json.gz' }));
    expect(compared.changes.length).toBeGreaterThan(0);
  });

  it('offers to ignore the element under a noise hint', async () => {
    const instance = compareService({ 'here.json.gz': tree }, JSON.stringify({}));
    jest.spyOn(instance, 'comparisonInputs').mockResolvedValue({
      ignoreAreas: [],
      toleranceAreas: [],
      moves: [],
      systemBars: [],
      rules: { ignore: [], tolerate: [], matches: {}, found: {} },
      settings: null,
      compareOnly: { active: false, moves: [], keep: [], ignoreOutside: [], problems: [] },
    });
    // the fee text changed on its own: a dynamic text hint over it
    const structure = await instance.structure(
      run({ diffRegions: JSON.stringify([{ x: 42, y: 1000, width: 458, height: 50 }]), diffPercent: 1 })
    );
    const withElement = structure.hints.filter((hint) => 'element' in hint);
    expect(withElement).toContainEqual(
      expect.objectContaining({ element: expect.objectContaining({ selector: 'id:tv_fee' }) })
    );
  });
});
