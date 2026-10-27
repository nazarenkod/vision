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

describe('UiTreeService.crossDevice', () => {
  const project = { mainBranchName: 'master', uiTreeSettings: JSON.stringify({ referenceDevice: reference }) };

  it('asks for a reference device when the project has none', async () => {
    const instance = service({ project: { findUnique: jest.fn().mockResolvedValue({ uiTreeSettings: null }) } }, {});
    expect(await instance.crossDevice(run())).toEqual({ status: 'no-reference' });
  });

  it('says so for a run on the reference device itself', async () => {
    const instance = service({ project: { findUnique: jest.fn().mockResolvedValue(project) } }, {});
    expect((await instance.crossDevice(run(reference))).status).toBe('is-reference');
  });

  it('compares with the reference device run of the same build first', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'ref-run', uiTreeName: 'ref.json.gz' });
    const instance = service(
      { project: { findUnique: jest.fn().mockResolvedValue(project) }, testRun: { findFirst } },
      { 'here.json.gz': disabled, 'ref.json.gz': tree }
    );

    const result = await instance.crossDevice(run());

    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      buildId: 'b1',
      name: 'Payment',
      device: 'Pixel 7 emulator',
      os: 'Android 15',
    });
    expect(result).toMatchObject({ status: 'compared', referenceSource: 'run', referenceTestRunId: 'ref-run' });
    expect(result.status === 'compared' && result.report.differences[0]).toMatchObject({
      key: 'id:com.bank.app:id/btn_pay',
      field: 'state',
    });
  });

  it('falls back to the reference device baseline, on the run branch before the main one', async () => {
    const instance = service(
      {
        project: { findUnique: jest.fn().mockResolvedValue(project) },
        testRun: { findFirst: jest.fn().mockResolvedValue(null) },
        testVariation: {
          findMany: jest.fn().mockResolvedValue([
            { branchName: 'master', baselineUiTreeName: 'master.json.gz' },
            { branchName: 'feature', baselineUiTreeName: 'feature.json.gz' },
          ]),
        },
      },
      { 'here.json.gz': tree, 'feature.json.gz': tree }
    );

    const result = await instance.crossDevice(run());

    expect(result).toMatchObject({ status: 'compared', referenceSource: 'baseline', referenceTestRunId: null });
    expect(result.status === 'compared' && result.report.differences).toEqual([]);
  });

  it('does not compare an iOS tree with an Android one', async () => {
    const ios = { ...tree, format: 'appium-ios' };
    const instance = service(
      {
        project: { findUnique: jest.fn().mockResolvedValue(project) },
        testRun: { findFirst: jest.fn().mockResolvedValue({ id: 'ref-run', uiTreeName: 'ref.json.gz' }) },
      },
      { 'here.json.gz': ios, 'ref.json.gz': tree }
    );
    expect((await instance.crossDevice(run())).status).toBe('other-platform');
  });

  it('keeps the result with the reviewer decision', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const instance = service(
      {
        project: { findUnique: jest.fn().mockResolvedValue(project) },
        testRun: { findFirst: jest.fn().mockResolvedValue({ id: 'ref-run', uiTreeName: 'ref.json.gz' }) },
        crossDeviceCheck: { upsert },
      },
      { 'here.json.gz': disabled, 'ref.json.gz': tree }
    );

    await instance.recordCrossDevice(run(), 'rejected');

    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({ testRunId: 'run' });
    expect(call.create).toMatchObject({
      testRunId: 'run',
      referenceDevice: 'Pixel 7 emulator · Android 15',
      differenceCount: 1,
      notFoundCount: 0,
      decision: 'rejected',
    });
  });
});

describe('UiTreeService, a device without its own baseline', () => {
  it("takes the check's baseline on the reference device, on the run branch first", async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'a', branchName: 'master', os: 'Android 15', device: 'Pixel 7 emulator', browser: '', viewport: '' },
      { id: 'b', branchName: 'feature', os: 'Android 13', device: 'BrowserStack Pixel 6', browser: '', viewport: '' },
      { id: 'c', branchName: 'feature', os: 'Android 15', device: 'Pixel 7 emulator', browser: '', viewport: '' },
    ]);
    const settings = parseUiTreeSettings(JSON.stringify({ referenceDevice: reference }));
    const picked = await service({ testVariation: { findMany } }, {})['otherDeviceBaseline'](
      run({ testVariationId: 'own' }),
      { mainBranchName: 'master' },
      settings
    );

    expect(picked.id).toBe('c');
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      name: 'Payment',
      customTags: '',
      branchName: { in: ['feature', 'master'] },
      id: { not: 'own' },
    });
  });

  it('warns about a wrong screen against another device, and never for a check with no baseline at all', async () => {
    const login = parseUiTree(
      `<hierarchy width="1080" height="2400"><android.widget.FrameLayout class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">` +
        `<android.widget.EditText class="android.widget.EditText" resource-id="com.bank.app:id/et_login" bounds="[0,100][1080,200]"/>` +
        `<android.widget.EditText class="android.widget.EditText" resource-id="com.bank.app:id/et_password" bounds="[0,300][1080,400]"/>` +
        `<android.widget.Button class="android.widget.Button" resource-id="com.bank.app:id/btn_sign_in" bounds="[0,500][1080,600]"/>` +
        `</android.widget.FrameLayout></hierarchy>`,
      { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 }
    );
    const findMany = jest.fn().mockResolvedValue([{ name: 'Login', baselineUiTreeName: 'login.json.gz' }]);
    const instance = service({ testVariation: { findMany } }, { 'login.json.gz': login });

    expect(await instance['screenWarnings'](run(), login, null, null)).toEqual([]);
    expect(await instance['screenWarnings'](run(), tree, tree, 'Pixel 7')).toEqual([]);
    expect(await instance['screenWarnings'](run(), login, tree, 'Pixel 7 emulator · Android 15')).toEqual([
      expect.objectContaining({
        kind: 'screen-mismatch',
        message: expect.stringContaining('this check on Pixel 7 emulator · Android 15'),
        looksLike: 'Login',
      }),
    ]);
  });
});

describe('UiTreeService.vocabulary', () => {
  it("reads the latest tree of each check from the last 30 days, naming screens by the project's title selectors", async () => {
    const findMany = jest.fn().mockResolvedValue([{ name: 'Payment check', uiTreeName: 'here.json.gz' }]);
    const findUnique = jest
      .fn()
      .mockResolvedValue({ uiTreeSettings: JSON.stringify({ screenTitle: ['id:toolbar_title'] }) });
    const vocabulary = await service(
      { testRun: { findMany }, project: { findUnique } },
      { 'here.json.gz': tree }
    ).vocabulary('p1');

    expect(vocabulary.screens).toEqual(['Payment']);
    const query = findMany.mock.calls[0][0];
    expect(query).toMatchObject({
      where: { projectId: 'p1', uiTreeName: { not: null } },
      distinct: ['testVariationId'],
    });
    const days = (Date.now() - query.where.createdAt.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(30);
  });
});
