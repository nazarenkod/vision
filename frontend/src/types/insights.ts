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
  status: "reported" | "ignored";
  jiraKey?: string | null;
  jiraUrl?: string | null;
  comment?: string | null;
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
  fixed: Omit<A11yViolation, "status" | "issue">[];
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
}

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
