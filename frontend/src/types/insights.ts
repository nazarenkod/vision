export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type A11yRule =
  | "missing-label"
  | "touch-target"
  | "duplicate-label"
  | "low-contrast"
  | "input-without-label"
  | "redundant-role"
  | "not-accessible";

export interface A11yIssueInfo {
  // filing: a bug for the problem is being created right now
  status: "reported" | "ignored" | "filing";
  jiraKey?: string | null;
  jiraUrl?: string | null;
  comment?: string | null;
  // set when it was decided on another check: a component's problem holds on every screen
  screenName?: string;
  screenTitle?: string | null;
  // other bugs of the same problem, when problems decided apart are now one
  related?: Array<{
    code: string;
    jiraKey: string | null;
    jiraUrl: string | null;
  }>;
}

export interface A11yViolation {
  id: string;
  rule: A11yRule;
  severity: "error" | "warning" | "info";
  title: string;
  message: string;
  nodeKey: string;
  resourceId: string;
  className: string;
  label: string;
  bounds: Rect;
  details?: Record<string, number | string | boolean>;
  status: "new" | "existing";
  issue?: A11yIssueInfo;
  // the problem it is: rule + component + values, or rule + screen + element
  group: string;
  // the problem's id, as in the Jira bug's summary and labels (a11y-3f9c2a1b)
  problemCode: string;
}

export interface A11yReport {
  format: "appium-android" | "appium-ios";
  pixelsPerDp: number;
  pixelsPerDpEstimated: boolean;
  baselineChecked: boolean;
  summary: {
    new: number;
    existing: number;
    reported: number;
    ignored: number;
    fixed: number;
    total: number;
  };
  violations: A11yViolation[];
  ignored: A11yViolation[];
  fixed: Omit<A11yViolation, "status" | "issue" | "group" | "problemCode">[];
  resolved: Array<{
    violationId: string;
    jiraKey: string | null;
    jiraUrl: string | null;
  }>;
}

export interface StructuralChange {
  kind: "text" | "label" | "state" | "added" | "removed" | "resized" | "moved";
  key: string;
  element: string;
  resourceId: string;
  before?: string;
  after?: string;
  bounds: Rect;
}

export interface NoiseHint {
  kind: "status-bar" | "dynamic-text" | "anti-aliasing";
  message: string;
  ignoreArea?: Rect;
  // the element the noisy area stands for, when there is one (REQ-024-40)
  element?: { selector: string; element: string };
}

export interface CaptureWarning {
  kind: "loading" | "screen-mismatch" | "duplicate-screen";
  message: string;
  elements?: string[];
  similarity?: number;
  looksLike?: string;
}

export type ElementRuleAction = "ignore" | "tolerate" | "compare";

export interface ElementRule {
  id: string;
  selector: string;
  // compare: only the elements such rules match are compared on this screen
  action: ElementRuleAction;
  maxDiffPercent?: number;
  note?: string;
}

export interface UiTreeSettings {
  excludeSystemBars: boolean;
  compensateMoves: boolean;
  maxMoveDp: number | null;
  detectSemanticChanges: boolean;
  detectLoading: boolean;
  detectScreenMismatch: boolean;
  elementRules: ElementRule[];
  // the device other devices are compared with, for information
  referenceDevice?: DeviceProfile | null;
  // where the screen's title is in the UI tree, first match wins; not on the
  // settings page since 026, but kept so a save does not erase it
  screenTitle?: string[];
  // what the team agreed an accessible screen is (026)
  a11yNorms?: Partial<A11yNorms>;
}

/** Every accessibility rule, in the order the settings page lists them. */
export const A11Y_RULES: A11yRule[] = [
  "touch-target",
  "low-contrast",
  "missing-label",
  "input-without-label",
  "duplicate-label",
  "not-accessible",
  "redundant-role",
];

export interface A11yNorms {
  // minimum tap area: dp on Android, pt on iOS
  touchTargetAndroid: number;
  touchTargetIos: number;
  // minimum contrast ratio for body text and for large text
  contrast: number;
  contrastLarge: number;
  disabledRules: A11yRule[];
}

export const DEFAULT_A11Y_NORMS: A11yNorms = {
  touchTargetAndroid: 48,
  touchTargetIos: 44,
  contrast: 4.5,
  contrastLarge: 3,
  disabledRules: [],
};

export type A11yNormField = Exclude<keyof A11yNorms, "disabledRules">;

// the same limits the server reads them by
export const A11Y_NORM_LIMITS: Record<
  A11yNormField,
  { min: number; max: number; integer: boolean }
> = {
  touchTargetAndroid: { min: 24, max: 96, integer: true },
  touchTargetIos: { min: 24, max: 96, integer: true },
  contrast: { min: 1.5, max: 7, integer: false },
  contrastLarge: { min: 1.5, max: 7, integer: false },
};

/** A typed norm, or null when it is not a number within the limits. */
export function parseNorm(field: A11yNormField, text: string): number | null {
  const value = Number(text.trim().replace(",", "."));
  const { min, max, integer } = A11Y_NORM_LIMITS[field];
  if (!text.trim() || !Number.isFinite(value) || value < min || value > max)
    return null;
  // contrast to one decimal: 1.1 * 10 is not exactly 11 in floating point
  const step = integer ? 1 : 10;
  if (Math.abs(Math.round(value * step) - value * step) > 1e-9) return null;
  return value;
}

/** The project's norms, the default for whatever it has not set. */
export function a11yNormsOf(settings: UiTreeSettings): A11yNorms {
  const saved = settings.a11yNorms ?? {};
  const norms = { ...DEFAULT_A11Y_NORMS };
  (Object.keys(A11Y_NORM_LIMITS) as A11yNormField[]).forEach((field) => {
    const value = saved[field];
    if (typeof value === "number" && parseNorm(field, String(value)) !== null)
      norms[field] = value;
  });
  norms.disabledRules = Array.isArray(saved.disabledRules)
    ? A11Y_RULES.filter((rule) => saved.disabledRules?.includes(rule))
    : [];
  return norms;
}

/** What a decision answers: the problems it touched, and what did not work out in Jira. */
export interface A11yDecisionResult {
  problems?: string[];
  warnings?: string[];
}

export interface DeviceProfile {
  os: string;
  device: string;
  browser: string;
  viewport: string;
}

export interface CrossDeviceReport {
  compared: number;
  differences: Array<{
    key: string;
    element: string;
    field: "text" | "label" | "state";
    reference: string;
    here: string;
  }>;
  notFound: Array<{ key: string; element: string }>;
  onlyHere: number;
  truncated?: { differences: number; notFound: number };
}

export type CrossDeviceResult =
  | { status: "no-tree" | "no-reference" }
  | {
      status: "is-reference" | "no-reference-tree" | "other-platform";
      referenceDevice: string;
    }
  | {
      status: "compared";
      referenceDevice: string;
      referenceSource: "run" | "baseline";
      referenceTestRunId: string | null;
      report: CrossDeviceReport;
    };

export const DEFAULT_UI_TREE_SETTINGS: UiTreeSettings = {
  excludeSystemBars: true,
  compensateMoves: false,
  maxMoveDp: null,
  detectSemanticChanges: true,
  detectLoading: true,
  detectScreenMismatch: true,
  elementRules: [],
};

export interface StructureInfo {
  hasUiTree: boolean;
  hasBaselineUiTree: boolean;
  changes: StructuralChange[];
  regions: Array<{
    region: Rect;
    key: string | null;
    element: string | null;
    resourceId: string | null;
  }>;
  hints: NoiseHint[];
  invisible: StructuralChange[];
  warnings: CaptureWarning[];
  rules: ScreenRule[];
  // what is compared when the check names its elements (spec 015)
  compareOnly?: {
    active: boolean;
    keep: Rect[];
    problems: CompareOnlyProblem[];
  };
  ignoredAreas: Rect[];
  toleratedAreas: Array<Rect & { maxDiffPercent: number }>;
  systemBars: Rect[];
  moves: Array<{ key: string; element: string; dxDp: number; dyDp: number }>;
  // elements a rule can be made for by clicking them on the screenshot
  elements?: PickableElement[];
  baselineElements?: PickableElement[];
  // saved ignore areas that stand for one element (REQ-024-50)
  areaSuggestions?: Array<{
    areaId: string;
    selector: string;
    element: string;
  }>;
  settings: UiTreeSettings;
}

export type RuleScope = "screen" | "project";

export type ScreenRule = ElementRule & {
  scope: RuleScope;
  matches: number;
  // what the rule matched on each screenshot
  found?: { current: Rect[]; baseline: Rect[] };
};

export type CompareOnlyProblem =
  | { kind: "no-tree" }
  | { kind: "nothing-found"; ruleId: string; selector: string }
  | {
      kind: "disappeared" | "appeared";
      ruleId: string;
      selector: string;
      element: string;
    }
  | {
      kind: "count";
      ruleId: string;
      selector: string;
      baseline: number;
      current: number;
    }
  | {
      kind: "resized";
      ruleId: string;
      selector: string;
      element: string;
      before: Rect;
      after: Rect;
    };

export interface ChangeGroup {
  id: string;
  kind: "component" | "structural" | "visual" | "new";
  title: string;
  screens: string[];
  testRuns: import("./testRun").TestRun[];
  changes: StructuralChange[];
  noise: NoiseHint | null;
  fingerprint: string;
  componentId?: string;
  alsoChangedElsewhere?: import("./testRun").TestRun[];
}

export interface AiStatus {
  enabled: boolean;
  provider: "gemini" | "ollama" | "none";
  model: string | null;
  dailyLimit: number;
  usedToday: number;
}

export interface GroupSummary {
  summary: string;
  verdict: "intended" | "regression" | "noise";
  confidence: number;
  source: "ai" | "rules";
  cached: boolean;
  model: string | null;
}

/** Capture warnings of a run, whichever shape it arrived in (JSON string from the API). */
export function captureWarnings(run: {
  captureWarnings?: string | null;
}): CaptureWarning[] {
  if (!run.captureWarnings) return [];
  try {
    const parsed = JSON.parse(run.captureWarnings);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseUiTreeSettings(value?: string | null): UiTreeSettings {
  if (!value) return { ...DEFAULT_UI_TREE_SETTINGS };
  try {
    const parsed = JSON.parse(value) ?? {};
    return {
      ...DEFAULT_UI_TREE_SETTINGS,
      ...parsed,
      elementRules: Array.isArray(parsed.elementRules)
        ? parsed.elementRules
        : [],
    };
  } catch {
    return { ...DEFAULT_UI_TREE_SETTINGS };
  }
}

export interface PickableElement {
  // the node's index in its tree and the nearest pickable element around it
  // (absent from servers older than spec 024)
  index?: number;
  parent?: number | null;
  selector: string;
  element: string;
  bounds: Rect;
}

export interface ProjectInsights {
  days: number;
  windowStart: string;
  historyStart: string;
  partialHistory: boolean;
  summary: {
    baselines: number;
    unused: number;
    checks: number;
    runs: number;
    changedPercent: number;
    flips: number;
    a11yIssues: number;
    waiting: number;
    medianDecisionHours: number | null;
  };
  unused: Array<{
    id: string;
    name: string;
    customTags: string;
    branchName: string;
    device: string;
    hasBaseline: boolean;
    lastUsedAt: string;
    idleDays: number;
  }>;
  unstable: Array<{
    name: string;
    customTags: string;
    devices: string[];
    runs: number;
    changedPercent: number;
    rejected: number;
    flips: number;
    baselineChanges: number;
    lastChangeAt: string | null;
  }>;
  a11yScreens: Array<{
    name: string;
    customTags: string;
    issues: number;
    newIssues: number;
    reported: number;
    ignored: number;
  }>;
  a11yRules: Array<{ rule: string; count: number }>;
  noise: Array<{
    name: string;
    customTags: string;
    tinyApproved: number;
    runs: number;
  }>;
  captureIssues: Array<{
    name: string;
    customTags: string;
    loading: number;
    hidden: number;
    runs: number;
  }>;
  coverage: Array<{
    device: string;
    checks: number;
    missingCount: number;
    missing: Array<{ name: string; customTags: string }>;
  }>;
}

export interface JiraBugPreparation {
  parent: {
    key: string;
    summary: string;
    projectKey: string;
    assignee: string | null;
  };
  issueTypes: Array<{ id: string; name: string; subtask: boolean }>;
  issueTypeId: string;
  linkTypes: string[];
  linkType: string | null;
  summary: string;
  block: string;
  screen: string;
  filled: Array<{ field: string; value: string; source: "task" | "vision" }>;
  inputs: JiraBugInput[];
  missing: string[];
  problem: { code: string; component: string | null; everyScreen: boolean };
  // the labels the bug gets: its id and the markers of its facts
  markers?: string[];
  // decided in Vision already, maybe by a colleague a moment ago
  existing: {
    status: "reported" | "ignored" | "filing";
    jiraKey: string | null;
    jiraUrl: string | null;
    screenName: string;
    screenTitle: string | null;
  } | null;
  // bugs in the task's Jira project with the problem's id
  inJira: Array<{
    key: string;
    url: string;
    summary: string;
    status: string;
    done: boolean;
  }>;
}

export interface JiraBugResult {
  jiraKey: string;
  jiraUrl: string | null;
  code: string;
  // nothing was filed: Vision or Jira had the problem's bug already, and it was linked
  alreadyFiled: boolean;
  warnings: string[];
}

/** A bug field to set in the dialog; values are in the form Jira's create call takes. */
export interface JiraBugInput {
  id: string;
  name: string;
  required: boolean;
  type: "user" | "option" | "options" | "text" | "number";
  options?: Array<{ id: string; label: string }>;
  value?: unknown;
  display?: string;
}

export interface JiraUser {
  accountId?: string;
  name?: string;
  key?: string;
  displayName?: string;
}
