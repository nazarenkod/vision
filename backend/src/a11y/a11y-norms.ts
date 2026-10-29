import { A11yReport, A11yRule, A11yViolation } from './a11y.types';
import { UiTreeFormat } from '../ui-tree/ui-tree.types';

export const A11Y_RULES: A11yRule[] = [
  'touch-target',
  'low-contrast',
  'missing-label',
  'input-without-label',
  'duplicate-label',
  'not-accessible',
  'redundant-role',
];

/** What the project's team agreed an accessible screen is (026). */
export interface A11yNorms {
  // minimum tap area, dp on Android and pt on iOS
  touchTargetAndroid: number;
  touchTargetIos: number;
  // minimum contrast ratio, for body text and for large text
  contrast: number;
  contrastLarge: number;
  disabledRules: A11yRule[];
}

// 48 dp (Material, ATF), 44 pt (HIG), WCAG AA 4.5 : 1 and 3 : 1
export const DEFAULT_A11Y_NORMS: A11yNorms = {
  touchTargetAndroid: 48,
  touchTargetIos: 44,
  contrast: 4.5,
  contrastLarge: 3,
  disabledRules: [],
};

export const A11Y_NORM_LIMITS = {
  touchTarget: { min: 24, max: 96 },
  contrast: { min: 1.5, max: 7 },
};

const within = (value: unknown, limits: { min: number; max: number }, fallback: number, integer = false): number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= limits.min &&
  value <= limits.max &&
  (!integer || Number.isInteger(value))
    ? value
    : fallback;

/**
 * The project's norms from its saved settings. A value out of range reads as
 * the default, so a broken setting never turns a check off.
 */
export function parseA11yNorms(raw: unknown): A11yNorms {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_A11Y_NORMS;
  const { touchTarget, contrast } = A11Y_NORM_LIMITS;
  return {
    touchTargetAndroid: within(value.touchTargetAndroid, touchTarget, d.touchTargetAndroid, true),
    touchTargetIos: within(value.touchTargetIos, touchTarget, d.touchTargetIos, true),
    contrast: within(value.contrast, contrast, d.contrast),
    contrastLarge: within(value.contrastLarge, contrast, d.contrastLarge),
    disabledRules: Array.isArray(value.disabledRules)
      ? A11Y_RULES.filter((rule) => (value.disabledRules as unknown[]).includes(rule))
      : [],
  };
}

export const touchTargetOf = (norms: A11yNorms, format: UiTreeFormat): number =>
  format === 'appium-ios' ? norms.touchTargetIos : norms.touchTargetAndroid;

export const unitOf = (format: UiTreeFormat): string => (format === 'appium-ios' ? 'pt' : 'dp');

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * The issue as the current norms see it: null when it passes them, else the
 * issue with the norm it fails in its details and message. Reports keep what
 * was found at ingest, so a looser norm hides issues of snapshots received
 * before it; a stricter one only shows on new snapshots, the old tree is not
 * checked again.
 */
function underNorms<T extends A11yViolation>(violation: T, norms: A11yNorms, format: UiTreeFormat): T | null {
  if (norms.disabledRules.includes(violation.rule)) return null;
  const details = violation.details ?? {};
  if (violation.rule === 'touch-target') {
    const width = num(details.widthDp);
    const height = num(details.heightDp);
    if (width === null || height === null) return violation;
    const min = touchTargetOf(norms, format);
    // half a unit of slack for rounding in bounds and density, as at ingest
    if (width >= min - 0.5 && height >= min - 0.5) return null;
    const unit = unitOf(format);
    return {
      ...violation,
      message: violation.message.replace(/minimum is [\d.]+ × [\d.]+ \w+/, `minimum is ${min} × ${min} ${unit}`),
      details: { ...details, min, unit },
    };
  }
  if (violation.rule === 'low-contrast') {
    const ratio = num(details.ratio);
    if (ratio === null) return violation;
    // reports from before 026 do not say whether the text was large
    const large = typeof details.large === 'boolean' ? details.large : (num(details.required) ?? 4.5) < 4.5;
    const required = large ? norms.contrastLarge : norms.contrast;
    if (ratio >= required) return null;
    return {
      ...violation,
      message: violation.message.replace(/needs [\d.]+ : 1/, `needs ${required} : 1`),
      details: { ...details, required, large },
    };
  }
  return violation;
}

/** Counts of a report: advice (severity info) is listed but never counted. */
export function summarize(
  violations: Array<A11yViolation & { status: 'new' | 'existing' }>,
  fixed: A11yViolation[]
): A11yReport['summary'] {
  const counted = violations.filter((v) => v.severity !== 'info');
  const newCount = counted.filter((v) => v.status === 'new').length;
  return {
    new: newCount,
    existing: counted.length - newCount,
    fixed: fixed.filter((v) => v.severity !== 'info').length,
    total: counted.length,
  };
}

/** A stored report as the project's current norms see it, everywhere it is shown or counted. */
export function applyNorms(report: A11yReport, norms: A11yNorms): A11yReport {
  const keep = <T extends A11yViolation>(list: T[]) =>
    list.map((v) => underNorms(v, norms, report.format)).filter((v): v is T => v !== null);
  const violations = keep(report.violations);
  const fixed = keep(report.fixed);
  return { ...report, violations, fixed, summary: summarize(violations, fixed) };
}
