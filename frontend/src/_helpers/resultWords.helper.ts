import { english, Text } from "../i18n";
import { Outcome } from "../types/buildOverview";

export type OutcomePart = "changed" | "new" | "rejected" | "passed";

// the parts of a result in the order the bar draws them, with their words and legend
export const OUTCOME_PARTS = [
  ["changed", "result.changed", "result.legendChanged"],
  ["new", "result.new", "result.legendNew"],
  ["rejected", "result.rejected", "result.legendRejected"],
  ["passed", "result.passed", "result.legendPassed"],
] as const;

/**
 * "2 changed · 1 new": what a result bar shows, in words, only the parts that
 * are there. The same words go next to the bar on the Overview (046) and in
 * its tooltip (031), so the two never disagree.
 */
export function outcomeText(outcome: Outcome, text: Text = english): string {
  return OUTCOME_PARTS.filter(([part]) => outcome[part] > 0)
    .map(([part, key]) => text(key, { count: outcome[part] }))
    .join(" · ");
}
