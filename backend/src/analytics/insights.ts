/**
 * Project insights computed from plain rows, so the rules can be tested
 * without a database: unused baselines, unstable screens, accessibility
 * hotspots, noise, capture quality, device coverage and review load.
 */

export interface VariationRow {
  id: string;
  name: string;
  customTags: string;
  branchName: string;
  os: string;
  device: string;
  browser: string;
  viewport: string;
  baselineName: string | null;
  createdAt: Date;
  updatedAt: Date;
  // newest run compared with this variation, if any run is left
  lastRunAt: Date | null;
  // newest baseline approved for it
  lastBaselineAt: Date | null;
}

export interface RunRow {
  testVariationId: string | null;
  name: string;
  customTags: string | null;
  os: string | null;
  device: string | null;
  browser: string | null;
  viewport: string | null;
  status: string;
  diffPercent: number | null;
  baselineName: string | null;
  createdAt: Date;
  updatedAt: Date;
  a11yNewCount: number | null;
  a11yTotalCount: number | null;
  semanticChangeCount: number | null;
}

export interface A11yStateRow {
  screenName: string;
  status: string;
}

export interface InsightsInput {
  now: Date;
  days: number;
  mainBranchName: string;
  // oldest build still stored; older history was removed by the build limit
  oldestBuildAt: Date | null;
  variations: VariationRow[];
  // runs of the window, oldest first
  runs: RunRow[];
  // baselines approved in the window, by variation
  baselineChanges: Record<string, number>;
  a11yStates: A11yStateRow[];
  // rule title -> occurrences, from the newest accessibility report of each check
  a11yRules: Record<string, number>;
}

const DAY = 24 * 60 * 60 * 1000;
const CHANGED = new Set(['unresolved', 'failed', 'approved', 'autoApproved']);
const WAITING = new Set(['unresolved', 'new']);
// a change this small that keeps being approved is noise rather than intent
const TINY_DIFF_PERCENT = 0.2;
const MIN_RUNS_FOR_RATES = 3;
const LIST_LIMIT = 50;

export const deviceOf = (row: {
  os?: string | null;
  device?: string | null;
  browser?: string | null;
  viewport?: string | null;
}) => [row.device, row.os, row.browser, row.viewport].filter(Boolean).join(' · ') || 'No device';

const checkKeyOf = (row: { name: string; customTags?: string | null }) =>
  JSON.stringify([row.name, row.customTags ?? '']);

export function computeInsights(input: InsightsInput) {
  const { now, days } = input;
  const windowStart = new Date(now.getTime() - days * DAY);
  // with a build limit, history may not reach back as far as the window
  const historyStart = input.oldestBuildAt && input.oldestBuildAt > windowStart ? input.oldestBuildAt : windowStart;
  const partialHistory = historyStart > windowStart;

  // ---- unused baselines: nothing compared with them since the start of the window
  const unused = input.variations
    .map((variation) => {
      const lastUsedAt = [variation.lastRunAt, variation.lastBaselineAt, variation.createdAt]
        .filter((date): date is Date => !!date)
        .reduce((a, b) => (a > b ? a : b));
      return { variation, lastUsedAt };
    })
    .filter(({ lastUsedAt }) => lastUsedAt < historyStart)
    .sort((a, b) => a.lastUsedAt.getTime() - b.lastUsedAt.getTime())
    .map(({ variation, lastUsedAt }) => ({
      id: variation.id,
      name: variation.name,
      customTags: variation.customTags,
      branchName: variation.branchName,
      device: deviceOf(variation),
      hasBaseline: !!variation.baselineName,
      lastUsedAt,
      idleDays: Math.floor((now.getTime() - lastUsedAt.getTime()) / DAY),
    }));

  // ---- per check: runs, changes, rejections, flips, noise, capture quality
  type CheckStats = {
    name: string;
    customTags: string;
    devices: Set<string>;
    runs: number;
    changed: number;
    rejected: number;
    flips: number;
    tinyApproved: number;
    hidden: number;
    lastChangeAt: Date | null;
    latestA11y: Map<string, { at: Date; total: number; new: number }>;
  };
  const checks = new Map<string, CheckStats>();
  const statsOf = (run: RunRow) => {
    const key = checkKeyOf(run);
    let stats = checks.get(key);
    if (!stats) {
      stats = {
        name: run.name,
        customTags: run.customTags ?? '',
        devices: new Set(),
        runs: 0,
        changed: 0,
        rejected: 0,
        flips: 0,
        tinyApproved: 0,
        hidden: 0,
        lastChangeAt: null,
        latestA11y: new Map(),
      };
      checks.set(key, stats);
    }
    return stats;
  };

  // a flip: the screen differed, and the next run of the same device matched the
  // same baseline again without anyone changing it — the screen, not the app, moved
  const previousByVariation = new Map<string, RunRow>();
  const decisionHours: number[] = [];

  for (const run of input.runs) {
    const stats = statsOf(run);
    const device = deviceOf(run);
    stats.devices.add(device);
    stats.runs++;
    const changed = CHANGED.has(run.status) || (run.diffPercent ?? 0) > 0;
    if (changed) {
      stats.changed++;
      if (!stats.lastChangeAt || run.createdAt > stats.lastChangeAt) stats.lastChangeAt = run.createdAt;
    }
    if (run.status === 'failed') stats.rejected++;
    if (
      run.status === 'approved' &&
      run.diffPercent !== null &&
      run.diffPercent > 0 &&
      run.diffPercent < TINY_DIFF_PERCENT
    ) {
      stats.tinyApproved++;
    }
    if ((run.semanticChangeCount ?? 0) > 0) stats.hidden++;
    if (run.status === 'approved' || run.status === 'failed') {
      decisionHours.push((run.updatedAt.getTime() - run.createdAt.getTime()) / 3600000);
    }
    if (run.a11yTotalCount !== null) {
      const latest = stats.latestA11y.get(device);
      if (!latest || run.createdAt >= latest.at) {
        stats.latestA11y.set(device, { at: run.createdAt, total: run.a11yTotalCount, new: run.a11yNewCount ?? 0 });
      }
    }
    if (run.testVariationId) {
      const previous = previousByVariation.get(run.testVariationId);
      if (
        previous &&
        (previous.status === 'unresolved' || previous.status === 'failed') &&
        run.status === 'ok' &&
        previous.baselineName === run.baselineName
      ) {
        stats.flips++;
      }
      previousByVariation.set(run.testVariationId, run);
    }
  }

  // waiting for a decision: the newest run of a baseline, not older runs nobody closed
  const waiting = [...previousByVariation.values()].filter((run) => WAITING.has(run.status)).length;

  const baselineChangesByCheck = new Map<string, number>();
  for (const variation of input.variations) {
    const count = input.baselineChanges[variation.id] ?? 0;
    if (!count) continue;
    const key = checkKeyOf(variation);
    baselineChangesByCheck.set(key, (baselineChangesByCheck.get(key) ?? 0) + count);
  }

  const all = [...checks.entries()].map(([key, stats]) => ({ key, ...stats }));
  const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

  const unstable = all
    .filter((check) => check.runs >= MIN_RUNS_FOR_RATES && (check.changed > 0 || check.flips > 0))
    .map((check) => ({
      name: check.name,
      customTags: check.customTags,
      devices: [...check.devices].sort(),
      runs: check.runs,
      changedPercent: percent(check.changed, check.runs),
      rejected: check.rejected,
      flips: check.flips,
      baselineChanges: baselineChangesByCheck.get(check.key) ?? 0,
      lastChangeAt: check.lastChangeAt,
    }))
    .sort((a, b) => b.flips - a.flips || b.changedPercent - a.changedPercent || b.runs - a.runs)
    .slice(0, LIST_LIMIT);

  // decisions on accessibility issues are kept by screen name
  const decided = new Map<string, { reported: number; ignored: number }>();
  for (const state of input.a11yStates) {
    const entry = decided.get(state.screenName) ?? { reported: 0, ignored: 0 };
    if (state.status === 'reported') entry.reported++;
    if (state.status === 'ignored') entry.ignored++;
    decided.set(state.screenName, entry);
  }
  const a11yScreens = all
    .filter((check) => check.latestA11y.size > 0)
    .map((check) => {
      const latest = [...check.latestA11y.values()];
      const issues = Math.max(...latest.map((entry) => entry.total));
      const fresh = Math.max(...latest.map((entry) => entry.new));
      const decisions = decided.get(check.name) ?? { reported: 0, ignored: 0 };
      return {
        name: check.name,
        customTags: check.customTags,
        issues,
        newIssues: fresh,
        reported: decisions.reported,
        ignored: decisions.ignored,
      };
    })
    .filter((screen) => screen.issues > 0)
    .sort((a, b) => b.issues - a.issues || b.newIssues - a.newIssues)
    .slice(0, LIST_LIMIT);

  const noise = all
    .filter((check) => check.tinyApproved >= 3)
    .map((check) => ({
      name: check.name,
      customTags: check.customTags,
      tinyApproved: check.tinyApproved,
      runs: check.runs,
    }))
    .sort((a, b) => b.tinyApproved - a.tinyApproved)
    .slice(0, LIST_LIMIT);

  const captureIssues = all
    .filter((check) => check.hidden >= 2)
    .map((check) => ({
      name: check.name,
      customTags: check.customTags,
      hidden: check.hidden,
      runs: check.runs,
    }))
    .sort((a, b) => b.hidden - a.hidden)
    .slice(0, LIST_LIMIT);

  // ---- device coverage, on the main branch: checks a device is missing. Unused
  // baselines do not count: a dead check is no gap, it is listed for deletion above.
  const unusedIds = new Set(unused.map((item) => item.id));
  const main = input.variations.filter(
    (variation) => variation.branchName === input.mainBranchName && !unusedIds.has(variation.id)
  );
  const checksOnMain = new Map<string, { name: string; customTags: string }>();
  const checksByDevice = new Map<string, Set<string>>();
  for (const variation of main) {
    const key = checkKeyOf(variation);
    checksOnMain.set(key, { name: variation.name, customTags: variation.customTags });
    const device = deviceOf(variation);
    if (!checksByDevice.has(device)) checksByDevice.set(device, new Set());
    checksByDevice.get(device).add(key);
  }
  const coverage = [...checksByDevice.entries()]
    .map(([device, keys]) => ({
      device,
      checks: keys.size,
      missing: [...checksOnMain.keys()].filter((key) => !keys.has(key)).map((key) => checksOnMain.get(key)),
    }))
    // a device with few checks is another kind of test (web next to mobile), not a gap
    .filter((entry) => entry.checks >= checksOnMain.size / 2 && entry.missing.length > 0)
    .map((entry) => ({ ...entry, missingCount: entry.missing.length, missing: entry.missing.slice(0, LIST_LIMIT) }))
    .sort((a, b) => b.missingCount - a.missingCount);

  const ruleTop = Object.entries(input.a11yRules)
    .map(([rule, count]) => ({ rule, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const sortedHours = [...decisionHours].sort((a, b) => a - b);
  const medianDecisionHours = sortedHours.length
    ? Math.round(sortedHours[Math.floor(sortedHours.length / 2)] * 10) / 10
    : null;

  return {
    days,
    windowStart,
    historyStart,
    partialHistory,
    summary: {
      baselines: input.variations.length,
      unused: unused.length,
      checks: all.length,
      runs: input.runs.length,
      changedPercent: percent(
        all.reduce((sum, check) => sum + check.changed, 0),
        input.runs.length
      ),
      flips: all.reduce((sum, check) => sum + check.flips, 0),
      a11yIssues: a11yScreens.reduce((sum, screen) => sum + screen.issues, 0),
      waiting,
      medianDecisionHours,
    },
    unused: unused.slice(0, 500),
    unstable,
    a11yScreens,
    a11yRules: ruleTop,
    noise,
    captureIssues,
    coverage,
  };
}

export type Insights = ReturnType<typeof computeInsights>;
