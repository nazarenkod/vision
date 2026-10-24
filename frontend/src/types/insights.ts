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
  kind: "text" | "label" | "added" | "removed" | "resized" | "moved";
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
}

export interface ChangeGroup {
  id: string;
  kind: "structural" | "visual" | "new";
  title: string;
  screens: string[];
  testRuns: import("./testRun").TestRun[];
  changes: StructuralChange[];
  noise: NoiseHint | null;
  fingerprint: string;
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
