import React from "react";
import {
  Grid,
  TextField,
  Button,
  Autocomplete,
  Chip,
  Paper,
} from "@mui/material";
import { DebounceInput } from "react-debounce-input";
import { TestStatus } from "../../types";
import { labelOf, useT } from "../../i18n";

interface IProps {
  tagOptions: string[];
  statusOptions: TestStatus[];
  name: string;
  statuses: TestStatus[];
  tags: string[];
  onNameChange: (value: string) => void;
  onStatusesChange: (value: TestStatus[]) => void;
  onTagsChange: (value: string[]) => void;
  onReset: () => void;
}

const TestRunFilters: React.FunctionComponent<IProps> = ({
  tagOptions,
  statusOptions,
  name,
  statuses,
  tags,
  onNameChange,
  onStatusesChange,
  onTagsChange,
  onReset,
}) => {
  const { t } = useT();
  const hasActiveFilters =
    name.length > 0 || statuses.length > 0 || tags.length > 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Grid container spacing={2} alignItems="center" wrap="nowrap">
        <Grid item xs={3}>
          <DebounceInput
            size="small"
            variant="outlined"
            fullWidth
            label={t("runs.name")}
            placeholder={t("runs.searchByName")}
            value={name}
            element={TextField}
            minLength={2}
            debounceTimeout={300}
            onChange={(event) => onNameChange(event.target.value)}
            inputProps={{ "data-testid": "testRunNameFilter" }}
          />
        </Grid>
        <Grid item xs>
          <Autocomplete
            multiple
            size="small"
            disableCloseOnSelect
            limitTags={3}
            data-testid="testRunTagFilter"
            options={tagOptions}
            value={tags}
            onChange={(_event, value) => onTagsChange(value)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option}
                  size="small"
                  label={option}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label={t("runs.tag")}
                placeholder={tags.length === 0 ? t("runs.anyTag") : undefined}
              />
            )}
          />
        </Grid>
        <Grid item xs>
          <Autocomplete
            multiple
            size="small"
            disableCloseOnSelect
            limitTags={3}
            options={statusOptions}
            getOptionLabel={(option) => labelOf(t, "testStatus", option)}
            value={statuses}
            onChange={(_event, value) => onStatusesChange(value)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option}
                  size="small"
                  label={labelOf(t, "testStatus", option)}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label={t("runs.status")}
                placeholder={
                  statuses.length === 0 ? t("runs.anyStatus") : undefined
                }
              />
            )}
          />
        </Grid>
        <Grid item>
          <Button
            variant="outlined"
            color="primary"
            onClick={onReset}
            disabled={!hasActiveFilters}
          >
            {t("runs.reset")}
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default TestRunFilters;
