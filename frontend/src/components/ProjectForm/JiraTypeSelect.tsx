import React from "react";
import { ListSubheader, MenuItem, TextField } from "@mui/material";
import {
  jiraTypeOptions,
  selectedJiraType,
} from "../../_helpers/jiraTypes.helper";
import { tokens } from "../../theme";
import { useT } from "../../i18n";

/**
 * A Jira issue or link type picked from what the person's Jira returns
 * (REQ-049-01). Without lists — no token, Jira down — it only shows what is
 * saved (REQ-049-04, 05).
 */
export const JiraTypeSelect: React.FunctionComponent<{
  id: string;
  label: string;
  helperText: string;
  types: ReadonlyArray<{ name: string; subtask?: boolean }> | null;
  value: string | null | undefined;
  onChange: (value: string) => void;
}> = ({ id, label, helperText, types, value, onChange }) => {
  const { t } = useT();
  const options = React.useMemo(
    () => (types ? jiraTypeOptions(types, value, t) : []),
    [types, value, t],
  );

  if (!types) {
    return (
      <TextField
        id={id}
        label={label}
        helperText={helperText}
        size="small"
        fullWidth
        disabled
        value={value || t("jira.automatic")}
      />
    );
  }

  const items: React.ReactNode[] = [];
  let group: string | undefined;
  for (const option of options) {
    if (option.group && option.group !== group) {
      group = option.group;
      items.push(<ListSubheader key={`group-${group}`}>{group}</ListSubheader>);
    }
    items.push(
      <MenuItem
        key={`${option.missing ? "missing" : "type"}-${option.value}`}
        value={option.value}
        sx={option.missing ? { color: tokens.textSecondary } : undefined}
      >
        {option.label}
      </MenuItem>,
    );
  }

  return (
    <TextField
      id={id}
      select
      label={label}
      helperText={helperText}
      size="small"
      fullWidth
      value={selectedJiraType(options, value)}
      onChange={(event) => onChange(event.target.value)}
      SelectProps={{
        displayEmpty: true,
        MenuProps: { PaperProps: { sx: { maxHeight: 360 } } },
        SelectDisplayProps: {
          "data-testid": `${id}-select`,
        } as React.HTMLAttributes<HTMLDivElement>,
      }}
      InputLabelProps={{ shrink: true }}
    >
      {items}
    </TextField>
  );
};
