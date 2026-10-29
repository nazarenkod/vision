/** How long a decision can be taken back from its notification (REQ-018-70). */
export const UNDO_OFFER_MS = 8000;

export type DecisionKind = "approve" | "reject";

/** What the notification says about a decision. */
export function decisionNotice(kind: DecisionKind, count: number): string {
  const verb = kind === "approve" ? "Approved" : "Rejected";
  return count > 1 ? `${verb} ${count} screenshots` : verb;
}

/** Notification options for a decision: long enough to change one's mind. */
export const decisionSnackOptions = (kind: DecisionKind) => ({
  // a rejection is not a success: the two buttons sit together and get
  // pressed in a hurry, and green read as an approval at a glance
  variant: kind === "approve" ? ("success" as const) : ("info" as const),
  autoHideDuration: UNDO_OFFER_MS,
});
