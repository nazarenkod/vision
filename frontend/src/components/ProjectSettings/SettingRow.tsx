import React from "react";
import { Box, Button, Chip, Typography } from "@mui/material";
import { useT } from "../../i18n";
import { tokens } from "../../theme";

interface Props {
  label: React.ReactNode;
  // what changes for the reviewer, with an example
  help?: React.ReactNode;
  // the default as people read it; no chip when the setting has none
  defaultText?: string;
  changed?: boolean;
  onReset?: () => void;
  // the input sits under the text instead of beside it (text fields, lists)
  wide?: boolean;
  testId?: string;
  children: React.ReactNode;
}

/**
 * One setting: what it is, what it changes, its default and a way back to
 * it, with the control beside or under the text.
 */
export const SettingRow: React.FunctionComponent<Props> = ({
  label,
  help,
  defaultText,
  changed,
  onReset,
  wide,
  testId,
  children,
}) => {
  const { t } = useT();
  const text = (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body1" sx={{ fontWeight: 500 }} component="div">
        {label}
      </Typography>
      {help && (
        <Typography
          variant="body2"
          color="textSecondary"
          component="div"
          sx={{ mt: 0.25 }}
        >
          {help}
        </Typography>
      )}
      {(defaultText || (changed && onReset)) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mt: 0.75,
            flexWrap: "wrap",
          }}
        >
          {defaultText && (
            <Chip
              size="small"
              variant="outlined"
              label={t("settings.default", { value: defaultText })}
              sx={{ fontSize: 12, height: 22 }}
            />
          )}
          {changed && onReset && (
            <Button
              size="small"
              onClick={onReset}
              sx={{ py: 0, minHeight: 22, fontSize: 12 }}
            >
              {t("settings.resetToDefault")}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );

  return (
    <Box
      data-testid={testId}
      sx={{
        display: "grid",
        gridTemplateColumns: wide ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto",
        alignItems: "start",
        columnGap: 3,
        rowGap: 1.5,
        py: 2,
        borderBottom: `1px solid ${tokens.border}`,
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      {text}
      <Box sx={{ minWidth: 0, pt: wide ? 0 : 0.25 }}>{children}</Box>
    </Box>
  );
};

/** A titled block of settings on a tab. */
export const SettingSection: React.FunctionComponent<{
  title: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}> = ({ title, intro, children, testId }) => (
  <Box
    component="section"
    data-testid={testId}
    sx={{
      bgcolor: tokens.surface,
      border: `1px solid ${tokens.border}`,
      borderRadius: 3,
      px: 3,
      py: 2,
    }}
  >
    <Typography variant="h6" component="h2" sx={{ fontSize: 17 }}>
      {title}
    </Typography>
    {intro && (
      <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
        {intro}
      </Typography>
    )}
    <Box sx={{ mt: 1 }}>{children}</Box>
  </Box>
);
