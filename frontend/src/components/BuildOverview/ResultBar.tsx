import React from "react";
import { Box } from "@mui/material";
import { tokens, type, radius } from "../../theme";
import { english, Text } from "../../i18n";
import {
  OUTCOME_PARTS as PARTS,
  outcomeText,
} from "../../_helpers/resultWords.helper";
import { Outcome } from "../../types/buildOverview";
import { Tooltip } from "../Tooltip";

const colorOf = {
  changed: tokens.status.changed.bar,
  new: tokens.status.new.bar,
  rejected: tokens.status.failed.bar,
  passed: tokens.status.passed.bar,
};

/**
 * How screenshots came out, as one bar: changed, new, rejected, passed. The
 * colours alone said nothing to someone new, so the numbers are in its label
 * and, where `hint` is on, in a tooltip.
 */
export const ResultBar: React.FunctionComponent<{
  outcome: Outcome;
  text?: Text;
  hint?: boolean;
  // a short bar of a fixed width with its words beside it, so the bars line up (046)
  words?: boolean;
}> = ({ outcome, text = english, hint, words }) => {
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
        ...(words && { width: 48, flex: "none" }),
      }}
    >
      {PARTS.filter(([part]) => outcome[part] > 0).map(([part]) => (
        <Box key={part} sx={{ flex: outcome[part], bgcolor: colorOf[part] }} />
      ))}
    </Box>
  );
  if (words) {
    const shown = (
      <Box
        data-testid="resultWithWords"
        sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
      >
        {bar}
        <Box
          component="span"
          data-testid="resultWords"
          // the bar already says it to a screen reader
          aria-hidden
          sx={{
            fontSize: type.small,
            color: tokens.textSecondary,
            // a result of two parts («1 змінений · 1 без змін») goes onto a
            // second line rather than behind an ellipsis
            lineHeight: 1.3,
            minWidth: 0,
          }}
        >
          {label.split(" · ").map((part, index) => (
            // each part stays whole; the line breaks only between them
            <React.Fragment key={index}>
              {/* the space outside the unbreakable part is where a line may end */}
              {index > 0 && " "}
              <Box component="span" sx={{ whiteSpace: "nowrap" }}>
                {index > 0 && "· "}
                {part}
              </Box>
            </React.Fragment>
          ))}
        </Box>
      </Box>
    );
    // the words are also named on hover, as the bar alone is
    return hint ? <Tooltip title={label}>{shown}</Tooltip> : shown;
  }
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
