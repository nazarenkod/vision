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
  // ignored by the project's problem class of this name, not by a decision
  byClass?: string;
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
  // the project's problem class that took it
  problemClass?: string;
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
}

export interface CaptureWarning {
  kind: "loading" | "screen-mismatch" | "duplicate-screen";
  message: string;
  elements?: string[];
  similarity?: number;
  looksLike?: string;
}

export interface ElementRule {
  id: string;
  selector: string;
  action: "ignore" | "tolerate";
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
  // where the screen's title is in the UI tree, first match wins
  screenTitle?: string[];
  // when two accessibility issues are the same problem, per rule
  a11yDuplicates?: Partial<Record<A11yRule, DuplicateMode>>;
  // the project's problem classes, first match wins
  a11yClasses?: ProblemClass[];
}

/**
 * Which issues are one problem and what is done with them: the rules it takes,
 * a pattern on the element id (a glob with * and ?, or /regex/ whose group is
 * the component id), how duplicates are told and whether bugs are filed.
 */
export interface ProblemClass {
  id: string;
  name: string;
  rules?: A11yRule[];
  match: string;
  mode?: DuplicateMode;
  action?: "report" | "ignore";
}

export type DuplicateMode = "component-value" | "component" | "screen";

// as the server defaults them (a11y-problems.ts)
export const DEFAULT_DUPLICATE_MODES: Record<A11yRule, DuplicateMode> = {
  "touch-target": "component-value",
  "low-contrast": "component-value",
  "missing-label": "component",
  "input-without-label": "component",
  "redundant-role": "component",
  "not-accessible": "component",
  "duplicate-label": "screen",
};

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
  rules: Array<ElementRule & { scope: "screen" | "project"; matches: number }>;
  ignoredAreas: Rect[];
  toleratedAreas: Array<Rect & { maxDiffPercent: number }>;
  systemBars: Rect[];
  moves: Array<{ key: string; element: string; dxDp: number; dyDp: number }>;
  // elements a rule can be made for by clicking them on the screenshot
  elements?: PickableElement[];
  settings: UiTreeSettings;
}

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
