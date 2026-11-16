import React from "react";
import { Box } from "@mui/material";
import { radius, tokens, type } from "../theme";
import { useT } from "../i18n";

/** Marks a feature still being tried out, so nobody takes its shape for final. */
export const BetaChip: React.FunctionComponent = () => {
  const { t } = useT();
  return (
    <Box
      component="span"
      data-testid="betaChip"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 18,
        px: 0.75,
        borderRadius: radius.pill,
        bgcolor: tokens.variableSoft,
        color: tokens.variable,
        fontSize: type.caption,
        fontWeight: 600,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {t("beta")}
    </Box>
  );
};
