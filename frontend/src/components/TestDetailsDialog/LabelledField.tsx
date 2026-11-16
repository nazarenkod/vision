import React from "react";
import { Box, Typography } from "@mui/material";
import { tokens, type, radius } from "../../theme";
import { useT } from "../../i18n";

/**
 * A form field with its label above it (046). A floating MUI label sits in the
 * outline, so the focus border ran through it and an AI mark next to it was
 * drawn twice; a label above reads the same focused or not.
 */
export const LabelledField: React.FunctionComponent<{
  // the id of the input the label names
  id: string;
  label: React.ReactNode;
  // shown next to the label when AI drafted the text
  ai?: boolean;
  aiTestId?: string;
  // a quiet word after the label, e.g. where the field comes from
  caption?: React.ReactNode;
  helper?: React.ReactNode;
  // the person tried to file with this field empty
  required?: boolean;
  // what Create bug scrolls to when this field is still empty
  target?: string;
  children: React.ReactNode;
  sx?: React.ComponentProps<typeof Box>["sx"];
}> = ({
  id,
  label,
  ai,
  aiTestId,
  caption,
  helper,
  required,
  target,
  children,
  sx,
}) => {
  const { t } = useT();
  return (
    <Box
      data-bug-field={target}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        minWidth: 0,
        ...sx,
      }}
    >
      <Box
        component="label"
        htmlFor={id}
        id={`${id}-label`}
        sx={{
          display: "flex",
          alignItems: "baseline",
          flexWrap: "wrap",
          columnGap: 1,
          fontSize: type.small,
          lineHeight: "18px",
          fontWeight: 600,
          color: tokens.text,
        }}
      >
        {label}
        {ai && (
          <Box
            component="span"
            data-testid={aiTestId}
            sx={{
              fontSize: type.caption,
              fontWeight: 500,
              lineHeight: "18px",
              px: 0.75,
              borderRadius: radius.pill,
              // the mock-up's AI purple; nothing else on this dialog uses it
              color: tokens.variable,
              bgcolor: tokens.variableSoft,
            }}
          >
            {t("reportBug.aiTag")}
          </Box>
        )}
        {caption && (
          <Box
            component="span"
            sx={{
              fontSize: type.caption,
              fontWeight: 400,
              color: tokens.textMuted,
            }}
          >
            {caption}
          </Box>
        )}
      </Box>
      {children}
      {required ? (
        <Typography
          sx={{ fontSize: type.caption, color: tokens.status.failed.fg }}
          data-testid="bugRequired"
        >
          {t("reportBug.required")}
        </Typography>
      ) : (
        helper && (
          <Typography sx={{ fontSize: type.caption, color: tokens.textMuted }}>
            {helper}
          </Typography>
        )
      )}
    </Box>
  );
};
