import type { AllowedBrowser, ProjectPlatform } from "./project";

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

export type UiTreeFormat = "appium-android" | "appium-ios" | "web";

export interface A11yReport {
  format: UiTreeFormat;
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
  // the element on the current tree, to act on it from the change (REQ-078-02)
  index?: number;
}

// an element whose text changed only in its numbers (REQ-077-07)
export interface NumberChange {
  key: string;
  element: string;
  // the element on the current tree, to pick it on the screenshot (REQ-077-09)
  index: number | null;
  before: string;
  after: string;
}

export interface NoiseHint {
  kind: "status-bar" | "dynamic-text" | "anti-aliasing" | "numbers";
  message: string;
  // kind "numbers": the elements whose numbers changed
  numbers?: NumberChange[];
  ignoreArea?: Rect;
  // the element the noisy area stands for, when there is one (REQ-024-40)
  element?: { selector: string; element: string };
}

// variable: the pixels are left out and the text is checked against parts (spec 033)
export type ElementRuleAction = "ignore" | "tolerate" | "compare" | "variable";

/** A part of a checked text: fixed text, or a place that fits a pattern (spec 033). */
export type TextPart = { text: string } | { pattern: string; sample?: string };

export type VariableTextReason = "text" | "pattern" | "too-long";

/** How the texts a variable-text rule found on the snapshot fared. */
export interface VariableCheck {
  items: Array<{
    text: string;
    ok: boolean;
    reason?: VariableTextReason;
    bounds: Rect;
    element: string;
  }>;
  // found in the baseline, nowhere in the snapshot
  gone: boolean;
  // an ignore rule takes every element it found
  overridden: boolean;
}

/** What a variable-text rule leaves out for one element it found, on one side (spec 066). */
export interface LeftOut {
  side: "current" | "baseline";
  // the element the rule found
  element: Rect;
  // what is not compared: its text parts, or the element itself
  areas: Rect[];
  // set when the whole element is left out, and why (REQ-066-06, REQ-071-10)
  reason?:
    | "own-text"
    | "resized"
    | "unpaired"
    | "not-found-current"
    | "not-found-baseline"
    | "timeout";
  // the first marked value not found on a screenshot, with not-found-*
  missing?: string;
  // the areas are the marked pieces found on the pixels (spec 071)
  located?: boolean;
}

export interface VariableTextProblem {
  ruleId: string;
  kind: "failed" | "gone";
  element: string;
  text?: string;
  reason?: VariableTextReason;
  bounds: Rect;
  // the text as it was when the check was made, filled in for showing (REQ-033-34)
  expected?: string;
}

export interface ElementRule {
  id: string;
  selector: string;
  // compare: only the elements such rules match are compared on this screen
  action: ElementRuleAction;
  maxDiffPercent?: number;
  // variable: the text as fixed parts and places with a pattern
  parts?: TextPart[];
  note?: string;
}

export interface UiTreeSettings {
  excludeSystemBars: boolean;
  compensateMoves: boolean;
  detectSemanticChanges: boolean;
  elementRules: ElementRule[];
  // where the screen's title is in the UI tree, first match wins; not on the
  // settings page since 026, but kept so a save does not erase it
  screenTitle?: string[];
  // what the team agreed an accessible screen is (026)
  a11yNorms?: Partial<A11yNorms>;
  // which settings the page shows; missing is mobile (050)
  platform?: ProjectPlatform;
  allowedBrowsers?: AllowedBrowser[];
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
  // minimum tap area: dp on Android, pt on iOS, CSS px on the web
  touchTargetAndroid: number;
  touchTargetIos: number;
  touchTargetWeb: number;
  // minimum contrast ratio for body text and for large text
  contrast: number;
  contrastLarge: number;
  disabledRules: A11yRule[];
}

export const DEFAULT_A11Y_NORMS: A11yNorms = {
  touchTargetAndroid: 48,
  touchTargetIos: 44,
  // WCAG 2.2, 2.5.8
  touchTargetWeb: 24,
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
  touchTargetWeb: { min: 24, max: 96, integer: true },
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

export const DEFAULT_UI_TREE_SETTINGS: UiTreeSettings = {
  excludeSystemBars: true,
  compensateMoves: false,
  detectSemanticChanges: true,
  elementRules: [],
};

export interface StructureInfo {
  // variable texts that did not hold (spec 033); absent from older servers
  variableProblems?: VariableTextProblem[];
  hasUiTree: boolean;
  hasBaselineUiTree: boolean;
  // the current tree's format, and whether it came with element positions:
  // a plain web page source has none (050); absent from older servers
  treeFormat?: UiTreeFormat | null;
  positioned?: boolean;
  changes: StructuralChange[];
  regions: Array<{
    region: Rect;
    key: string | null;
    element: string | null;
    resourceId: string | null;
  }>;
  hints: NoiseHint[];
  invisible: StructuralChange[];
  rules: ScreenRule[];
  // what is compared when the check names its elements (spec 015)
  compareOnly?: {
    active: boolean;
    keep: Rect[];
    problems: CompareOnlyProblem[];
    // each element a compare-only rule found (spec 030)
    compared?: ComparedElement[];
  };
  ignoredAreas: Rect[];
  toleratedAreas: Array<Rect & { maxDiffPercent: number }>;
  systemBars: Rect[];
  // who left the system bars out
  systemBarsFrom?: "test" | "project" | null;
  // of the checkpoint picture
  size?: { width: number; height: number };
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
  // a variable-text rule: how its texts fared (spec 033)
  check?: VariableCheck;
  // a variable-text rule: what of each element it found is not compared (spec 066)
  leftOut?: LeftOut[];
  // saved with a pattern Vision no longer runs: it finds nothing (051)
  problem?: "pattern";
};

export interface ComparedElement {
  ruleId: string;
  element: string;
  bounds: Rect;
  // how far it moved from its place in the baseline
  shiftDp?: { dx: number; dy: number };
}

export type CompareOnlyProblem =
  | { kind: "no-tree" }
  // compared at the element's place in the one tree there is (spec 030)
  | { kind: "one-tree"; missing: "baseline" | "current" }
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
  // no id or text of its own: found by a path from a stable element (spec 027)
  nameless?: boolean;
  variants?: SelectorVariant[];
  // its text or label, to mark the part that changes (spec 033)
  text?: string;
  // a text without an id: a path down from the nearest id (REQ-033-27)
  stableSelector?: string;
  // its text is only a label: the text shown may sit inside it (REQ-066-08)
  labelOnly?: boolean;
}

/** A way to find a nameless element: down from a stable ancestor or up from a stable descendant. */
export interface SelectorVariant {
  selector: string;
  direction: "down" | "up";
  // the stable element: its id without the package, or its text
  anchor: string;
  anchorKind: "id" | "text";
  // found by the start of its text, which anchor then is in full (spec 061)
  anchorMatch?: "start";
  // how many levels apart the element and the anchor are: 1 is a child or a parent
  levels?: number;
  // how many elements the selector takes on this screenshot
  count: number;
}

// why a selector cannot be used; the rule form says it in the person's language
export type SelectorProblem =
  | "prefix"
  | "syntax"
  | "anchor"
  | "attribute"
  | "axis"
  | "function"
  | "or"
  | "mixed"
  // a text pattern with a back-reference or look-around: Vision does not run those (051)
  | "pattern";

export interface SelectorMatches {
  current: number;
  baseline: number;
  problem: SelectorProblem | null;
}

export interface DeviceProfile {
  os: string;
  device: string;
  browser: string;
  viewport: string;
}

/** A run of a check, enough to open its comparison from Insights. */
export interface InsightsRun {
  id: string;
  buildId: string;
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
    // field by field, for the tags (spec 037); absent from an older server
    profile?: DeviceProfile;
    hasBaseline: boolean;
    lastUsedAt: string;
    idleDays: number;
  }>;
  unstable: Array<{
    name: string;
    customTags: string;
    devices: string[];
    profiles?: DeviceProfile[];
    runs: number;
    changedPercent: number;
    rejected: number;
    flips: number;
    baselineChanges: number;
    lastChangeAt: string | null;
    // the comparison a click opens: the newest change; absent from an older server
    run?: InsightsRun;
  }>;
  a11yScreens: Array<{
    name: string;
    customTags: string;
    issues: number;
    newIssues: number;
    reported: number;
    ignored: number;
    // the newest run of the device with the most issues; absent from an older server
    run?: InsightsRun;
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
    hidden: number;
    runs: number;
  }>;
  coverage: Array<{
    device: string;
    profile?: DeviceProfile;
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
  // severity and customer are found by name; a bug from the comparison treats them apart
  role?: "severity" | "customer";
  value?: unknown;
  display?: string;
}

export interface JiraUser {
  accountId?: string;
  name?: string;
  key?: string;
  displayName?: string;
}

/** What the bug-from-comparison dialog shows and fills in (025). */
export interface VisualBugPreparation {
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
  feature: string;
  // "[Automation] [feature]": Vision puts it before the essence
  prefix: string;
  environment: string;
  hasBaseline: boolean;
  inputs: JiraBugInput[];
  filled: Array<{ field: string; value: string; source: "task" | "vision" }>;
  missing: string[];
}

export interface VisualBugMark {
  n: number;
  x: number;
  y: number;
  width: number;
  height: number;
  element?: string;
}

export interface VisualBugFiling {
  parentKey: string;
  issueTypeId?: string;
  linkType?: string;
  fieldValues?: Record<string, unknown>;
  essence: string;
  environment: string;
  steps: string;
  actual: string;
  expected: string;
  marks: Array<Omit<VisualBugMark, "n">>;
}

export interface VisualBugResult {
  jiraKey: string;
  jiraUrl: string | null;
  summary: string;
  warnings: string[];
}

/** A bug filed from the comparison for this check, on any device or build. */
export interface VisualBug {
  id: string;
  jiraKey: string;
  jiraUrl: string | null;
  summary: string;
  marks: VisualBugMark[];
  // marks are in the pixels of the device the bug was filed from
  sameDevice: boolean;
  testRunId: string;
  createdAt: string;
}

export interface BugDraft {
  essence: string;
  steps: string;
  actual: string;
  expected: string;
  cached: boolean;
}

/** A node of a check's UI tree as the Elements tab shows it (062). */
export interface InspectorNode {
  index: number;
  parent: number | null;
  // matches the node on the other tree, and the changes and findings about it
  key: string;
  className: string;
  // the class without its package, the iOS type without XCUIElementType, the tag on the web
  name: string;
  // the id without the app's package
  id: string;
  text: string;
  // named as the platform's page source names them
  attributes: Array<[string, string]>;
  clickable: boolean;
  // only lays the others out: no id, text, label or hint, no action, with children (063)
  wrapper: boolean;
  // how a rule finds it; absent without an id or a text
  selector?: string;
  // on the screenshot, in its pixels; null when it cannot be shown there
  bounds: Rect | null;
  hidden?: "unpositioned" | "invisible" | "empty";
}

export interface InspectorTree {
  format: UiTreeFormat;
  positioned: boolean;
  width: number;
  height: number;
  nodes: InspectorNode[];
}

export interface Locator {
  kind: string;
  value: string;
  // how many nodes of the tree it finds
  matches: number;
}

/** How to find a node: Vision's selectors for rules and locators for tests (REQ-062-23). */
export interface NodeLocators {
  vision: Locator[];
  test: Locator[];
}

export type TreeSide = "current" | "baseline";
