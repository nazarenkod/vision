import React from "react";
import { Box } from "@mui/material";
import { tokens } from "../theme";

export type PillTone = "changed" | "new" | "failed" | "passed" | "neutral";

const NEUTRAL = { fg: tokens.textSecondary, bg: tokens.subtle };

/** Soft rounded status label; colour comes from the shared status tokens. */
export const StatusPill: React.FunctionComponent<{
  tone: PillTone;
  label: React.ReactNode;
  title?: string;
}> = ({ tone, label, title }) => {
  const colors = tone === "neutral" ? NEUTRAL : tokens.status[tone];
  return (
    <Box
      component="span"
      title={title}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        px: 1,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: colors.fg,
        bgcolor: colors.bg,
      }}
    >
      {label}
    </Box>
  );
};
