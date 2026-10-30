import { mocked } from 'jest-mock';
import { Test, TestingModule } from '@nestjs/testing';
import { mapWithConcurrency, SIGNATURE_CONCURRENCY, TestRunsService } from './test-runs.service';
import { DEFAULT_CONFIG } from '../compare/libs/pixelmatch/pixelmatch.service';
import { SIGNATURE_LENGTH } from '../compare/libs/pixelmatch/signature.core';
import { PrismaService } from '../prisma/prisma.service';
import { StaticService } from '../static/static.service';
import { TestStatus, TestRun, TestVariation } from '@prisma/client';
import { CreateTestRequestDto } from './dto/create-test-request.dto';
import { TestRunResultDto } from './dto/testRunResult.dto';
import { DiffResult } from './diffResult';
import { EventsGateway } from '../shared/events/events.gateway';
import { TestVariationsService } from '../test-variations/test-variations.service';
import { TestRunDto } from '../test-runs/dto/testRun.dto';
import { BuildsService } from '../builds/builds.service';
import { generateBaseline, generateTestRun, generateTestVariation, TEST_PROJECT } from '../_data_';
import { UnprocessableEntityException } from '@nestjs/common';
import { getTestVariationUniqueData } from '../utils';
import { BaselineDataDto } from '../shared/dto/baseline-data.dto';
import { CompareService } from '../compare/compare.service';
import { UpdateTestRunDto } from './dto/update-test.dto';
import { UiTreeService } from '../ui-tree/ui-tree.service';
import { A11yIssuesService } from '../a11y/a11y-issues.service';
import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from '../ui-tree/ui-tree.parser';

jest.mock('pixelmatch');
jest.mock('./dto/testRunResult.dto');

const initService = async ({
  testRunDeleteMock = jest.fn(),
  testRunUpdateMock = jest.fn(),
  testRunFindUniqueMock = jest.fn(),
  testRunFindManyMock = jest.fn(),
  testRunCreateMock = jest.fn(),
  testRunCountMock = jest.fn(),
  getImageMock = jest.fn(),
  saveImageMock = jest.fn(),
  deleteImageMock = jest.fn(),
  eventTestRunUpdatedMock = jest.fn(),
  eventTestRunCreatedMock = jest.fn(),
  eventTestRunDeletedMock = jest.fn(),
  eventBuildUpdatedMock = jest.fn(),
  eventBuildCreatedMock = jest.fn(),
  testVariationCreateMock = jest.fn(),
  testVariationFindManyMock = jest.fn(),
  baselineCreateMock = jest.fn(),
  testVariationFindMock = jest.fn(),
  testVariationUpdateMock = jest.fn(),
  testVariationGetDetailsMock = jest.fn(),
  testVariationFindUniqueMock = jest.fn(),
  projectFindUniqueMock = jest.fn(),
  compareGetDiffMock = jest.fn(),
  compareGetChangeSignatureMock = jest.fn(),
  getImageBufferMock = jest.fn(),
}) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TestRunsService,
      {
        provide: PrismaService,
        useValue: {
          testRun: {
            delete: testRunDeleteMock,
            findMany: testRunFindManyMock,
            findUnique: testRunFindUniqueMock,
            create: testRunCreateMock,
            update: testRunUpdateMock,
            count: testRunCountMock,
          },
          testVariation: {
            create: testVariationCreateMock,
            findMany: testVariationFindManyMock,
            findUnique: testVariationFindUniqueMock,
          },
          baseline: {
            create: baselineCreateMock,
          },
          project: {
            findUnique: projectFindUniqueMock,
          },
        },
      },
      {
        provide: StaticService,
        useValue: {
          getImage: getImageMock,
          getImageBuffer: getImageBufferMock,
          saveImage: saveImageMock,
          deleteImage: deleteImageMock,
        },
      },
      {
        provide: EventsGateway,
        useValue: {
          testRunUpdated: eventTestRunUpdatedMock,
          testRunCreated: eventTestRunCreatedMock,
          testRunDeleted: eventTestRunDeletedMock,
          buildUpdated: eventBuildUpdatedMock,
          buildCreated: eventBuildCreatedMock,
        },
      },
      {
        provide: UiTreeService,
        useValue: {
          store: jest.fn().mockResolvedValue(null),
          comparisonInputs: jest.fn().mockResolvedValue({
            ignoreAreas: [],
            toleranceAreas: [],
            moves: [],
            systemBars: [],
            rules: { ignore: [], tolerate: [], matches: {}, found: {} },
            settings: null,
            compareOnly: { active: false, moves: [], keep: [], compared: [], ignoreOutside: [], problems: [] },
          }),
          deleteFiles: jest.fn().mockResolvedValue(undefined),
          recheck: jest.fn().mockResolvedValue({ components: [], invisible: [] }),
        },
      },
      {
        provide: A11yIssuesService,
        useValue: { countsFor: jest.fn(), getReviewedReport: jest.fn() },
      },
      {
        provide: TestVariationsService,
        useValue: {
          find: testVariationFindMock,
          getDetails: testVariationGetDetailsMock,
          update: testVariationUpdateMock,
        },
      },
      {
        provide: BuildsService,
        useValue: {},
      },
      {
        provide: CompareService,
        useValue: {
          getDiff: compareGetDiffMock,
          getChangeSignature: compareGetChangeSignatureMock,
        },
      },
    ],
  }).compile();

  return module.get<TestRunsService>(TestRunsService);
};
describe('TestRunsService', () => {
  let service: TestRunsService;
  const imageBuffer = Buffer.from('Image');
  const ignoreAreas = [{ x: 1, y: 2, width: 10, height: 20 }];

  it('findOne', async () => {
    const id = 'some id';
    const testRunFindUniqueMock = jest.fn();
    service = await initService({
      testRunFindUniqueMock,
    });

    service.findOne(id);

    expect(testRunFindUniqueMock).toHaveBeenCalledWith({
      where: { id },
      include: {
        testVariation: true,
      },
    });
  });

  it('setStatus', async () => {
    const testRun = {
      id: 'id',
      imageName: 'imageName',
      diffTollerancePercent: 12,
      status: TestStatus.new,
      buildId: 'buildId',
      testVariationId: 'testVariationId',
      updatedAt: new Date(),
      createdAt: new Date(),
      name: 'test run name',
      ignoreAreas: '[]',
    };
    const testRunUpdateMock = jest.fn().mockResolvedValueOnce(testRun);
    const eventTestRunUpdatedMock = jest.fn();
    service = await initService({
      testRunUpdateMock,
      eventTestRunUpdatedMock,
    });

    await service.setStatus(testRun.id, TestStatus.failed);

    expect(testRunUpdateMock).toHaveBeenCalledWith({
      where: { id: testRun.id },
      data: {
        status: TestStatus.failed,
      },
    });
    expect(eventTestRunUpdatedMock).toBeCalledWith(testRun);
  });

  it('setStatus compares nothing with a reference device', async () => {
    const testRun = { id: 'id', status: TestStatus.approved, uiTreeName: 'tree.json.gz' };
    service = await initService({ testRunUpdateMock: jest.fn().mockResolvedValueOnce(testRun) });

    await service.setStatus(testRun.id, TestStatus.approved);

    // a decision once also compared the run with the reference device and kept the result
    for (const mock of Object.values(service['uiTreeService'] as unknown as Record<string, jest.Mock>)) {
      expect(mock).not.toHaveBeenCalled();
    }
  });

  it('create', async () => {
    const initCreateTestRequestDto: CreateTestRequestDto = {
      buildId: 'buildId',
      projectId: 'projectId',
      name: 'Test name',
      os: 'OS',
      browser: 'browser',
      viewport: 'viewport',
      device: 'device',
      customTags: '',
      diffTollerancePercent: undefined,
      branchName: 'develop',
      merge: true,
      ignoreAreas: [
        {
          x: 1,
          y: 2,
          width: 100,
          height: 200,
        },
      ],
    };
    const testRunWithResult = {
      id: 'id',
      imageName: 'imageName',
      baselineName: 'baselineName',
      baselineUiTreeName: null,
      elementRules: null,
      diffTollerancePercent: 1,
      ignoreAreas: '[]',
      diffName: 'diffName',
      status: TestStatus.unresolved,
    };

    const testRun = {
      id: 'id',
      imageName: 'imageName',
      baselineName: 'baselineName',
      diffTollerancePercent: 1,
      ignoreAreas: '[]',
      diffName: null,
    };
    const testVariation = {
      id: '123',
      projectId: 'project Id',
      name: 'Test name',
      baselineName: 'baselineName',
      baselineUiTreeName: null,
      elementRules: null,
      os: 'OS',
      browser: 'browser',
      viewport: 'viewport',
      device: 'device',
      customTags: '',
      ignoreAreas: '[{"x":3,"y":4,"width":500,"height":600}]',
      comment: 'some comment',
      createdAt: new Date(),
      updatedAt: new Date(),
      branchName: 'master',
    };
    const diffResult: DiffResult = {
      status: TestStatus.unresolved,
      diffName: 'diff image name',
      pixelMisMatchCount: 11,
      diffPercent: 22,
      isSameDimension: true,
    };
    const createTestRequestDto = initCreateTestRequestDto;
    const testRunCreateMock = jest.fn().mockResolvedValueOnce(testRun);
    const imageName = 'image name';
    const saveImageMock = jest.fn().mockReturnValueOnce(imageName);
    const image = 'image';
    const baseline = 'baseline';
    const getImageMock = jest.fn().mockReturnValueOnce(baseline).mockReturnValueOnce(image);
    const eventTestRunCreatedMock = jest.fn();
    const compareGetDiffMock = jest.fn().mockReturnValueOnce(diffResult);
    service = await initService({
      testRunCreateMock,
      saveImageMock,
      getImageMock,
      eventTestRunCreatedMock,
      compareGetDiffMock,
    });

    const saveDiffResultMock = jest.fn();
    service.saveDiffResult = saveDiffResultMock.mockResolvedValueOnce(testRunWithResult);
    const tryAutoApproveByPastBaselines = jest.fn();
    service['tryAutoApproveByPastBaselines'] = tryAutoApproveByPastBaselines.mockResolvedValueOnce(testRunWithResult);
    const tryAutoApproveByNewBaselines = jest.fn();
    service['tryAutoApproveByNewBaselines'] = tryAutoApproveByNewBaselines.mockResolvedValueOnce(testRunWithResult);

    const result = await service.create({ testVariation, createTestRequestDto, imageBuffer });

    expect(saveImageMock).toHaveBeenCalledWith('screenshot', imageBuffer);
    expect(testRunCreateMock).toHaveBeenCalledWith({
      data: {
        imageName,
        testVariation: {
          connect: {
            id: testVariation.id,
          },
        },
        build: {
          connect: {
            id: createTestRequestDto.buildId,
          },
        },
        project: {
          connect: {
            id: createTestRequestDto.projectId,
          },
        },
        name: testVariation.name,
        browser: testVariation.browser,
        device: testVariation.device,
        os: testVariation.os,
        viewport: testVariation.viewport,
        customTags: testVariation.customTags,
        baselineName: testVariation.baselineName,
        baselineUiTreeName: testVariation.baselineUiTreeName,
        uiTreeName: undefined,
        featureName: null,
        uiTreeOptions: null,
        ignoreAreas: testVariation.ignoreAreas,
        tempIgnoreAreas: JSON.stringify(createTestRequestDto.ignoreAreas),
        comment: testVariation.comment,
        baselineBranchName: testVariation.branchName,
        branchName: createTestRequestDto.branchName,
        diffTollerancePercent: createTestRequestDto.diffTollerancePercent,
        merge: createTestRequestDto.merge,
        status: TestStatus.new,
      },
    });
    expect(result).toBe(testRun);
  });

  it('calculateDiff keeps a run in review when the pixels match but an element change stays hidden', async () => {
    const testRun = generateTestRun({ uiTreeName: 'tree.json.gz', a11yReportName: 'a11y.json' });
    const passed = { ...testRun, status: TestStatus.ok };
    const testRunUpdateMock = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...passed, ...data }));
    service = await initService({
      testRunUpdateMock,
      compareGetDiffMock: jest.fn().mockResolvedValueOnce({ status: TestStatus.ok }),
    });
    service.saveDiffResult = jest.fn().mockResolvedValueOnce(passed);
    service['uiTreeService'].recheck = jest.fn().mockResolvedValueOnce({
      components: [],
      invisible: [{ kind: 'state', key: 'id:btn_pay' }],
    });

    const result = await service.calculateDiff('projectId', testRun);

    expect(testRunUpdateMock).toHaveBeenCalledWith({
      where: { id: testRun.id },
      data: { componentChanges: null, semanticChangeCount: 1, status: TestStatus.unresolved },
    });
    expect(result.status).toBe(TestStatus.unresolved);
  });

  it('calculateDiff', async () => {
    const testRun: TestRun = generateTestRun();
    const testRunUpdateMock = jest.fn();
    const deleteImageMock = jest.fn();
    const diffResult = {
      id: 'test',
    };
    const compareGetDiffMock = jest.fn().mockReturnValueOnce(diffResult);
    service = await initService({
      testRunUpdateMock,
      deleteImageMock,
      compareGetDiffMock,
    });
    service.saveDiffResult = jest.fn();

    await service.calculateDiff('projectId', testRun);

    expect(deleteImageMock).toHaveBeenCalledWith(testRun.diffName);
    expect(compareGetDiffMock).toHaveBeenCalledWith({
      projectId: 'projectId',
      data: {
        image: testRun.imageName,
        baseline: testRun.baselineName,
        ignoreAreas: service['getAllIgnoteAreas'](testRun),
        diffTollerancePercent: testRun.diffTollerancePercent,
        saveDiffAsFile: true,
        moves: [],
        toleranceAreas: [],
      },
    });
    expect(service.saveDiffResult).toHaveBeenCalledWith(testRun.id, diffResult);
  });

  it('sends a run whose compared element is gone to review', async () => {
    const testRun = generateTestRun({ uiTreeName: 'tree.json.gz' });
    const passed = { ...testRun, status: TestStatus.ok };
    const testRunUpdateMock = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...passed, ...data }));
    const compareGetDiffMock = jest.fn().mockResolvedValueOnce({ status: TestStatus.ok });
    service = await initService({ testRunUpdateMock, compareGetDiffMock });
    service.saveDiffResult = jest.fn().mockResolvedValueOnce(passed);
    const keep = [{ x: 42, y: 2200, width: 996, height: 126 }];
    service['uiTreeService'].comparisonInputs = jest.fn().mockResolvedValueOnce({
      ignoreAreas: [],
      toleranceAreas: [],
      moves: [],
      systemBars: [],
      rules: { ignore: [], tolerate: [], matches: {}, found: {} },
      settings: null,
      compareOnly: {
        active: true,
        moves: [],
        keep,
        ignoreOutside: [],
        problems: [{ kind: 'disappeared', ruleId: 'c1', selector: 'id:btn_pay', element: 'Button “Pay”' }],
      },
    });

    const result = await service.calculateDiff('projectId', testRun);

    // the difference is measured against the compared element (ADR-0018)
    expect(compareGetDiffMock.mock.calls[0][0].data.measureAreas).toEqual(keep);
    expect(testRunUpdateMock).toHaveBeenCalledWith({
      where: { id: testRun.id },
      data: { status: TestStatus.unresolved },
    });
    expect(result.status).toBe(TestStatus.unresolved);
  });

  it('keeps a run compared by one tree in review', async () => {
    // a baseline from before UI trees: the field is compared at its place, nothing changed there
    const testRun = generateTestRun({ uiTreeName: 'tree.json.gz', baselineUiTreeName: null });
    const passed = { ...testRun, status: TestStatus.ok };
    const testRunUpdateMock = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...passed, ...data }));
    const compareGetDiffMock = jest.fn().mockResolvedValueOnce({ status: TestStatus.ok });
    service = await initService({ testRunUpdateMock, compareGetDiffMock });
    service.saveDiffResult = jest.fn().mockResolvedValueOnce(passed);
    const keep = [{ x: 0, y: 1300, width: 1440, height: 200 }];
    const ignoreOutside = [
      { x: 0, y: 0, width: 1440, height: 1300 },
      { x: 0, y: 1500, width: 1440, height: 1620 },
    ];
    service['uiTreeService'].comparisonInputs = jest.fn().mockResolvedValueOnce({
      ignoreAreas: ignoreOutside,
      toleranceAreas: [],
      moves: [],
      systemBars: [],
      systemBarsFrom: null,
      rules: { ignore: [], tolerate: [], matches: {}, found: {} },
      settings: null,
      compareOnly: {
        active: true,
        moves: [],
        keep,
        compared: [],
        ignoreOutside,
        problems: [{ kind: 'one-tree', missing: 'baseline' }],
      },
    });

    const result = await service.calculateDiff('projectId', testRun);

    expect(compareGetDiffMock.mock.calls[0][0].data.measureAreas).toEqual(keep);
    expect(compareGetDiffMock.mock.calls[0][0].data.ignoreAreas).toEqual(expect.arrayContaining(ignoreOutside));
    expect(result.status).toBe(TestStatus.unresolved);
  });

  describe('element rules', () => {
    it('keeps a rule for this screen by check, so every device and branch gets it', async () => {
      const testRun = generateTestRun({ name: 'Payment', customTags: '', uiTreeName: 'tree.json.gz' });
      const projectUpdateMock = jest.fn().mockResolvedValue({});
      const updateManyMock = jest.fn().mockResolvedValue({ count: 1 });
      const testRunFindManyMock = jest.fn().mockResolvedValue([]);
      service = await initService({
        testRunFindManyMock,
        projectFindUniqueMock: jest.fn().mockResolvedValue({ uiTreeSettings: null }),
      });
      service.findOne = jest.fn().mockResolvedValue(testRun);
      service.calculateDiff = jest.fn().mockResolvedValue(testRun);
      service['prismaService'].project['update'] = projectUpdateMock;
      service['prismaService'].testVariation['updateMany'] = updateManyMock;
      service['uiTreeService'].checkRules = jest
        .fn()
        .mockResolvedValue([{ id: 'old', selector: 'id:clock', action: 'ignore' }]);

      const rule = await service.addElementRule(testRun.id, {
        scope: 'screen',
        selector: 'id:banner',
        action: 'ignore',
      } as never);

      const settings = JSON.parse(projectUpdateMock.mock.calls[0][0].data.uiTreeSettings);
      expect(settings.checkRules['["Payment",""]'].map((r) => r.id)).toEqual(['old', rule.id]);
      // rules an earlier version kept on device variations moved to the check
      expect(updateManyMock.mock.calls[0][0]).toMatchObject({
        where: { projectId: testRun.projectId, name: 'Payment', customTags: '' },
        data: { elementRules: null },
      });
      // the other devices of the check in the build are compared again
      expect(testRunFindManyMock.mock.calls[0][0].where).toMatchObject({ name: 'Payment', customTags: '' });
      expect(testRunFindManyMock.mock.calls[0][0].where.testVariationId).toBeUndefined();
    });
  });

  describe('compare only and areas', () => {
    it('refuses a compare-only rule for every screen', async () => {
      service = await initService({});
      service.findOne = jest.fn();
      await expect(
        service.addElementRule('run', { scope: 'project', selector: 'id:btn_pay', action: 'compare' })
      ).rejects.toThrow('Compare only applies to one screen');
      expect(service.findOne).not.toHaveBeenCalled();
    });

    it('replaces an area with an ignore rule and compares once', async () => {
      const banner = { id: 'a1', x: 0, y: 200, width: 1080, height: 300 };
      const other = { id: 'a2', x: 0, y: 0, width: 10, height: 10 };
      const testRun = generateTestRun({
        name: 'Payment',
        customTags: '',
        ignoreAreas: JSON.stringify([banner, other]),
      });
      const projectUpdateMock = jest.fn().mockResolvedValue({});
      service = await initService({
        projectFindUniqueMock: jest.fn().mockResolvedValue({ uiTreeSettings: null }),
      });
      service.findOne = jest.fn().mockResolvedValue(testRun);
      service.calculateDiff = jest.fn();
      service.updateIgnoreAreas = jest.fn().mockResolvedValue(testRun);
      service['prismaService'].project['update'] = projectUpdateMock;
      service['prismaService'].testVariation['updateMany'] = jest.fn().mockResolvedValue({ count: 0 });
      service['uiTreeService'].checkRules = jest.fn().mockResolvedValue([]);

      const { rule, area } = await service.replaceAreaWithElement(testRun.id, { areaId: 'a1', selector: 'id:banner' });

      expect(area).toEqual(banner);
      const settings = JSON.parse(projectUpdateMock.mock.calls[0][0].data.uiTreeSettings);
      expect(settings.checkRules['["Payment",""]']).toEqual([{ id: rule.id, selector: 'id:banner', action: 'ignore' }]);
      expect(service.updateIgnoreAreas).toHaveBeenCalledWith(testRun.id, [other]);
      // updateIgnoreAreas compares the run; nothing else does
      expect(service.calculateDiff).not.toHaveBeenCalled();
    });
  });

  describe('xpath selectors (spec 027)', () => {
    const offers = readFileSync(path.join(__dirname, '..', 'ui-tree', '__fixtures__', 'android-offers.xml'), 'utf8');
    const tree = (source: string) => parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
    const badges = "xpath://*[@resource-id='com.bank.app:id/cashback_label']/..";

    it('counts what a selector finds on the baseline and the screenshot', async () => {
      service = await initService({});
      service.findOne = jest
        .fn()
        .mockResolvedValue(generateTestRun({ uiTreeName: 'current.json.gz', baselineUiTreeName: 'baseline.json.gz' }));
      // the second card is gone from the screenshot
      const current = tree(
        offers.replace(
          /<android\.view\.ViewGroup [^>]*content-desc="-211 днів Кешбек[\s\S]*?\n<\/android\.view\.ViewGroup>\n<\/androidx/,
          '</androidx'
        )
      );
      service['uiTreeService'].load = jest.fn((name: string) =>
        Promise.resolve(name === 'current.json.gz' ? current : tree(offers))
      );

      expect(await service.selectorMatches('run', badges)).toEqual({ current: 1, baseline: 2, problem: null });
      expect(await service.selectorMatches('run', 'id:cashback_label')).toEqual({
        current: 1,
        baseline: 2,
        problem: null,
      });
    });

    it('says why a selector cannot be used, without loading the trees', async () => {
      service = await initService({});
      service.findOne = jest.fn();
      expect(await service.selectorMatches('run', "xpath://*[@text='a']/following-sibling::*[1]")).toEqual({
        current: 0,
        baseline: 0,
        problem: 'axis',
      });
      expect(await service.selectorMatches('run', 'btn_pay')).toEqual({ current: 0, baseline: 0, problem: 'prefix' });
      expect(service.findOne).not.toHaveBeenCalled();
    });

    it('refuses to save an xpath that is not a path from a stable element', async () => {
      service = await initService({});
      service.findOne = jest.fn();
      await expect(
        service.addElementRule('run', {
          scope: 'screen',
          selector: "xpath://*[contains(@text,'Pay')]",
          action: 'ignore',
        } as never)
      ).rejects.toThrow('not a path from a stable element (function)');
      expect(service.findOne).not.toHaveBeenCalled();
    });
  });

  describe('saveDiffResult', () => {
    const testRun: TestRun = generateTestRun();
    it('no results', async () => {
      const id = 'some id';
      const testRunUpdateMock = jest.fn().mockResolvedValueOnce(testRun);
      const eventTestRunUpdatedMock = jest.fn();
      service = await initService({
        testRunUpdateMock,
        eventTestRunUpdatedMock,
      });

      await service.saveDiffResult(id, null);

      expect(testRunUpdateMock).toHaveBeenCalledWith({
        where: { id },
        data: {
          status: TestStatus.new,
          diffName: null,
          pixelMisMatchCount: null,
          diffPercent: null,
          vlmDescription: null,
          changeSignature: null,
          imageThumbnailName: null,
          diffThumbnailName: null,
          diffRegions: null,
        },
      });
      expect(eventTestRunUpdatedMock).toHaveBeenCalledWith(testRun);
    });

    // Written here, next to the diff that decoded the screenshots anyway, so
    // the variations dialog never has to decode them again.
    it('stores the change signature the comparison produced', async () => {
      const testRunUpdateMock = jest.fn().mockResolvedValueOnce(testRun);
      service = await initService({ testRunUpdateMock });

      await service.saveDiffResult('some id', {
        status: TestStatus.unresolved,
        diffName: 'diff image name',
        pixelMisMatchCount: 11,
        diffPercent: 22,
        isSameDimension: true,
        changeSignature: { threshold: 0.1, includeAA: true, signature: [0.25, 0.75] },
      });

      expect(testRunUpdateMock.mock.calls[0][0].data).toMatchObject({
        changeSignature: JSON.stringify({ threshold: 0.1, includeAA: true, signature: [0.25, 0.75] }),
      });
    });

    it('stores no signature when the comparison produced none', async () => {
      const testRunUpdateMock = jest.fn().mockResolvedValueOnce(testRun);
      service = await initService({ testRunUpdateMock });

      await service.saveDiffResult('some id', {
        status: TestStatus.ok,
        diffName: null,
        pixelMisMatchCount: 0,
        diffPercent: 0,
        isSameDimension: true,
      });

      expect(testRunUpdateMock.mock.calls[0][0].data).toMatchObject({ changeSignature: null });
    });

    it('with results', async () => {
      const diff: DiffResult = {
        status: TestStatus.unresolved,
        diffName: 'diff image name',
        pixelMisMatchCount: 11,
        diffPercent: 22,
        isSameDimension: true,
        vlmDescription: 'VLM detected significant color differences in the header section',
      };
      const id = 'some id';
      const testRunUpdateMock = jest.fn().mockResolvedValueOnce(testRun);
      const eventTestRunUpdatedMock = jest.fn();
      service = await initService({
        testRunUpdateMock,
        eventTestRunUpdatedMock,
      });

      await service.saveDiffResult(id, diff);

      expect(testRunUpdateMock).toHaveBeenCalledWith({
        where: { id },
        data: {
          status: diff.status,
          diffName: diff.diffName,
          pixelMisMatchCount: diff.pixelMisMatchCount,
          diffPercent: diff.diffPercent,
          vlmDescription: diff.vlmDescription,
          changeSignature: null,
          imageThumbnailName: null,
          diffThumbnailName: null,
          diffRegions: null,
        },
      });
      expect(eventTestRunUpdatedMock).toHaveBeenCalledWith(testRun);
    });
  });

  it('findMany', async () => {
    const buildId = 'some id';
    const testRun: TestRun = generateTestRun({
      vlmDescription: 'VLM analysis completed',
    });
    const testRunFindManyMock = jest.fn().mockResolvedValueOnce([testRun]);
    service = await initService({
      testRunFindManyMock,
    });

    const result = await service.findMany(buildId);

    expect(testRunFindManyMock).toHaveBeenCalledWith({
      where: { buildId },
    });
    expect(result).toEqual([new TestRunDto(testRun)]);
  });

  it('delete', async () => {
    const id = 'some id';
    const testRun = {
      diffName: 'diffName',
      imageName: 'imageName',
    };
    const findOneMock = jest.fn().mockResolvedValueOnce(testRun);
    const deleteImageMock = jest.fn();
    const testRunDeleteMock = jest.fn();
    const eventTestRunDeletedMock = jest.fn();
    service = await initService({
      deleteImageMock,
      testRunDeleteMock,
      eventTestRunDeletedMock,
    });
    service.findOne = findOneMock;

    await service.delete(id);

    expect(findOneMock).toHaveBeenCalledWith(id);
    expect(deleteImageMock).toHaveBeenNthCalledWith(1, testRun.diffName);
    expect(deleteImageMock).toHaveBeenNthCalledWith(2, testRun.imageName);
    expect(testRunDeleteMock).toHaveBeenCalledWith({
      where: { id },
    });
    expect(eventTestRunDeletedMock).toHaveBeenCalledWith(testRun);
  });

  it('delete not found', async () => {
    const id = 'some id';
    const findOneMock = jest.fn().mockResolvedValueOnce(undefined);
    const deleteImageMock = jest.fn();
    const testRunDeleteMock = jest.fn();
    const eventTestRunDeletedMock = jest.fn();
    service = await initService({
      deleteImageMock,
      testRunDeleteMock,
      eventTestRunDeletedMock,
    });
    service.findOne = findOneMock;

    const result = await service.delete(id);

    expect(deleteImageMock).not.toHaveBeenCalled();
    expect(testRunDeleteMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('updateIgnoreAreas', async () => {
    const testRun = {
      id: 'testRunId',
      testVariationId: 'testVariationId',
      diffName: 'diffName',
      imageName: 'imageName',
      ignoreAreas: JSON.stringify(ignoreAreas),
    };
    const testVariation = {
      id: 'testVariationId',
      projectId: 'someProjectId',
    };
    const testRunUpdateMock = jest.fn().mockResolvedValueOnce(testRun);
    const testVariationUpdateMock = jest.fn().mockResolvedValueOnce(testVariation);
    service = await initService({
      testRunUpdateMock,
      testVariationUpdateMock,
    });
    service.calculateDiff = jest.fn();

    await service.updateIgnoreAreas(testRun.id, ignoreAreas);

    expect(testRunUpdateMock).toHaveBeenCalledWith({
      where: { id: testRun.id },
      data: {
        ignoreAreas: JSON.stringify(ignoreAreas),
      },
    });
    expect(testVariationUpdateMock).toHaveBeenCalledWith(testRun.testVariationId, {
      ignoreAreas: testRun.ignoreAreas,
    });
    expect(service.calculateDiff).toHaveBeenCalledWith(testVariation.projectId, testRun);
  });

  it('update', async () => {
    const testRun = {
      id: 'testRunId',
      testVariationId: 'testVariationId',
      diffName: 'diffName',
      imageName: 'imageName',
    };
    const data: UpdateTestRunDto = {
      comment: 'random comment',
    };
    const testRunUpdateMock = jest.fn().mockResolvedValueOnce(testRun);
    const testVariationUpdateMock = jest.fn();
    const eventTestRunUpdatedMock = jest.fn();
    service = await initService({
      testRunUpdateMock,
      eventTestRunUpdatedMock,
      testVariationUpdateMock,
    });

    await service.update(testRun.id, data);

    expect(testRunUpdateMock).toHaveBeenCalledWith({
      where: { id: testRun.id },
      data: {
        comment: data.comment,
      },
    });
    expect(testVariationUpdateMock).toHaveBeenCalledWith(testRun.testVariationId, data);
    expect(eventTestRunUpdatedMock).toHaveBeenCalledWith(testRun);
  });

  it('postTestRun', async () => {
    const createTestRequestDto: CreateTestRequestDto = {
      buildId: 'buildId',
      projectId: 'projectId',
      name: 'Test name',
      os: 'OS',
      browser: 'browser',
      viewport: 'viewport',
      device: 'device',
      branchName: 'develop',
      customTags: 'customTags',
      comment: 'new comment',
    };
    const testVariation: TestVariation = {
      id: '123',
      projectId: 'project Id',
      name: 'Test name',
      baselineName: 'baselineName',
      baselineUiTreeName: null,
      elementRules: null,
      os: 'OS',
      browser: 'browser',
      viewport: 'viewport',
      device: 'device',
      customTags: '',
      ignoreAreas: '[]',
      comment: 'some comment',
      createdAt: new Date(),
      updatedAt: new Date(),
      branchName: 'master',
    };
    const testRun: TestRun = generateTestRun();
    const projectFindUniqueMock = jest.fn().mockResolvedValueOnce(TEST_PROJECT);
    const testVariationFindMock = jest.fn().mockResolvedValueOnce(testVariation);
    const testRunFindManyMock = jest.fn().mockResolvedValueOnce([testRun]);
    const deleteMock = jest.fn();
    const createMock = jest.fn().mockResolvedValueOnce(testRun);
    const service = await initService({
      projectFindUniqueMock,
      testVariationFindMock,
      testRunFindManyMock,
    });
    service.delete = deleteMock;
    service.create = createMock;
    service.calculateDiff = jest.fn().mockResolvedValueOnce(testRun);
    service['tryAutoApproveByPastBaselines'] = jest.fn().mockResolvedValueOnce(testRun);
    service['tryAutoApproveByNewBaselines'] = jest.fn().mockResolvedValueOnce(testRun);
    const baselineData: BaselineDataDto = {
      ...getTestVariationUniqueData(createTestRequestDto),
      branchName: createTestRequestDto.branchName,
    };

    await service.postTestRun({ createTestRequestDto, imageBuffer });

    expect(testVariationFindMock).toHaveBeenCalledWith(createTestRequestDto);
    expect(testRunFindManyMock).toHaveBeenCalledWith({
      where: {
        buildId: createTestRequestDto.buildId,
        ...baselineData,
        NOT: { OR: [{ status: TestStatus.approved }, { status: TestStatus.autoApproved }] },
      },
    });
    expect(deleteMock).toHaveBeenCalledWith(testRun.id);
    expect(createMock).toHaveBeenCalledWith({ testVariation, createTestRequestDto, imageBuffer });
    expect(service.calculateDiff).toHaveBeenCalledWith(createTestRequestDto.projectId, testRun);
    expect(service['tryAutoApproveByPastBaselines']).toHaveBeenCalledWith({ testVariation, testRun });
    expect(service['tryAutoApproveByNewBaselines']).toHaveBeenCalledWith({ testVariation, testRun });
    expect(mocked(TestRunResultDto)).toHaveBeenCalledWith(testRun, testVariation);
  });

  describe('allowed devices (029)', () => {
    const project = {
      ...TEST_PROJECT,
      name: 'AOS',
      uiTreeSettings: JSON.stringify({ allowedDevices: [{ device: 'Pixel 7', os: 'Android 15' }] }),
    };
    const snapshot = (device: string, os: string): CreateTestRequestDto => ({
      buildId: 'buildId',
      projectId: 'projectId',
      name: 'Payment',
      os,
      device,
      branchName: 'develop',
    });
    const setup = async () => {
      const testRun: TestRun = generateTestRun();
      const testVariationFindMock = jest.fn().mockResolvedValue({ id: 'variation' });
      const testVariationCreateMock = jest.fn();
      const testRunFindManyMock = jest.fn().mockResolvedValue([]);
      const service = await initService({
        projectFindUniqueMock: jest.fn().mockResolvedValue(project),
        testVariationFindMock,
        testVariationCreateMock,
        testRunFindManyMock,
      });
      service.create = jest.fn().mockResolvedValue(testRun);
      service.calculateDiff = jest.fn().mockResolvedValue(testRun);
      service['tryAutoApproveByPastBaselines'] = jest.fn().mockResolvedValue(testRun);
      service['tryAutoApproveByNewBaselines'] = jest.fn().mockResolvedValue(testRun);
      return { service, testVariationFindMock, testVariationCreateMock, testRunFindManyMock };
    };

    it('rejects a device not allowed without creating a variation or run', async () => {
      const { service, testVariationFindMock, testVariationCreateMock, testRunFindManyMock } = await setup();

      const posting = service.postTestRun({
        createTestRequestDto: snapshot('Pixel 6', 'Android 13'),
        imageBuffer,
        checkDevice: true,
      });

      await expect(posting).rejects.toThrow(UnprocessableEntityException);
      await expect(posting).rejects.toThrow('Device not allowed in project "AOS"');
      expect(testVariationFindMock).not.toHaveBeenCalled();
      expect(testVariationCreateMock).not.toHaveBeenCalled();
      expect(testRunFindManyMock).not.toHaveBeenCalled();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('accepts an allowed device in the same build after a rejection', async () => {
      const { service } = await setup();

      await expect(
        service.postTestRun({ createTestRequestDto: snapshot('Pixel 6', 'Android 13'), imageBuffer, checkDevice: true })
      ).rejects.toThrow(UnprocessableEntityException);
      await service.postTestRun({
        createTestRequestDto: snapshot(' pixel 7', 'Android 15'),
        imageBuffer,
        checkDevice: true,
      });

      expect(service.create).toHaveBeenCalledTimes(1);
      expect((service.create as jest.Mock).mock.calls[0][0].createTestRequestDto.buildId).toBe('buildId');
    });

    it('takes any device when the snapshot is not checked', async () => {
      const { service } = await setup();

      await service.postTestRun({ createTestRequestDto: snapshot('Pixel 6', 'Android 13'), imageBuffer });

      expect(service.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('tryAutoApproveByNewBaselines', () => {
    it('skip if ok', async () => {
      const testRun = generateTestRun({ status: TestStatus.ok });
      service = await initService({});

      const result = await service['tryAutoApproveByNewBaselines']({
        testVariation: generateTestVariation(),
        testRun,
      });

      expect(result).toBe(testRun);
    });

    it('should not auto approve', async () => {
      const testRun = generateTestRun({ status: TestStatus.unresolved });
      const baseline = generateBaseline();
      const testRunFindManyMock = jest.fn().mockResolvedValueOnce([generateTestRun({ status: TestStatus.approved })]);
      const testVariationGetDetailsMock = jest.fn().mockResolvedValueOnce(generateTestVariation({}, [baseline]));
      service = await initService({ testRunFindManyMock, testVariationGetDetailsMock });
      service['shouldAutoApprove'] = jest.fn().mockResolvedValueOnce(false);

      const result = await service['tryAutoApproveByNewBaselines']({
        testVariation: generateTestVariation(),
        testRun,
      });

      expect(service['shouldAutoApprove']).toHaveBeenCalled();
      expect(result).toBe(testRun);
    });

    it('should auto approve', async () => {
      const testRun = generateTestRun({ status: TestStatus.unresolved });
      const baseline = generateBaseline();
      const testRunFindManyMock = jest.fn().mockResolvedValueOnce([generateTestRun({ status: TestStatus.approved })]);
      const testVariationGetDetailsMock = jest.fn().mockResolvedValueOnce(generateTestVariation({}, [baseline]));
      service = await initService({ testRunFindManyMock, testVariationGetDetailsMock });
      service['shouldAutoApprove'] = jest.fn().mockResolvedValueOnce(true);
      service.approve = jest.fn().mockResolvedValueOnce({
        ...testRun,
        status: TestStatus.autoApproved,
      });

      const result = await service['tryAutoApproveByNewBaselines']({
        testVariation: generateTestVariation(),
        testRun,
      });

      expect(result).toStrictEqual({
        ...testRun,
        status: TestStatus.autoApproved,
      });
    });
  });

  describe('tryAutoApproveByPastBaselines', () => {
    it('skip if ok', async () => {
      const testRun = generateTestRun({ status: TestStatus.ok });
      service = await initService({});

      const result = await service['tryAutoApproveByPastBaselines']({
        testVariation: generateTestVariation(),
        testRun,
      });

      expect(result).toBe(testRun);
    });

    it('skip if the branch the same as baseline', async () => {
      const testRun = generateTestRun({ status: TestStatus.unresolved, branchName: 'a', baselineBranchName: 'a' });
      service = await initService({});

      const result = await service['tryAutoApproveByPastBaselines']({
        testVariation: generateTestVariation(),
        testRun,
      });

      expect(result).toBe(testRun);
    });

    it('should not auto approve', async () => {
      const testRun = generateTestRun({ status: TestStatus.unresolved });
      const baseline = generateBaseline();
      const testVariationGetDetailsMock = jest
        .fn()
        .mockResolvedValueOnce(generateTestVariation({}, [baseline, baseline]));
      service = await initService({ testVariationGetDetailsMock });
      service['shouldAutoApprove'] = jest.fn().mockResolvedValueOnce(false);

      const result = await service['tryAutoApproveByPastBaselines']({
        testVariation: generateTestVariation(),
        testRun,
      });

      expect(service['shouldAutoApprove']).toHaveBeenCalled();
      expect(result).toBe(testRun);
    });

    it('should auto approve', async () => {
      const testRun = generateTestRun({ status: TestStatus.unresolved });
      const baseline = generateBaseline();
      const testVariationGetDetailsMock = jest
        .fn()
        .mockResolvedValueOnce(generateTestVariation({}, [baseline, baseline]));
      service = await initService({ testVariationGetDetailsMock });
      service['shouldAutoApprove'] = jest.fn().mockResolvedValueOnce(true);
      service.approve = jest.fn().mockResolvedValueOnce({
        ...testRun,
        status: TestStatus.autoApproved,
      });

      const result = await service['tryAutoApproveByPastBaselines']({
        testVariation: generateTestVariation(),
        testRun,
      });

      expect(result).toStrictEqual({
        ...testRun,
        status: TestStatus.autoApproved,
      });
    });
  });

  describe('thumbnails', () => {
    it('stores the names the comparison saved them under', async () => {
      const testRunUpdateMock = jest.fn().mockResolvedValueOnce(generateTestRun());
      service = await initService({ testRunUpdateMock });

      await service.saveDiffResult('some id', {
        status: TestStatus.unresolved,
        diffName: 'diff.png',
        pixelMisMatchCount: 11,
        diffPercent: 22,
        isSameDimension: true,
        imageThumbnailName: 'image.thumb.png',
        diffThumbnailName: 'diff.thumb.png',
      });

      expect(testRunUpdateMock.mock.calls[0][0].data).toMatchObject({
        imageThumbnailName: 'image.thumb.png',
        diffThumbnailName: 'diff.thumb.png',
      });
    });

    // Recalculating replaces the names on the row, so whatever they pointed at
    // before has to go with the old diff — otherwise every ignore-area edit
    // leaves two more objects nothing references.
    it('removes the previous ones when the diff is recalculated', async () => {
      const testRun = generateTestRun({
        diffName: 'old-diff.png',
        imageThumbnailName: 'old-image.thumb.png',
        diffThumbnailName: 'old-diff.thumb.png',
      });
      const deleteImageMock = jest.fn();
      service = await initService({
        deleteImageMock,
        compareGetDiffMock: jest.fn().mockResolvedValueOnce({ status: TestStatus.ok }),
        testRunUpdateMock: jest.fn().mockResolvedValueOnce(testRun),
      });

      await service.calculateDiff('projectId', testRun);

      expect(deleteImageMock.mock.calls.map(([name]) => name).sort()).toEqual(
        ['old-diff.png', 'old-diff.thumb.png', 'old-image.thumb.png'].sort()
      );
    });

    // Deleting before the replacement exists means a failed comparison leaves
    // the row pointing at files that are gone — the reviewer opens the run and
    // sees broken pictures, with nothing to recover from.
    it('keeps the previous ones when the comparison fails', async () => {
      const testRun = generateTestRun({
        diffName: 'old-diff.png',
        imageThumbnailName: 'old-image.thumb.png',
        diffThumbnailName: 'old-diff.thumb.png',
      });
      const deleteImageMock = jest.fn();
      service = await initService({
        deleteImageMock,
        compareGetDiffMock: jest.fn().mockRejectedValueOnce(new Error('storage is down')),
      });

      await expect(service.calculateDiff('projectId', testRun)).rejects.toThrow('storage is down');

      expect(deleteImageMock).not.toHaveBeenCalled();
    });

    // two extra objects per run: left behind on delete they would outlive every
    // build that ever referenced them, and nothing would ever collect them
    it('removes them with the run they belong to', async () => {
      const testRun = generateTestRun({
        imageName: 'image.png',
        diffName: 'diff.png',
        imageThumbnailName: 'image.thumb.png',
        diffThumbnailName: 'diff.thumb.png',
      });
      const deleteImageMock = jest.fn();
      service = await initService({
        testRunFindUniqueMock: jest.fn().mockResolvedValueOnce(testRun),
        testRunDeleteMock: jest.fn().mockResolvedValueOnce(testRun),
        deleteImageMock,
      });

      await service.delete(testRun.id);

      expect(deleteImageMock.mock.calls.map(([name]) => name).sort()).toEqual(
        ['diff.png', 'diff.thumb.png', 'image.png', 'image.thumb.png'].sort()
      );
    });
  });

  // Change groups (006) compare these signatures across a build, so what makes
  // one trustworthy and cheap is checked here, on the method itself.
  describe('getChangeSignature', () => {
    const histogram = (hot: number): number[] =>
      Array.from({ length: SIGNATURE_LENGTH }, (_unused, index) => (index === hot ? 1 : 0));
    const PALETTE = histogram(0);
    const stamped = (signature: unknown, threshold = DEFAULT_CONFIG.threshold, includeAA = true) =>
      JSON.stringify({ threshold, includeAA, signature });

    const changedRun = (overrides: Partial<TestRun> = {}): TestRun =>
      generateTestRun({
        baselineName: 'screen.baseline.png',
        imageName: 'screen.screenshot.png',
        changeSignature: null,
        ...overrides,
      });

    const initSigningService = async () => {
      const compareGetChangeSignatureMock = jest.fn().mockResolvedValue({ signature: PALETTE });
      const service = await initService({
        getImageBufferMock: jest.fn().mockImplementation(async (name: string) => Buffer.from(name)),
        compareGetChangeSignatureMock,
      });
      return { service, compareGetChangeSignatureMock };
    };

    // The whole point of storing it: a build's screenshots are fetched and
    // decoded once at ingest, never again to group them at review time.
    it('uses the signature stored at ingest without decoding anything', async () => {
      const { service, compareGetChangeSignatureMock } = await initSigningService();

      const signature = await service.getChangeSignature(
        changedRun({ changeSignature: stamped(PALETTE) }),
        DEFAULT_CONFIG
      );

      expect(signature).toEqual(PALETTE);
      expect(compareGetChangeSignatureMock).not.toHaveBeenCalled();
    });

    // A signature only means anything under the threshold it was computed with;
    // reusing one after the project's config moved on would mix two settings.
    it('recomputes when the project config has moved on since ingest', async () => {
      const { service, compareGetChangeSignatureMock } = await initSigningService();

      await service.getChangeSignature(changedRun({ changeSignature: stamped(PALETTE, 0.9, false) }), DEFAULT_CONFIG);

      expect(compareGetChangeSignatureMock).toHaveBeenCalledTimes(1);
    });

    // A signature is a fixed-length histogram. One of the wrong shape compared
    // against a current one gives a score that looks fine and means nothing.
    it.each([
      ['the wrong length', [1, 0]],
      ['values that are not numbers', new Array(SIGNATURE_LENGTH).fill('nope')],
    ])('recomputes a stored signature with %s', async (_case, signature) => {
      const { service, compareGetChangeSignatureMock } = await initSigningService();

      await service.getChangeSignature(changedRun({ changeSignature: stamped(signature) }), DEFAULT_CONFIG);

      expect(compareGetChangeSignatureMock).toHaveBeenCalledTimes(1);
    });

    // builds ingested before the column existed, and runs compared by something
    // other than pixelmatch, still have to group
    it('computes a signature for a run with nothing stored', async () => {
      const { service, compareGetChangeSignatureMock } = await initSigningService();
      const run = changedRun();

      const signature = await service.getChangeSignature(run, DEFAULT_CONFIG);

      expect(signature).toEqual(PALETTE);
      expect(compareGetChangeSignatureMock.mock.calls[0][0].image.toString()).toBe(run.imageName);
    });

    it('reuses the signature it already computed for the same pair', async () => {
      const { service, compareGetChangeSignatureMock } = await initSigningService();
      const run = changedRun();

      await service.getChangeSignature(run, DEFAULT_CONFIG);
      await service.getChangeSignature(run, DEFAULT_CONFIG);

      expect(compareGetChangeSignatureMock).toHaveBeenCalledTimes(1);
    });

    it('recomputes a signature once the run gained an ignore area', async () => {
      const { service, compareGetChangeSignatureMock } = await initSigningService();
      const run = changedRun();

      await service.getChangeSignature(run, DEFAULT_CONFIG);
      run.ignoreAreas = JSON.stringify([{ x: 0, y: 0, width: 10, height: 10 }]);
      await service.getChangeSignature(run, DEFAULT_CONFIG);

      expect(compareGetChangeSignatureMock).toHaveBeenCalledTimes(2);
    });
  });

  // Every queued signature job holds two image buffers in a pool shared with
  // ingestion, so a build with many screens must not hand it all at once.
  describe('mapWithConcurrency', () => {
    it('keeps at most the limit in flight and the results in order', async () => {
      const items = Array.from({ length: SIGNATURE_CONCURRENCY * 3 }, (_, index) => index);
      let inFlight = 0;
      let peakInFlight = 0;

      const results = await mapWithConcurrency(items, SIGNATURE_CONCURRENCY, async (item) => {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, item % 3));
        inFlight -= 1;
        return item * 2;
      });

      expect(peakInFlight).toBe(SIGNATURE_CONCURRENCY);
      expect(results).toEqual(items.map((item) => item * 2));
    });
  });
});
