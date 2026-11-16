import { english, Text } from "../i18n";

/** How long a decision can be taken back from its notification (REQ-018-70). */
export const UNDO_OFFER_MS = 8000;

export type DecisionKind = "approve" | "reject";

/** What the notification says about a decision. */
export function decisionNotice(
  kind: DecisionKind,
  count: number,
  text: Text = english,
): string {
  if (count > 1) {
    return text(
      kind === "approve" ? "undo.approvedMany" : "undo.rejectedMany",
      {
        count,
      },
    );
  }
  return text(kind === "approve" ? "undo.approved" : "undo.rejected");
}

/** Notification options for a decision: long enough to change one's mind. */
export const decisionSnackOptions = (kind: DecisionKind) => ({
  // a rejection is not a success: the two buttons sit together and get
  // pressed in a hurry, and green read as an approval at a glance
  variant: kind === "approve" ? ("success" as const) : ("info" as const),
  autoHideDuration: UNDO_OFFER_MS,
});
