import React from "react";
import { Box } from "@mui/material";
import { tokens, type } from "../../theme";
import { useT } from "../../i18n";

/**
 * Where the review is: "N of M", in a queue "N of M in <queue>" (REQ-046-19).
 * No counts of decided and left: beside the position they read as a second
 * progress the reviewer had to reconcile with it; the check's trend follows.
 */
export const StepProgress: React.FunctionComponent<{
  statuses: string[];
  currentIndex: number;
  /** the queue's name, with its menu, after "in" (REQ-031-24) */
  queue?: React.ReactNode;
}> = ({ statuses, currentIndex, queue }) => {
  const { t } = useT();
  // a review opened before its list has loaded is one step long
  const total = Math.max(statuses.length, 1);
  return (
    <Box
      data-testid="stepProgress"
      sx={{
        display: "flex",
        alignItems: "center",
        minWidth: 0,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        component="span"
        data-testid="stepPosition"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          fontSize: type.small,
          color: tokens.textSecondary,
        }}
      >
        <Box
          component="b"
          data-testid={queue ? "queuePosition" : undefined}
          sx={{
            color: tokens.text,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {t("compare.position", {
            current: Math.min(currentIndex + 1, total),
            total,
          })}
        </Box>
        {queue && (
          <>
            {/* spaced for the text too, not only by the gap */}
            {` ${t("compare.inQueue")} `}
            {queue}
          </>
        )}
      </Box>
    </Box>
  );
};
