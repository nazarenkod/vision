import type { A11yReport, StructureInfo } from "../types/insights";

export type DiffMeter = {
  /** 0–100: how far along the bar the diff reaches */
  fill: number;
  /** 0–100: where the tolerance mark stands */
  mark: number;
  over: boolean;
};

/**
 * The diff and the tolerance on one bar (REQ-018-31). The bar runs to twice the
 * tolerance, or a bit past the diff when that is bigger, so the mark never sits
 * at an edge and a big overshoot still looks big.
 */
export function diffMeter(
  diffPercent: number,
  tolerancePercent: number,
): DiffMeter {
  const diff = Math.max(0, diffPercent || 0);
  const tolerance = Math.max(0, tolerancePercent || 0);
  const end = Math.max(tolerance * 2, diff * 1.25, 0.1);
  const share = (value: number) => Math.min(100, (value / end) * 100);
  return { fill: share(diff), mark: share(tolerance), over: diff > tolerance };
}

/** Keys of the review; X has always rejected, so hints show it, not R. */
export const REVIEW_KEYS = { approve: "A", reject: "X" } as const;

/**
 * The side panel starts folded when it would have nothing to say: no changed
 * areas, no structural changes and no accessibility findings (REQ-046-07).
 * Undefined while either is still loading, so the panel does not jump.
 */
export const panelStartsFolded = (
  structure:
    Pick<StructureInfo, "regions" | "changes" | "invisible"> | null | undefined,
  report: Pick<A11yReport, "violations"> | null | undefined,
): boolean | undefined => {
  if (structure === undefined || report === undefined) return undefined;
  const changes =
    !!structure &&
    (structure.regions.length > 0 ||
      structure.changes.length > 0 ||
      structure.invisible.length > 0);
  const findings = !!report && report.violations.length > 0;
  return !changes && !findings;
};
