import { TestStatus } from "../types/testStatus";
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

export type StepState = "current" | "approved" | "rejected" | "waiting";

const APPROVED: string[] = [
  TestStatus.approved,
  TestStatus.autoApproved,
  TestStatus.ok,
];

/** One dot per step of the review (REQ-018-32). */
export const stepStates = (
  statuses: string[],
  currentIndex: number,
): StepState[] =>
  statuses.map((status, index) =>
    index === currentIndex
      ? "current"
      : APPROVED.includes(status)
        ? "approved"
        : status === TestStatus.failed
          ? "rejected"
          : "waiting",
  );

/** Keys of the review; X has always rejected, so hints show it, not R. */
export const REVIEW_KEYS = { approve: "A", reject: "X" } as const;

const decided = (status: string | undefined) =>
  !!status && (APPROVED.includes(status) || status === TestStatus.failed);

/**
 * How far the review has got, beside "N of M" (REQ-046-05): the steps already
 * decided, the current one among them when it is, and those still ahead of
 * the reviewer besides the one on screen.
 */
export const stepProgress = (
  statuses: string[],
  currentIndex: number,
): { decided: number; left: number } => {
  const count = statuses.filter(decided).length;
  const currentOpen =
    currentIndex < statuses.length && !decided(statuses[currentIndex]);
  return {
    decided: count,
    left: statuses.length - count - (currentOpen ? 1 : 0),
  };
};

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
