import React from "react";
import { Box } from "@mui/material";
import { StepState, stepStates } from "../../_helpers/review.helper";
import { motion, tokens } from "../../theme";

const COLOUR: Record<StepState, string> = {
  current: tokens.text,
  approved: tokens.brand,
  rejected: tokens.status.failed.bar,
  waiting: tokens.borderStrong,
};

// past this many, dots turn into a segmented bar so they still fit
const MAX_DOTS = 24;

/** How far the review has got: one mark per step (REQ-018-32). */
export const StepDots: React.FunctionComponent<{
  statuses: string[];
  currentIndex: number;
}> = ({ statuses, currentIndex }) => {
  if (statuses.length < 2) return null;
  const states = stepStates(statuses, currentIndex);
  const asBar = states.length > MAX_DOTS;
  return (
    <Box
      data-testid="stepDots"
      role="img"
      aria-label={`${states.filter((s) => s === "approved").length} approved, ${states.filter((s) => s === "rejected").length} rejected, ${states.filter((s) => s === "waiting").length} waiting`}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: asBar ? "1px" : "5px",
        width: asBar ? 160 : "auto",
      }}
    >
      {states.map((state, index) => (
        <Box
          key={index}
          data-state={state}
          sx={{
            flex: asBar ? 1 : "none",
            width: asBar ? "auto" : 8,
            height: asBar ? 6 : 8,
            borderRadius: asBar ? "1px" : "50%",
            bgcolor: COLOUR[state],
            transform: state === "current" && !asBar ? "scale(1.25)" : "none",
            transition: `background-color ${motion.base}ms ${motion.easing}, transform ${motion.base}ms ${motion.spring}`,
          }}
        />
      ))}
    </Box>
  );
};
