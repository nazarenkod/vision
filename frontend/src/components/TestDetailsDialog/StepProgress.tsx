import React from "react";
import { Box } from "@mui/material";
import {
  StepState,
  stepProgress,
  stepStates,
} from "../../_helpers/review.helper";
import { motion, tokens, type, radius } from "../../theme";
import { useT } from "../../i18n";

const COLOUR: Record<StepState, string> = {
  approved: tokens.status.passed.bar,
  rejected: tokens.status.failed.bar,
  current: tokens.text,
  waiting: tokens.border,
};

const SEGMENT = 28;
const GAP = 3;
// past this width the segments share it, so a long review still fits the header
const MAX_WIDTH = 180;

/**
 * Where the review is: "N of M" (in a queue, "N of M in <queue>"), a bar with
 * one segment per step, and how many are decided and left (REQ-046-05).
 */
export const StepProgress: React.FunctionComponent<{
  statuses: string[];
  currentIndex: number;
  /** the queue's name, with its menu, after "in" (REQ-031-24) */
  queue?: React.ReactNode;
}> = ({ statuses, currentIndex, queue }) => {
  const { t } = useT();
  // a review opened before its list has loaded is one step long
  const steps = statuses.length ? statuses : ["unresolved"];
  const states = stepStates(steps, currentIndex);
  const { decided, left } = stepProgress(steps, currentIndex);
  const squeezed = states.length * (SEGMENT + GAP) > MAX_WIDTH;
  return (
    <Box
      data-testid="stepProgress"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
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
            current: Math.min(currentIndex + 1, steps.length),
            total: steps.length,
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
      <Box
        data-testid="stepDots"
        role="img"
        aria-label={t("compare.stepsLabel", {
          approved: states.filter((s) => s === "approved").length,
          rejected: states.filter((s) => s === "rejected").length,
          waiting: states.filter((s) => s === "waiting").length,
        })}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: squeezed ? "1px" : `${GAP}px`,
          width: squeezed ? MAX_WIDTH : "auto",
          flexShrink: 0,
        }}
      >
        {states.map((state, index) => (
          <Box
            key={index}
            data-state={state}
            sx={{
              flex: squeezed ? 1 : "none",
              width: squeezed ? "auto" : SEGMENT,
              // a string: the number 1 would be read as 100 %
              minWidth: "1px",
              height: 6,
              borderRadius: radius.control,
              bgcolor: COLOUR[state],
              transition: `background-color ${motion.base}ms ${motion.easing}`,
            }}
          />
        ))}
      </Box>
      <Box
        component="span"
        data-testid="stepCounts"
        sx={{ fontSize: type.caption, color: tokens.textMuted }}
      >
        {t("compare.progress", { decided, left })}
      </Box>
    </Box>
  );
};
