import React from "react";
import { Box } from "@mui/material";
import { tokens } from "../../theme";
import { Outcome } from "../../types/buildOverview";

/** How screenshots came out, as one bar: changed, new, rejected, passed. */
export const ResultBar: React.FunctionComponent<{ outcome: Outcome }> = ({
  outcome,
}) => (
  <Box
    role="img"
    aria-label={`${outcome.changed} / ${outcome.new} / ${outcome.rejected} / ${outcome.passed}`}
    sx={{
      display: "flex",
      height: 6,
      gap: "2px",
      borderRadius: 999,
      overflow: "hidden",
      bgcolor: tokens.subtle,
    }}
  >
    {(
      [
        [outcome.changed, tokens.status.changed.bar],
        [outcome.new, tokens.status.new.bar],
        [outcome.rejected, tokens.status.failed.bar],
        [outcome.passed, tokens.status.passed.bar],
      ] as const
    )
      .filter(([value]) => value > 0)
      .map(([value, color], i) => (
        <Box key={i} sx={{ flex: value, bgcolor: color }} />
      ))}
  </Box>
);
