import React from "react";
import { Box, Typography } from "@mui/material";
import {
  CheckRounded,
  DifferenceOutlined,
  ErrorOutlineRounded,
  HourglassEmptyRounded,
} from "@mui/icons-material";
import { Verdict } from "../../_helpers/whatsCompared.helper";
import { tokens } from "../../theme";

/**
 * What came out of the comparison and why, first in the Changes tab
 * (REQ-030-01…04). The count lives in the title alone, so the badge is an icon
 * (REQ-036-01), and a reason shows only when there is something to explain.
 */
export const ComparisonVerdict: React.FunctionComponent<{
  verdict: Verdict;
  changes: number;
}> = ({ verdict, changes }) => {
  const status = tokens.status[verdict.tone];
  const badge =
    verdict.tone === "passed" ? (
      <CheckRounded sx={{ fontSize: 20 }} />
    ) : verdict.tone === "failed" ? (
      <ErrorOutlineRounded sx={{ fontSize: 20 }} />
    ) : changes ? (
      <DifferenceOutlined sx={{ fontSize: 19 }} />
    ) : (
      <HourglassEmptyRounded sx={{ fontSize: 19 }} />
    );
  return (
    <Box
      component="section"
      data-testid="comparisonVerdict"
      data-tone={verdict.tone}
      sx={{
        display: "flex",
        gap: 1.5,
        alignItems: verdict.reason ? "flex-start" : "center",
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: "10px",
          bgcolor: status.bg,
          color: status.fg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {badge}
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 0.25,
          minWidth: 0,
        }}
      >
        <Typography
          component="h3"
          data-testid="verdictTitle"
          sx={{ fontSize: 17, fontWeight: 650, lineHeight: 1.3 }}
        >
          {verdict.title}
        </Typography>
        {verdict.reason && (
          <Typography
            data-testid="verdictReason"
            sx={{
              fontSize: 13.5,
              color: tokens.textSecondary,
              lineHeight: 1.45,
            }}
          >
            {verdict.reason}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
