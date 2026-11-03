import { TestStatus } from '@prisma/client';
import { a11yOf, buildOverview, OverviewBugInput, OverviewInput, OverviewRun } from './build-overview';

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
        screen: '',
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
        screen: '',
        a11yNew: 3,
        total: 2,
        changed: 1,
        new: 0,
        rejected: 0,
        passed: 1,
      },
    ]);
  });

  it('takes the screen size of a device from the screenshots measured', () => {
    const runs = [run({ id: 'a' }), run({ id: 'b' }), run({ id: 'c', device: 'iPhone 15', os: 'iOS 17' })];
    const { devices } = buildOverview(input({ runs, screenSizes: new Map([['b', '1080×2400']]) }));
    expect(devices.map((row) => [row.device, row.screen])).toEqual([
      ['iPhone 15', ''],
      ['PIXEL_4_XL', '1080×2400'],
    ]);
  });

  it('groups checks by featureName only and keeps the others one per check', () => {
    const runs = [
      run({ status: TestStatus.unresolved }),
      run({ name: 'Checkout. Saved cards', status: TestStatus.unresolved }),
      run({ name: 'Login. Error state', featureName: 'Sign in', status: TestStatus.unresolved }),
      run({ name: 'Login. Empty', featureName: ' Sign in ', status: TestStatus.unresolved }),
      run({ name: 'Login. Error state', featureName: 'Sign in', device: 'iPhone 15', status: TestStatus.unresolved }),
    ];
    const { features } = buildOverview(input({ runs }));
    expect(features.map((row) => [row.name, row.grouped, row.total])).toEqual([
      ['Sign in', true, 3],
      ['Checkout. Payment sheet', false, 1],
      ['Checkout. Saved cards', false, 1],
    ]);
  });

  it('keeps a feature and a check of the same name apart', () => {
    const runs = [
      run({ name: 'Sign in', status: TestStatus.unresolved }),
      run({ name: 'Login. Error', featureName: 'Sign in', status: TestStatus.failed }),
    ];
    const bugs = [bug({ testRunId: runs[1].id })];
    expect(buildOverview(input({ runs, bugs })).features.map((row) => [row.name, row.grouped, row.bugs])).toEqual([
      ['Sign in', false, 0],
      ['Sign in', true, 1],
    ]);
  });

  it('folds quiet features into one row', () => {
    const runs = [
      run({ name: 'Home. Feed', featureName: 'Home' }),
      run({ name: 'Home. Banner', featureName: 'Home' }),
      run({ name: 'Search. Results', status: TestStatus.approved }),
      run({ name: 'Cart. Empty' }),
      run({ name: 'Login. Error', status: TestStatus.failed }),
      run({ name: 'Profile. Avatar' }),
      run({ status: TestStatus.unresolved, featureName: 'Checkout' }),
      run({ status: TestStatus.unresolved, featureName: 'Checkout' }),
    ];
    const bugs = [bug({ testRunId: runs[5].id })];
    const overview = buildOverview(input({ runs, bugs }));
    expect(overview.features.map((row) => [row.name, row.changed, row.rejected, row.bugs])).toEqual([
      ['Checkout', 2, 0, 0],
      ['Login. Error', 0, 1, 0],
      ['Profile. Avatar', 0, 0, 1],
    ]);
    expect(overview.quietFeatures).toMatchObject({ count: 3, screens: 4 });
    // the folded row opens into them (REQ-031-09)
    expect(overview.quietFeatures.features.map((row) => [row.name, row.total])).toEqual([
      ['Cart. Empty', 1],
      ['Home', 2],
      ['Search. Results', 1],
    ]);
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

describe('a11yOf', () => {
  const pixel = { id: 'p', name: 'Checkout', device: 'PIXEL_4_XL', os: 'AOS 15', a11yTotalCount: 3 };
  const iphone = { id: 'i', name: 'Checkout', device: 'iPhone 15', os: 'iOS 18', a11yTotalCount: 1 };

  it('lists every problem of every screenshot with its check and device, new first', () => {
    const a11y = a11yOf(
      [pixel, iphone],
      [
        { testRunId: 'i', rule: 'missing-label', element: 'Scan', isNew: false },
        { testRunId: 'p', rule: 'touch-target', element: 'Pay', isNew: true },
        { testRunId: 'p', rule: 'missing-label', element: 'Scan', isNew: false },
      ]
    );

    expect(a11y.checked).toBe(true);
    expect(a11y.more).toBe(0);
    expect(a11y.problems.map((p) => [p.rule, p.element, p.check, p.device, p.os, p.isNew])).toEqual([
      ['touch-target', 'Pay', 'Checkout', 'PIXEL_4_XL', 'AOS 15', true],
      ['missing-label', 'Scan', 'Checkout', 'iPhone 15', 'iOS 18', false],
      ['missing-label', 'Scan', 'Checkout', 'PIXEL_4_XL', 'AOS 15', false],
    ]);
  });

  it('shows 20 problems, new first, and counts the rest', () => {
    const findings = Array.from({ length: 25 }, (_, i) => ({
      testRunId: 'p',
      rule: 'touch-target' as const,
      element: `e${i}`,
      isNew: i === 24,
    }));

    const a11y = a11yOf([pixel], findings);

    expect(a11y.problems).toHaveLength(20);
    expect(a11y.problems[0]).toMatchObject({ element: 'e24', isNew: true });
    expect(a11y.more).toBe(5);
  });

  it('says nothing was checked when no screenshot came with a UI tree', () => {
    expect(a11yOf([{ ...pixel, a11yTotalCount: null }], [])).toEqual({ checked: false, problems: [], more: 0 });
    expect(a11yOf([{ ...pixel, a11yTotalCount: 0 }], [])).toEqual({ checked: true, problems: [], more: 0 });
  });
});
