// Mirrors GET /builds/:id/overview and the public report (031).

export type Verdict = "running" | "waiting" | "reviewed" | "passed";

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
  // the screenshot's size in pixels, "1080×2400"; empty when unknown
  screen: string;
  a11yNew: number;
}

export interface FeatureRow extends Outcome {
  name: string;
  bugs: number;
}

export interface OverviewBug {
  kind: "visual" | "a11y";
  jiraKey: string;
  jiraUrl: string | null;
  summary: string;
  testRunId: string;
  isNew: boolean;
}

export interface BuildOverview {
  verdict: Verdict;
  counts: Outcome & { waiting: number; a11yNew: number; bugs: number };
  progress: {
    decided: number;
    needed: number;
    people: Array<{ name: string | null; approved: number; rejected: number }>;
  };
  devices: DeviceRow[];
  features: FeatureRow[];
  quietFeatures: { count: number; screens: number; features: FeatureRow[] };
  bugs: OverviewBug[];
  previous: {
    number: number;
    changed: number;
    added: number;
    gone: number;
  } | null;
  build: {
    id: string;
    number: number | null;
    branchName: string | null;
    ciBuildId: string | null;
    projectId: string;
    projectName: string;
    createdAt: string;
    updatedAt: string;
  };
  // the time of the state shown
  asOf: string;
}

export type ReportSection = "sum" | "chg" | "bugs" | "dev" | "feat" | "a11y";
export const SHORT_SECTIONS: ReportSection[] = ["sum", "chg", "bugs"];
export const ALL_SECTIONS: ReportSection[] = [
  "sum",
  "chg",
  "bugs",
  "dev",
  "feat",
  "a11y",
];

/** A screenshot the report shows: baseline and checkpoint with the differences marked. */
export interface ReportChange {
  testRunId: string;
  name: string;
  device: string;
  os: string;
  status: string;
  diffPercent: number | null;
  imageName: string;
  baselineName: string | null;
  diffName: string | null;
}

export interface ReportA11yRow {
  testRunId: string;
  name: string;
  device: string;
  newCount: number;
}

export interface ReportLink {
  id: string;
  token: string;
  sections: ReportSection[];
  language: "en" | "uk";
  createdBy: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface PublicReport {
  state: "ok" | "expired" | "gone";
  overview?: BuildOverview;
  changes?: ReportChange[];
  moreChanges?: number;
  a11y?: ReportA11yRow[];
  sections?: ReportSection[];
  language?: "en" | "uk";
  createdBy?: string | null;
}
