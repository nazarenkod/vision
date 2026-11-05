import React from "react";
import { Box } from "@mui/material";
import { tokens, type, radius } from "../../theme";
import { english, Text } from "../../i18n";
import { Outcome } from "../../types/buildOverview";
import { Tooltip } from "../Tooltip";

// the parts of a bar in the order they are drawn, each with its colour
const PARTS = [
  ["changed", "result.changed", "result.legendChanged"],
  ["new", "result.new", "result.legendNew"],
  ["rejected", "result.rejected", "result.legendRejected"],
  ["passed", "result.passed", "result.legendPassed"],
] as const;

const colorOf = {
  changed: tokens.status.changed.bar,
  new: tokens.status.new.bar,
  rejected: tokens.status.failed.bar,
  passed: tokens.status.passed.bar,
};

/** "2 changed · 1 new": what the bar shows, the parts that are there. */
export function outcomeText(outcome: Outcome, text: Text = english): string {
  return PARTS.filter(([part]) => outcome[part] > 0)
    .map(([part, key]) => text(key, { count: outcome[part] }))
    .join(" · ");
}

/**
 * How screenshots came out, as one bar: changed, new, rejected, passed. The
 * colours alone said nothing to someone new, so the numbers are in its label
 * and, where `hint` is on, in a tooltip.
 */
export const ResultBar: React.FunctionComponent<{
  outcome: Outcome;
  text?: Text;
  hint?: boolean;
}> = ({ outcome, text = english, hint }) => {
  const label = outcomeText(outcome, text);
  const bar = (
    <Box
      role="img"
      aria-label={label}
      data-testid="resultBar"
      sx={{
        display: "flex",
        height: 6,
        gap: "2px",
        borderRadius: radius.pill,
        overflow: "hidden",
        bgcolor: tokens.subtle,
      }}
    >
      {PARTS.filter(([part]) => outcome[part] > 0).map(([part]) => (
        <Box key={part} sx={{ flex: outcome[part], bgcolor: colorOf[part] }} />
      ))}
    </Box>
  );
  // the tooltip needs a box taller than the 6px bar to be found by the pointer
  return hint ? (
    <Tooltip title={label}>
      <Box sx={{ py: 1, my: -1 }}>{bar}</Box>
    </Tooltip>
  ) : (
    bar
  );
};

/** What the colours of the bars mean, for paper and readers new to Vision. */
export const ResultLegend: React.FunctionComponent<{ text?: Text }> = ({
  text = english,
}) => (
  <Box
    data-testid="resultLegend"
    sx={{
      display: "flex",
      flexWrap: "wrap",
      gap: "4px 14px",
      fontSize: type.caption,
      color: tokens.textSecondary,
    }}
  >
    {PARTS.map(([part, , legend]) => (
      <Box
        key={part}
        component="span"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
      >
        <Box
          component="span"
          sx={{
            width: 10,
            height: 6,
            borderRadius: radius.pill,
            bgcolor: colorOf[part],
            // printed without backgrounds the swatch would vanish
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
          }}
        />
        {text(legend)}
      </Box>
    ))}
  </Box>
);
