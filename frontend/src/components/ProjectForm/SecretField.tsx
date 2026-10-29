import React from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import { Check } from "@mui/icons-material";
import { tokens } from "../../theme";

/**
 * A write-only secret (REQ-018-50): once saved it is never shown, only that it
 * is there. `value` undefined keeps the saved one, "" removes it, text replaces
 * it.
 */
export const SecretField: React.FunctionComponent<{
  id: string;
  label: string;
  saved: boolean;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  helperText?: string;
}> = ({ id, label, saved, value, onChange, helperText }) => {
  const [replacing, setReplacing] = React.useState(false);

  if (saved && !replacing && value === undefined) {
    return (
      <Box
        data-testid={`${id}Saved`}
        sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
      >
        <Typography variant="body2" sx={{ minWidth: 160 }}>
          {label}
        </Typography>
        <Box
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            height: 24,
            pl: 0.75,
            pr: 1,
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            color: tokens.status.passed.fg,
            bgcolor: tokens.status.passed.bg,
          }}
        >
          <Check sx={{ fontSize: 14 }} /> Saved
        </Box>
        <Button size="small" onClick={() => setReplacing(true)}>
          Replace
        </Button>
        <Button size="small" onClick={() => onChange("")}>
          Remove
        </Button>
      </Box>
    );
  }

  if (saved && value === "") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ minWidth: 160 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Removed on save
        </Typography>
        <Button size="small" onClick={() => onChange(undefined)}>
          Undo
        </Button>
      </Box>
    );
  }

  return (
    <TextField
      id={id}
      label={label}
      type="password"
      size="small"
      autoComplete="new-password"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || undefined)}
      helperText={
        helperText ?? (saved ? "Leave empty to keep the saved one" : " ")
      }
    />
  );
};
