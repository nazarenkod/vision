import React from "react";
import { Box, SxProps, Theme } from "@mui/material";
import { tokens, type } from "../theme";

/**
 * A label above its field (spec 046): it stays put while one types, so a
 * filled form reads the same as an empty one. `hint` is a quieter aside.
 */
export const FieldLabel: React.FunctionComponent<{
  htmlFor: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  sx?: SxProps<Theme>;
}> = ({ htmlFor, children, hint, sx }) => (
  <Box
    component="label"
    htmlFor={htmlFor}
    sx={{
      display: "block",
      mb: 0.75,
      fontSize: type.small,
      fontWeight: 600,
      lineHeight: 1.4,
      color: tokens.text,
      ...sx,
    }}
  >
    {children}
    {hint && (
      <Box component="span" sx={{ fontWeight: 400, color: tokens.textMuted }}>
        {" · "}
        {hint}
      </Box>
    )}
  </Box>
);
