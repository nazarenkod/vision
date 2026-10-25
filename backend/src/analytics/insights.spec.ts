import { computeInsights, InsightsInput, RunRow, VariationRow } from './insights';

const now = new Date('2026-10-25T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const variation = (fields: Partial<VariationRow>): VariationRow => ({
  id: 'v',
  name: 'Payment',
  customTags: '',
  branchName: 'master',
  os: 'Android 15',
  device: 'Pixel 7',
  browser: '',
  viewport: '',
  baselineName: 'b.png',
  createdAt: daysAgo(400),
  updatedAt: daysAgo(400),
  lastRunAt: null,
  lastBaselineAt: null,
  ...fields,
});

const run = (fields: Partial<RunRow>): RunRow => ({
  testVariationId: 'v',
  name: 'Payment',
  customTags: '',
  os: 'Android 15',
  device: 'Pixel 7',
  browser: '',
  viewport: '',
  status: 'ok',
  diffPercent: 0,
  baselineName: 'b.png',
  createdAt: daysAgo(10),
  updatedAt: daysAgo(10),
  a11yNewCount: null,
  a11yTotalCount: null,
  captureWarnings: null,
  semanticChangeCount: null,
  ...fields,
});

const input = (fields: Partial<InsightsInput>): InsightsInput => ({
  now,
  days: 90,
  mainBranchName: 'master',
  oldestBuildAt: daysAgo(400),
  variations: [],
  runs: [],
  baselineChanges: {},
  a11yStates: [],
  a11yRules: {},
  ...fields,
});

describe('computeInsights', () => {
  it('suggests deleting baselines nothing was compared with during the window', () => {
    const result = computeInsights(
      input({
        variations: [
          variation({ id: 'old', name: 'Old promo', lastRunAt: daysAgo(120) }),
          variation({ id: 'never', name: 'Never run', lastRunAt: null }),
          variation({ id: 'used', name: 'Payment', lastRunAt: daysAgo(5) }),
          // approved recently, even if its runs were cleaned up
          variation({ id: 'approved', name: 'Login', lastBaselineAt: daysAgo(20) }),
          // created inside the window: too young to judge
          variation({ id: 'young', name: 'New', createdAt: daysAgo(10) }),
        ],
      })
    );
    expect(result.unused.map((item) => item.id)).toEqual(['never', 'old']);
    expect(result.unused[1]).toMatchObject({ name: 'Old promo', idleDays: 120, device: 'Pixel 7 · Android 15' });
    expect(result.partialHistory).toBe(false);
  });

  it('judges only the history that is left when older builds were removed', () => {
    const result = computeInsights(
      input({
        oldestBuildAt: daysAgo(30),
        variations: [variation({ id: 'a', lastRunAt: daysAgo(45) }), variation({ id: 'b', lastRunAt: daysAgo(20) })],
      })
    );
    expect(result.partialHistory).toBe(true);
    expect(result.unused.map((item) => item.id)).toEqual(['a']);
  });

  it('ranks unstable screens: flips first, then how often they change', () => {
    const runs = [
      // Payment flips: differs, then matches the same baseline again, twice
      run({ status: 'unresolved', diffPercent: 3, createdAt: daysAgo(9) }),
      run({ status: 'ok', createdAt: daysAgo(8) }),
      run({ status: 'unresolved', diffPercent: 2, createdAt: daysAgo(7) }),
      run({ status: 'ok', createdAt: daysAgo(6) }),
      // Cards changes every time, approved each time with a new baseline
      ...[5, 4, 3].map((days, i) =>
        run({
          testVariationId: 'c',
          name: 'Cards',
          status: 'approved',
          diffPercent: 5,
          baselineName: `c${i}.png`,
          createdAt: daysAgo(days),
        })
      ),
      // Login is stable
      ...[5, 4, 3].map((days) => run({ testVariationId: 'l', name: 'Login', createdAt: daysAgo(days) })),
    ];
    const result = computeInsights(
      input({
        runs,
        variations: [variation({ id: 'c', name: 'Cards' })],
        baselineChanges: { c: 3 },
      })
    );
    expect(result.unstable.map((item) => item.name)).toEqual(['Payment', 'Cards']);
    expect(result.unstable[0]).toMatchObject({ flips: 2, changedPercent: 50, runs: 4 });
    expect(result.unstable[1]).toMatchObject({ flips: 0, changedPercent: 100, baselineChanges: 3 });
    expect(result.summary.flips).toBe(2);
  });

  it('does not call a change a flip when the baseline changed in between', () => {
    const result = computeInsights(
      input({
        runs: [
          run({ status: 'unresolved', diffPercent: 3, createdAt: daysAgo(9) }),
          run({ status: 'ok', baselineName: 'new.png', createdAt: daysAgo(8) }),
          run({ status: 'ok', baselineName: 'new.png', createdAt: daysAgo(7) }),
        ],
      })
    );
    expect(result.unstable[0].flips).toBe(0);
  });

  it('ranks screens by their newest accessibility issues, with the decisions taken on them', () => {
    const result = computeInsights(
      input({
        runs: [
          run({ a11yTotalCount: 9, a11yNewCount: 2, createdAt: daysAgo(9) }),
          // the newest run of a device counts, not the worst one
          run({ a11yTotalCount: 4, a11yNewCount: 1, createdAt: daysAgo(2) }),
          run({
            device: 'Galaxy S23',
            testVariationId: 'g',
            a11yTotalCount: 6,
            a11yNewCount: 0,
            createdAt: daysAgo(3),
          }),
          run({ name: 'Login', testVariationId: 'l', a11yTotalCount: 1, createdAt: daysAgo(3) }),
          run({ name: 'Clean', testVariationId: 'x', a11yTotalCount: 0, createdAt: daysAgo(3) }),
        ],
        a11yStates: [
          { screenName: 'Payment', status: 'reported' },
          { screenName: 'Payment', status: 'ignored' },
          { screenName: 'Payment', status: 'reported' },
        ],
        a11yRules: { 'Touch target too small': 12, 'Missing label': 30, 'Low contrast': 4 },
      })
    );
    expect(result.a11yScreens).toEqual([
      { name: 'Payment', customTags: '', issues: 6, newIssues: 1, reported: 2, ignored: 1 },
      { name: 'Login', customTags: '', issues: 1, newIssues: 0, reported: 0, ignored: 0 },
    ]);
    expect(result.a11yRules.map((rule) => rule.rule)).toEqual([
      'Missing label',
      'Touch target too small',
      'Low contrast',
    ]);
  });

  it('points at noise, early screenshots and hidden changes', () => {
    const runs = [
      ...[9, 8, 7].map((days) => run({ status: 'approved', diffPercent: 0.05, createdAt: daysAgo(days) })),
      ...[6, 5].map((days) =>
        run({
          testVariationId: 'c',
          name: 'Cards',
          captureWarnings: '[{"kind":"loading","message":"…"}]',
          createdAt: daysAgo(days),
        })
      ),
      run({ testVariationId: 'c', name: 'Cards', semanticChangeCount: 1, createdAt: daysAgo(4) }),
    ];
    const result = computeInsights(input({ runs }));
    expect(result.noise).toEqual([{ name: 'Payment', customTags: '', tinyApproved: 3, runs: 3 }]);
    expect(result.captureIssues).toEqual([{ name: 'Cards', customTags: '', loading: 2, hidden: 1, runs: 3 }]);
  });

  it('lists the checks each device is missing on the main branch', () => {
    const variations = [
      ...['Login', 'Payment', 'Cards', 'Profile'].map((name, i) =>
        variation({ id: `p${i}`, name, device: 'Pixel 7 emulator', lastRunAt: daysAgo(5) })
      ),
      ...['Login', 'Payment', 'Cards'].map((name, i) =>
        variation({ id: `g${i}`, name, device: 'Galaxy S23', lastRunAt: daysAgo(5) })
      ),
      // one-off device with a single check is not a coverage gap
      variation({ id: 'w', name: 'Login', device: 'Tablet', lastRunAt: daysAgo(5) }),
      // other branches do not count
      variation({ id: 'f', name: 'Feature only', device: 'Pixel 7 emulator', branchName: 'feature' }),
      // nor checks nobody runs any more
      variation({ id: 'dead', name: 'Old promo', device: 'Pixel 7 emulator', lastRunAt: daysAgo(200) }),
    ];
    const result = computeInsights(input({ variations }));
    expect(result.coverage).toEqual([
      {
        device: 'Galaxy S23 · Android 15',
        checks: 3,
        missingCount: 1,
        missing: [{ name: 'Profile', customTags: '' }],
      },
    ]);
  });

  it('counts reviews waiting for a decision by the newest run of each baseline', () => {
    const result = computeInsights(
      input({
        runs: [
          run({ status: 'unresolved', createdAt: daysAgo(9) }),
          // superseded by a passing run: no longer waiting
          run({ status: 'ok', createdAt: daysAgo(8) }),
          run({ testVariationId: 'c', name: 'Cards', status: 'new', createdAt: daysAgo(3) }),
          run({
            testVariationId: 'l',
            name: 'Login',
            status: 'approved',
            diffPercent: 1,
            createdAt: daysAgo(4),
            updatedAt: new Date(daysAgo(4).getTime() + 3 * 3600000),
          }),
        ],
      })
    );
    expect(result.summary.waiting).toBe(1);
    expect(result.summary.medianDecisionHours).toBe(3);
  });
});
