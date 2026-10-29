import React from "react";
import { Box, Typography } from "@mui/material";
import { diffMeter } from "../../_helpers/review.helper";
import { motion, tokens } from "../../theme";
import { Tooltip } from "../Tooltip";

/** The diff against the tolerance on one bar (REQ-018-31). */
export const DiffMeter: React.FunctionComponent<{
  diffPercent: number;
  tolerancePercent: number;
}> = ({ diffPercent, tolerancePercent }) => {
  const meter = diffMeter(diffPercent, tolerancePercent);
  const diff = Math.round(diffPercent * 100) / 100;
  return (
    <Tooltip
      title={`${diff}% of pixels differ; the tolerance is ${tolerancePercent}% (diffTollerancePercent in the track call)`}
    >
      <Box
        data-testid="diffMeter"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          whiteSpace: "nowrap",
        }}
      >
        <Typography variant="caption" sx={{ color: tokens.textSecondary }}>
          Diff
        </Typography>
        <Typography
          variant="caption"
          data-testid="diffValue"
          sx={{
            fontFamily: tokens.mono,
            fontWeight: 600,
            color: meter.over ? tokens.diff : tokens.text,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {diff}%
        </Typography>
        <Box
          aria-hidden="true"
          sx={{
            position: "relative",
            width: 64,
            height: 6,
            borderRadius: 3,
            bgcolor: tokens.subtle,
            boxShadow: `inset 0 0 0 1px ${tokens.border}`,
          }}
        >
          <Box
            data-testid="diffFill"
            style={{ width: `${meter.fill}%` }}
            sx={{
              position: "absolute",
              inset: "0 auto 0 0",
              borderRadius: 3,
              bgcolor: meter.over ? tokens.diff : tokens.textMuted,
              transformOrigin: "left",
              animation: `v-fill ${motion.slow * 2}ms ${motion.easing} both`,
            }}
          />
          <Box
            data-testid="toleranceMark"
            style={{ left: `${meter.mark}%` }}
            sx={{
              position: "absolute",
              top: -4,
              bottom: -4,
              width: 2,
              ml: "-1px",
              borderRadius: 1,
              bgcolor: tokens.text,
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ color: tokens.textMuted }}>
          tol. {tolerancePercent}%
        </Typography>
      </Box>
    </Tooltip>
  );
};
