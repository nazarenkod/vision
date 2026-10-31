import { TestStatus } from '@prisma/client';
import { buildOverview, OverviewBugInput, OverviewInput, OverviewRun } from './build-overview';

let seq = 0;
const run = (over: Partial<OverviewRun> = {}): OverviewRun => ({
  id: `run-${++seq}`,
  name: 'Checkout. Payment sheet',
  customTags: '',
  status: TestStatus.ok,
  device: 'PIXEL_4_XL',
  os: 'AOS 14',
  browser: '',
  viewport: '',
  featureName: null,
  a11yNewCount: 0,
  decidedById: null,
  diffPercent: null,
  ...over,
});

const input = (over: Partial<OverviewInput> = {}): OverviewInput => ({
  build: { isRunning: false },
  runs: [],
  previous: null,
  approvedBy: new Map(),
  people: new Map(),
  bugs: [],
  ...over,
});

const bug = (over: Partial<OverviewBugInput>): OverviewBugInput => ({
  kind: 'visual',
  jiraKey: 'P24MOB-1',
  jiraUrl: null,
  summary: 'Pay button moved',
  testRunId: 'run',
  isNew: true,
  ...over,
});

describe('buildOverview', () => {
  it('says Running, Waiting for review, Reviewed or Passed', () => {
    const verdict = (runs: OverviewRun[], isRunning = false) =>
      buildOverview(input({ build: { isRunning }, runs })).verdict;
    expect(verdict([run({ status: TestStatus.unresolved })], true)).toBe('running');
    expect(verdict([run({ status: TestStatus.new }), run({ status: TestStatus.failed })])).toBe('waiting');
    expect(verdict([run({ status: TestStatus.failed }), run()])).toBe('reviewed');
    expect(verdict([run(), run({ status: TestStatus.approved }), run({ status: TestStatus.autoApproved })])).toBe(
      'passed'
    );
  });

  it('counts screenshots, waiting, rejected, new a11y issues and bugs', () => {
    const runs = [
      run({ status: TestStatus.unresolved, a11yNewCount: 2 }),
      run({ status: TestStatus.new }),
      run({ status: TestStatus.failed, a11yNewCount: 1 }),
      run(),
      run({ status: TestStatus.approved }),
    ];
    const { counts } = buildOverview(
      input({ runs, bugs: [bug({ testRunId: runs[0].id }), bug({ jiraKey: 'P24MOB-2' })] })
    );
    expect(counts).toEqual({
      total: 5,
      changed: 1,
      new: 1,
      rejected: 1,
      passed: 2,
      waiting: 2,
      a11yNew: 3,
      bugs: 2,
    });
  });

  it('counts decisions per person and leaves undone ones out', () => {
    const runs = [
      run({ status: TestStatus.approved, decidedById: 'anna' }),
      run({ status: TestStatus.failed, decidedById: 'anna' }),
      run({ status: TestStatus.approved, decidedById: 'oleh' }),
      // approved before runs kept who decided: the baseline it made says who
      run({ id: 'old-approve', status: TestStatus.approved }),
      // rejected before that: nobody to name
      run({ status: TestStatus.failed }),
      // undone: back to waiting, nobody's
      run({ status: TestStatus.unresolved }),
      // matched: never needed a decision
      run(),
    ];
    const { progress } = buildOverview(
      input({
        runs,
        approvedBy: new Map([['old-approve', 'oleh']]),
        people: new Map([
          ['anna', 'Anna Petrenko'],
          ['oleh', 'Oleh Koval'],
        ]),
      })
    );
    expect(progress.decided).toBe(5);
    expect(progress.needed).toBe(6);
    expect(progress.people).toEqual([
      { name: 'Anna Petrenko', approved: 1, rejected: 1 },
      { name: 'Oleh Koval', approved: 2, rejected: 0 },
      { name: null, approved: 0, rejected: 1 },
    ]);
  });

  it('splits the result by device profile', () => {
    const runs = [
      run({ status: TestStatus.unresolved, a11yNewCount: 3 }),
      run(),
      run({ device: 'iPhone 15', os: 'iOS 17', status: TestStatus.new }),
      run({ device: 'iPhone 15', os: 'iOS 17', status: TestStatus.failed }),
    ];
    const { devices } = buildOverview(input({ runs }));
    expect(devices).toEqual([
      {
        device: 'iPhone 15',
        os: 'iOS 17',
        browser: '',
        viewport: '',
        a11yNew: 0,
        total: 2,
        changed: 0,
        new: 1,
        rejected: 1,
        passed: 0,
      },
      {
        device: 'PIXEL_4_XL',
        os: 'AOS 14',
        browser: '',
        viewport: '',
        a11yNew: 3,
        total: 2,
        changed: 1,
        new: 0,
        rejected: 0,
        passed: 1,
      },
    ]);
  });

  it('names a feature by featureName or the check up to the first dot', () => {
    const runs = [
      run({ status: TestStatus.unresolved }),
      run({ name: 'Login. Error state', featureName: 'Sign in', status: TestStatus.unresolved }),
    ];
    expect(buildOverview(input({ runs })).features.map((row) => row.name)).toEqual(['Checkout', 'Sign in']);
  });

  it('folds quiet features into one row', () => {
    const runs = [
      run({ name: 'Home. Feed' }),
      run({ name: 'Home. Banner' }),
      run({ name: 'Search. Results', status: TestStatus.approved }),
      run({ name: 'Cart. Empty' }),
      run({ name: 'Login. Error', status: TestStatus.failed }),
      run({ name: 'Profile. Avatar' }),
      run({ status: TestStatus.unresolved }),
      run({ status: TestStatus.unresolved }),
    ];
    const bugs = [bug({ testRunId: runs[5].id })];
    const overview = buildOverview(input({ runs, bugs }));
    expect(overview.features.map((row) => [row.name, row.changed, row.rejected, row.bugs])).toEqual([
      ['Checkout', 2, 0, 0],
      ['Login', 0, 1, 0],
      ['Profile', 0, 0, 1],
    ]);
    expect(overview.quietFeatures).toEqual({ count: 3, screens: 4 });
  });

  it('marks bugs filed from this build New and older ones Known', () => {
    const runs = [run({ status: TestStatus.unresolved })];
    const bugs = [
      bug({ jiraKey: 'P24MOB-14190', isNew: false, testRunId: runs[0].id }),
      bug({ jiraKey: 'P24MOB-14233', kind: 'a11y', testRunId: runs[0].id }),
      bug({ jiraKey: 'P24MOB-14231', testRunId: runs[0].id }),
    ];
    expect(buildOverview(input({ runs, bugs })).bugs.map((b) => [b.jiraKey, b.isNew])).toEqual([
      ['P24MOB-14231', true],
      ['P24MOB-14233', true],
      ['P24MOB-14190', false],
    ]);
  });

  it('compares with the previous build of the branch', () => {
    const runs = [
      // matched before, differs now
      run({ name: 'Checkout. Pay', status: TestStatus.unresolved }),
      // differed before too: not new news
      run({ name: 'Login. Error', status: TestStatus.unresolved }),
      // same check on another device: a new screenshot
      run({ name: 'Login. Error', device: 'iPhone 15', status: TestStatus.new }),
      run({ name: 'Home. Feed' }),
    ];
    const previous = {
      number: 127,
      runs: [
        run({ name: 'Checkout. Pay' }),
        run({ name: 'Login. Error', status: TestStatus.approved, diffPercent: 1.2 }),
        run({ name: 'Home. Feed' }),
        run({ name: 'Settings. Main' }),
      ],
    };
    expect(buildOverview(input({ runs, previous })).previous).toEqual({ number: 127, changed: 1, added: 1, gone: 1 });
  });

  it('does not count a screenshot approved as new as one that differed', () => {
    // the previous build was the first: its screenshots were new and approved
    const previous = { number: 1, runs: [run({ name: 'Checkout. Pay', status: TestStatus.approved })] };
    const runs = [run({ name: 'Checkout. Pay', status: TestStatus.unresolved, diffPercent: 4.87 })];
    expect(buildOverview(input({ runs, previous })).previous).toEqual({ number: 1, changed: 1, added: 0, gone: 0 });
    // approved after a real difference: it did differ
    const approvedChange = {
      number: 1,
      runs: [run({ name: 'Checkout. Pay', status: TestStatus.approved, diffPercent: 2 })],
    };
    expect(buildOverview(input({ runs, previous: approvedChange })).previous.changed).toBe(0);
  });

  it('says first build when the branch has no earlier one', () => {
    expect(buildOverview(input({ runs: [run()] })).previous).toBeNull();
  });
});
