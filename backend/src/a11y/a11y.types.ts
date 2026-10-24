import { Rect, UiTreeFormat } from '../ui-tree/ui-tree.types';

export type A11yRule =
  | 'missing-label'
  | 'touch-target'
  | 'duplicate-label'
  | 'low-contrast'
  | 'input-without-label'
  | 'redundant-role'
  | 'not-accessible';

export type A11ySeverity = 'error' | 'warning' | 'info';

export interface A11yViolation {
  // rule + element identity: stable between builds, used to tell new issues from existing ones
  id: string;
  rule: A11yRule;
  severity: A11ySeverity;
  title: string;
  message: string;
  nodeKey: string;
  resourceId: string;
  className: string;
  // what a screen reader would announce, if anything
  label: string;
  bounds: Rect;
  // rule-specific numbers (contrast ratio, size in dp, …) for the UI and for AI prompts
  details?: Record<string, number | string | boolean>;
}

export type A11yStatus = 'new' | 'existing';

export interface A11yReport {
  version: 1;
  format: UiTreeFormat;
  pixelsPerDp: number;
  pixelsPerDpEstimated: boolean;
  // false when the baseline had no UI tree: every issue then counts as new
  baselineChecked: boolean;
  summary: { new: number; existing: number; fixed: number; total: number };
  violations: Array<A11yViolation & { status: A11yStatus }>;
  fixed: A11yViolation[];
}

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
}
