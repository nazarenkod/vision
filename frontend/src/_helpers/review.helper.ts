import { TestStatus } from "../types/testStatus";

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

/** Keys of the review; X has rejected since VRT, so hints show it, not R. */
export const REVIEW_KEYS = { approve: "A", reject: "X" } as const;
