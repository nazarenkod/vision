import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TestStatus } from '@prisma/client';
import { DecisionItem, RunState, undoBlocker, undoExpired, undoPlan, UNDO_WINDOW_MS } from './decision-undo';
import { DecisionUndoService } from './decision-undo.service';
import { TestRunsService } from './test-runs.service';
import { TestVariationsService } from '../test-variations/test-variations.service';

// An in-memory stand-in for the tables an approve touches, so the real upstream
// approve runs against it: if approve starts changing something else, the
// round trip below stops matching (ADR-0014).
type Row = Record<string, any>;
function memoryDb() {
  let tables: Record<string, Row[]> = { testRun: [], testVariation: [], baseline: [], reviewDecision: [] };
  let seq = 0;
  const id = (prefix: string) => `${prefix}-${++seq}`;
  const byId = (table: string, key: string) => tables[table].find((row) => row.id === key);
  const uniqueVariation = (where: Row) => {
    const key = where.projectId_name_browser_device_os_viewport_customTags_branchName;
    return key
      ? tables.testVariation.find((v) =>
          ['projectId', 'name', 'browser', 'device', 'os', 'viewport', 'customTags', 'branchName'].every(
            (field) => v[field] === key[field]
          )
        )
      : byId('testVariation', where.id);
  };
  const variationOut = (v: Row | undefined, args: Row) => {
    if (!v) return null;
    if (args.select) return { id: v.id };
    const out = { ...v };
    if (args.include?.baselines) {
      out.baselines = tables.baseline.filter((b) => b.testVariationId === v.id).map((b) => ({ id: b.id }));
    }
    return out;
  };
  const writeVariation = (v: Row, data: Row) => {
    for (const field of ['baselineName', 'baselineUiTreeName', 'elementRules', 'ignoreAreas', 'comment']) {
      if (data[field] !== undefined) v[field] = data[field];
    }
    if (data.testRuns?.connect) byId('testRun', data.testRuns.connect.id).testVariationId = v.id;
    if (data.baselines?.create) {
      const create = data.baselines.create;
      tables.baseline.push({
        id: id('baseline'),
        baselineName: create.baselineName,
        uiTreeName: create.uiTreeName,
        testVariationId: v.id,
        testRunId: create.testRun?.connect?.id ?? null,
        userId: create.user?.connect?.id ?? null,
      });
    }
    return v;
  };
  const db: any = {
    testRun: {
      findUnique: async ({ where, include }: Row) => {
        const run = byId('testRun', where.id);
        if (!run) return null;
        return include?.testVariation
          ? { ...run, testVariation: byId('testVariation', run.testVariationId) }
          : { ...run };
      },
      update: async ({ where, data }: Row) => Object.assign(byId('testRun', where.id), data),
    },
    testVariation: {
      findUnique: async (args: Row) => variationOut(uniqueVariation(args.where), args),
      create: async ({ data }: Row) => {
        const v: Row = {
          id: id('variation'),
          projectId: data.project.connect.id,
          name: data.name,
          branchName: data.branchName,
          browser: data.browser,
          device: data.device,
          os: data.os,
          viewport: data.viewport,
          customTags: data.customTags,
          baselineName: null,
          baselineUiTreeName: null,
          elementRules: null,
          ignoreAreas: '[]',
          comment: null,
        };
        tables.testVariation.push(v);
        return writeVariation(v, { testRuns: data.testRuns });
      },
      update: async ({ where, data }: Row) => writeVariation(byId('testVariation', where.id), data),
      delete: async ({ where }: Row) => {
        tables.testVariation = tables.testVariation.filter((v) => v.id !== where.id);
      },
    },
    baseline: {
      deleteMany: async ({ where }: Row) => {
        tables.baseline = tables.baseline.filter((b) => !where.id.in.includes(b.id));
      },
    },
    reviewDecision: {
      create: async ({ data }: Row) => {
        const row = { id: id('decision'), createdAt: new Date(), undoneAt: null, ...data };
        tables.reviewDecision.push(row);
        return row;
      },
      findUnique: async ({ where }: Row) => byId('reviewDecision', where.id) ?? null,
      update: async ({ where, data }: Row) => Object.assign(byId('reviewDecision', where.id), data),
      deleteMany: async () => ({ count: 0 }),
    },
    // all or nothing, as Postgres would
    $transaction: async (work: (tx: any) => Promise<unknown>) => {
      const saved = JSON.parse(JSON.stringify(tables));
      try {
        return await work(db);
      } catch (error) {
        tables = saved;
        throw error;
      }
    },
    dump: () => JSON.parse(JSON.stringify({ ...tables, reviewDecision: [] })),
    tables: () => tables,
  };
  return db;
}

function setup() {
  const db = memoryDb();
  let files = 0;
  const staticService: any = {
    copyImage: jest.fn(async () => `baseline-copy-${++files}.png`),
    copyFile: jest.fn(async () => `uitree-copy-${++files}.json.gz`),
    deleteImage: jest.fn(async () => true),
    deleteFile: jest.fn(async () => true),
  };
  const eventsGateway: any = { testRunUpdated: jest.fn() };
  const uiTreeService: any = { recordCrossDevice: jest.fn(async () => undefined) };
  const variations = new TestVariationsService(db, staticService, undefined as any, undefined as any);
  const runs = new TestRunsService(
    variations,
    db,
    staticService,
    undefined as any,
    eventsGateway,
    uiTreeService,
    undefined as any
  );
  const service = new DecisionUndoService(db, runs, staticService, eventsGateway);

  db.tables().testVariation.push({
    id: 'main-variation',
    projectId: 'project',
    name: 'Checkout',
    branchName: 'main',
    browser: '',
    device: 'PIXEL_4_XL',
    os: 'AOS 14',
    viewport: '',
    customTags: '',
    baselineName: 'baseline-main.png',
    baselineUiTreeName: 'uitree-main.json.gz',
    elementRules: null,
    ignoreAreas: '[]',
    comment: null,
  });
  db.tables().baseline.push({
    id: 'old-baseline',
    testVariationId: 'main-variation',
    baselineName: 'baseline-main.png',
  });
  const run = (id: string, branchName: string) =>
    db.tables().testRun.push({
      id,
      projectId: 'project',
      buildId: 'build',
      name: 'Checkout',
      browser: '',
      device: 'PIXEL_4_XL',
      os: 'AOS 14',
      viewport: '',
      customTags: '',
      branchName,
      baselineBranchName: 'main',
      baselineName: 'baseline-main.png',
      baselineUiTreeName: 'uitree-main.json.gz',
      imageName: `${id}.png`,
      uiTreeName: null,
      ignoreAreas: '[]',
      comment: null,
      merge: false,
      status: TestStatus.unresolved,
      testVariationId: 'main-variation',
    });
  return { db, service, staticService, eventsGateway, run };
}

describe('decision undo', () => {
  it('restores status and baseline as they were before approve', async () => {
    const { db, service, staticService, eventsGateway, run } = setup();
    run('on-main', 'main');
    run('on-feature', 'feature/pay');
    const before = db.dump();

    const onMain = await service.approve(['on-main'], false, 'anna');
    const onFeature = await service.approve(['on-feature'], false, 'anna');
    // the approvals did change things: a new baseline, a new feature variation
    expect(db.dump()).not.toEqual(before);
    expect(db.tables().testVariation).toHaveLength(2);

    await service.undo(onFeature.decisionId, 'anna');
    await service.undo(onMain.decisionId, 'anna');

    expect(db.dump()).toEqual(before);
    // the copies the approvals made are removed, the old baseline's files stay
    const removed = [...staticService.deleteImage.mock.calls, ...staticService.deleteFile.mock.calls].map(
      ([name]) => name
    );
    expect(removed).toEqual(expect.arrayContaining([expect.stringMatching(/^baseline-copy-/)]));
    expect(removed).not.toContain('baseline-main.png');
    expect(removed).not.toContain('uitree-main.json.gz');
    // everyone watching the build hears the status go back
    expect(eventsGateway.testRunUpdated).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'on-main', status: TestStatus.unresolved })
    );
  });

  it('restores a rejected screenshot', async () => {
    const { db, service, run } = setup();
    run('a', 'main');
    const before = db.dump();
    const { decisionId } = await service.reject(['a'], 'anna');
    expect(db.tables().testRun[0].status).toBe(TestStatus.failed);
    await service.undo(decisionId, 'anna');
    expect(db.dump()).toEqual(before);
  });

  it('undoes a bulk decision all or nothing', async () => {
    const { db, service, run } = setup();
    run('a', 'main');
    run('b', 'feature/pay');
    run('c', 'feature/pay');
    const before = db.dump();
    const { decisionId } = await service.approve(['a', 'b', 'c'], false, 'anna');

    // someone else decides one of the three again: nothing is undone
    db.tables().testRun.find((r: Row) => r.id === 'c').status = TestStatus.failed;
    const after = db.dump();
    await expect(service.undo(decisionId, 'anna')).rejects.toBeInstanceOf(ConflictException);
    expect(db.dump()).toEqual(after);

    db.tables().testRun.find((r: Row) => r.id === 'c').status = TestStatus.approved;
    await service.undo(decisionId, 'anna');
    expect(db.dump()).toEqual(before);
  });

  it('refuses undo when someone changed the run after the decision', async () => {
    const { db, service, run } = setup();
    run('a', 'main');
    run('b', 'main');
    const { decisionId } = await service.approve(['a'], false, 'anna');
    // another approval of the same screen lands on the same baseline
    await service.approve(['b'], false, 'ivan');
    await expect(service.undo(decisionId, 'anna')).rejects.toThrow('Someone approved this screen again');

    const second = await service.reject(['a'], 'anna');
    await service.undo(second.decisionId, 'anna');
    await expect(service.undo(second.decisionId, 'anna')).rejects.toThrow('already undone');
    expect(db.tables().reviewDecision).toHaveLength(3);
  });

  it('lets only the person who decided undo it, and only for a short while', async () => {
    const { service, run } = setup();
    run('a', 'main');
    const { decisionId } = await service.approve(['a'], false, 'anna');
    await expect(service.undo(decisionId, 'ivan')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.undo(decisionId, 'anna', new Date(Date.now() + UNDO_WINDOW_MS + 1000))).rejects.toThrow(
      'too late'
    );
  });

  it('plans the steps in an order the foreign keys allow', () => {
    const before: RunState = {
      testRunId: 'r',
      status: 'unresolved',
      testVariationId: 'main',
      variations: [
        {
          id: 'main',
          baselineName: 'a.png',
          baselineUiTreeName: null,
          elementRules: null,
          ignoreAreas: '[]',
          comment: null,
          baselineIds: ['b1'],
        },
      ],
    };
    const after: RunState = {
      ...before,
      status: 'approved',
      testVariationId: 'feature',
      variations: [
        ...before.variations,
        { ...before.variations[0], id: 'feature', baselineName: 'new.png', baselineIds: ['b2'] },
      ],
    };
    const item: DecisionItem = { testRunId: 'r', before, after };
    expect(undoPlan(item).map((step) => step.kind)).toEqual([
      'deleteBaselines',
      'link',
      'deleteVariation',
      'status',
      'deleteImage',
    ]);
    expect(undoBlocker(item, after)).toBeNull();
    expect(undoBlocker(item, null)).toMatch(/deleted/);
    expect(undoExpired(new Date(0), new Date(UNDO_WINDOW_MS))).toBe(false);
    expect(undoExpired(new Date(0), new Date(UNDO_WINDOW_MS + 1))).toBe(true);
  });
});
