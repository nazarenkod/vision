// Build overview (031): everything the Overview tab, the report and the public
// page say about one build, worked out from rows the service loads. Pure, so
// the three agree and the numbers are tested without a database.
import { TestStatus } from '@prisma/client';
import { A11yFinding } from '../a11y/a11y-issues';

export type Verdict = 'running' | 'waiting' | 'reviewed' | 'passed';

/** The fields of a run the overview reads. */
export interface OverviewRun {
  id: string;
  name: string;
  customTags: string | null;
  status: TestStatus;
  device: string | null;
  os: string | null;
  browser: string | null;
  viewport: string | null;
  featureName: string | null;
  a11yNewCount: number | null;
  decidedById: string | null;
  diffPercent: number | null;
}

export type PreviousRun = Pick<
  OverviewRun,
  'name' | 'customTags' | 'status' | 'device' | 'os' | 'browser' | 'viewport' | 'diffPercent'
>;

export interface OverviewBugInput {
  kind: 'visual' | 'a11y';
  jiraKey: string;
  jiraUrl: string | null;
  summary: string;
  // the run of this build to open for it
  testRunId: string;
  // filed from a run of this build, rather than earlier
  isNew: boolean;
}

export interface OverviewInput {
  build: { isRunning: boolean | null };
  runs: OverviewRun[];
  previous: { number: number; runs: PreviousRun[] } | null;
  // approvals made before runs kept who decided them: run id → user id, from the baseline it made
  approvedBy: Map<string, string>;
  // user id → name as people know it; no email (REQ-031-68)
  people: Map<string, string>;
  bugs: OverviewBugInput[];
  // run id → its screenshot's size in pixels ("1080×2400"), for runs the service measured
  screenSizes?: Map<string, string>;
}

/** Screenshots by how they came out; `changed` and `new` are the ones waiting. */
export interface Outcome {
  total: number;
  changed: number;
  new: number;
  rejected: number;
  passed: number;
}

export interface DeviceRow extends Outcome {
  device: string;
  os: string;
  browser: string;
  viewport: string;
  // the screenshot's size in pixels: Appium runs seldom send a viewport (REQ-031-08)
  screen: string;
  a11yNew: number;
}

export interface FeatureRow extends Outcome {
  name: string;
  // the test sent featureName: the row holds its checks; otherwise it is one check by its full name
  grouped: boolean;
  bugs: number;
}

export interface PersonDecisions {
  // null: decided before Vision kept who did it
  name: string | null;
  approved: number;
  rejected: number;
}

export interface BuildOverview {
  verdict: Verdict;
  counts: Outcome & { waiting: number; a11yNew: number; bugs: number };
  progress: { decided: number; needed: number; people: PersonDecisions[] };
  devices: DeviceRow[];
  features: FeatureRow[];
  // features with nothing to look at, folded into one row that opens into them (REQ-031-09)
  quietFeatures: { count: number; screens: number; features: FeatureRow[] };
  bugs: OverviewBugInput[];
  previous: { number: number; changed: number; added: number; gone: number } | null;
}

const PASSED: TestStatus[] = [TestStatus.ok, TestStatus.approved, TestStatus.autoApproved];
// came out different from the baseline when it arrived, decided since or not
const DECIDED_AFTER_COMPARING: TestStatus[] = [TestStatus.approved, TestStatus.failed];
/**
 * The screenshot did not match its baseline when it arrived, decided since or
 * not. Approved or rejected alone does not say so: a new screenshot has no
 * baseline, and approving it only makes one. The difference does.
 */
const differed = (run: Pick<PreviousRun, 'status' | 'diffPercent'>) =>
  run.status === TestStatus.unresolved || (DECIDED_AFTER_COMPARING.includes(run.status) && (run.diffPercent ?? 0) > 0);
const NEEDED_DECISION: TestStatus[] = [TestStatus.unresolved, TestStatus.new, TestStatus.approved, TestStatus.failed];

const emptyOutcome = (): Outcome => ({ total: 0, changed: 0, new: 0, rejected: 0, passed: 0 });

function count(outcome: Outcome, status: TestStatus) {
  outcome.total += 1;
  if (status === TestStatus.unresolved) outcome.changed += 1;
  else if (status === TestStatus.new) outcome.new += 1;
  else if (status === TestStatus.failed) outcome.rejected += 1;
  else if (PASSED.includes(status)) outcome.passed += 1;
}

const waiting = (outcome: Outcome) => outcome.changed + outcome.new;

/** A screenshot's identity across builds: the check and its device profile (ADR-0005). */
export const runIdentity = (run: PreviousRun): string =>
  [run.name, run.customTags ?? '', run.device ?? '', run.os ?? '', run.browser ?? '', run.viewport ?? ''].join(
    '\u0000'
  );

export function verdictOf(isRunning: boolean | null, counts: Outcome): Verdict {
  if (isRunning) return 'running';
  if (waiting(counts)) return 'waiting';
  if (counts.rejected) return 'reviewed';
  return 'passed';
}

function progressOf(input: OverviewInput) {
  const byPerson = new Map<string | null, PersonDecisions>();
  let needed = 0;
  let decided = 0;
  for (const run of input.runs) {
    if (!NEEDED_DECISION.includes(run.status)) continue;
    needed += 1;
    const approved = run.status === TestStatus.approved;
    if (!approved && run.status !== TestStatus.failed) continue;
    decided += 1;
    const userId = run.decidedById ?? (approved ? input.approvedBy.get(run.id) : undefined) ?? null;
    const name = userId ? (input.people.get(userId) ?? null) : null;
    const person = byPerson.get(name) ?? { name, approved: 0, rejected: 0 };
    if (approved) person.approved += 1;
    else person.rejected += 1;
    byPerson.set(name, person);
  }
  const people = [...byPerson.values()].sort(
    (a, b) => b.approved + b.rejected - (a.approved + a.rejected) || (a.name ?? '￿').localeCompare(b.name ?? '￿')
  );
  return { decided, needed, people };
}

/** The device profile a run belongs to: one row of the devices table. */
export const deviceKey = (run: Pick<OverviewRun, 'device' | 'os' | 'browser' | 'viewport'>): string =>
  [run.device ?? '', run.os ?? '', run.browser ?? '', run.viewport ?? ''].join('\u0000');

function devicesOf(runs: OverviewRun[], screenSizes: Map<string, string> = new Map()): DeviceRow[] {
  const rows = new Map<string, DeviceRow>();
  for (const run of runs) {
    const key = deviceKey(run);
    const row = rows.get(key) ?? {
      device: run.device ?? '',
      os: run.os ?? '',
      browser: run.browser ?? '',
      viewport: run.viewport ?? '',
      screen: '',
      a11yNew: 0,
      ...emptyOutcome(),
    };
    count(row, run.status);
    row.screen ||= screenSizes.get(run.id) ?? '';
    row.a11yNew += run.a11yNewCount ?? 0;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.device.localeCompare(b.device) || a.os.localeCompare(b.os));
}

/**
 * The row of the features table a run belongs to. Only featureName groups:
 * guessing a feature from the check's name joined checks that have nothing in
 * common, so a check without one stands on its own.
 */
function featureRowOf(run: Pick<OverviewRun, 'featureName' | 'name'>) {
  const feature = run.featureName?.trim();
  return feature
    ? { key: `f\u0000${feature}`, name: feature, grouped: true }
    : { key: `c\u0000${run.name}`, name: run.name, grouped: false };
}

function featuresOf(runs: OverviewRun[], bugs: OverviewBugInput[]) {
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const rows = new Map<string, FeatureRow>();
  for (const run of runs) {
    const { key, name, grouped } = featureRowOf(run);
    const row = rows.get(key) ?? { name, grouped, bugs: 0, ...emptyOutcome() };
    count(row, run.status);
    rows.set(key, row);
  }
  for (const bug of bugs) {
    const run = runsById.get(bug.testRunId);
    if (run) rows.get(featureRowOf(run).key).bugs += 1;
  }
  const all = [...rows.values()];
  const quiet = all.filter((row) => !waiting(row) && !row.rejected && !row.bugs);
  const features = all
    .filter((row) => !quiet.includes(row))
    .sort(
      (a, b) => waiting(b) - waiting(a) || b.rejected - a.rejected || b.bugs - a.bugs || a.name.localeCompare(b.name)
    );
  return {
    features,
    quietFeatures: {
      count: quiet.length,
      screens: quiet.reduce((sum, row) => sum + row.total, 0),
      features: quiet.sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

function previousOf(runs: OverviewRun[], previous: OverviewInput['previous']): BuildOverview['previous'] {
  if (!previous) return null;
  const before = new Map(previous.runs.map((run) => [runIdentity(run), run]));
  const now = new Set(runs.map(runIdentity));
  let changed = 0;
  let added = 0;
  for (const run of runs) {
    const earlier = before.get(runIdentity(run));
    if (!earlier) added += 1;
    else if (differed(run) && !differed(earlier)) changed += 1;
  }
  const gone = [...before.keys()].filter((key) => !now.has(key)).length;
  return { number: previous.number, changed, added, gone };
}

export function buildOverview(input: OverviewInput): BuildOverview {
  const counts = emptyOutcome();
  let a11yNew = 0;
  for (const run of input.runs) {
    count(counts, run.status);
    a11yNew += run.a11yNewCount ?? 0;
  }
  const bugs = [...input.bugs].sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.jiraKey.localeCompare(b.jiraKey));
  return {
    verdict: verdictOf(input.build.isRunning, counts),
    counts: { ...counts, waiting: waiting(counts), a11yNew, bugs: bugs.length },
    progress: progressOf(input),
    devices: devicesOf(input.runs, input.screenSizes),
    ...featuresOf(input.runs, bugs),
    bugs,
    previous: previousOf(input.runs, input.previous),
  };
}

// enough for an overview; the rest are on the Accessibility tab (REQ-038-06)
export const A11Y_PROBLEMS_SHOWN = 20;

export interface OverviewA11yProblem extends A11yFinding {
  // the run to open on the Accessibility tab (REQ-038-07)
  testRunId: string;
  check: string;
  device: string;
  os: string;
}

export interface OverviewA11y {
  // some screenshot of the build came with a UI tree: without one there is nothing to say (REQ-038-08)
  checked: boolean;
  problems: OverviewA11yProblem[];
  // problems past the ones shown
  more: number;
}

/**
 * The accessibility card of the Overview (038): a row per problem per
 * screenshot, so the new rows add up to the tile; new first.
 */
export function a11yOf(
  runs: Array<Pick<OverviewRun, 'id' | 'name' | 'device' | 'os'> & { a11yTotalCount: number | null }>,
  findings: Array<A11yFinding & { testRunId: string }>,
  limit = A11Y_PROBLEMS_SHOWN
): OverviewA11y {
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const problems = findings
    .filter((finding) => runsById.has(finding.testRunId))
    .map((finding): OverviewA11yProblem => {
      const run = runsById.get(finding.testRunId);
      return { ...finding, check: run.name, device: run.device ?? '', os: run.os ?? '' };
    })
    .sort(
      (a, b) =>
        Number(b.isNew) - Number(a.isNew) ||
        a.check.localeCompare(b.check) ||
        a.device.localeCompare(b.device) ||
        a.rule.localeCompare(b.rule)
    );
  return {
    checked: runs.some((run) => run.a11yTotalCount !== null),
    problems: problems.slice(0, limit),
    more: Math.max(0, problems.length - limit),
  };
}
