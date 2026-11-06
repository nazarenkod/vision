import type { A11yReport, StructureInfo } from "../types/insights";

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
