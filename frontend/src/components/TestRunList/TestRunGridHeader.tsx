import React from "react";
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import { ArrowDownward, ArrowUpward, ExpandMore } from "@mui/icons-material";
import { tokens } from "../../theme";
import { MessageKey, useT } from "../../i18n";

// the grid sorts on its own: the table sorts by clicking its column headers
export type TestRunSortField = "status" | "name" | "tags";

export type TestRunSort = {
  field: TestRunSortField;
  direction: "asc" | "desc";
};

export const SORT_LABELS: Record<TestRunSortField, MessageKey> = {
  name: "runs.name",
  tags: "runs.tags",
  status: "runs.status",
};

// the direction a field is most useful in when it is first picked
export const DEFAULT_SORT_DIRECTION: Record<
  TestRunSortField,
  TestRunSort["direction"]
> = {
  // descending status is needs-attention-first, as in the table
  status: "desc",
  name: "asc",
  tags: "asc",
};

export const DEFAULT_SORT: TestRunSort = { field: "status", direction: "desc" };

// picking the field already in use flips it, the way clicking a column header does
export const nextSort = (
  current: TestRunSort,
  field: TestRunSortField,
): TestRunSort =>
  current.field === field
    ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
    : { field, direction: DEFAULT_SORT_DIRECTION[field] };

/**
 * The grid's sort as a button of its own (REQ-046-30): cards have no column
 * heads to click, and a table head above them read as a second, empty table.
 * The menu offers the table's columns; picking the field already in use flips
 * its direction, as clicking a column head again does.
 */
export const GridSortButton: React.FunctionComponent<{
  sort: TestRunSort;
  onSortChange: (sort: TestRunSort) => void;
}> = ({ sort, onSortChange }) => {
  const { t } = useT();
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const Arrow = sort.direction === "asc" ? ArrowUpward : ArrowDownward;
  const fields = Object.keys(SORT_LABELS) as TestRunSortField[];

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        onClick={(event) => setAnchor(event.currentTarget)}
        endIcon={<ExpandMore fontSize="small" />}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        data-testid="gridSortButton"
        sx={{
          textTransform: "none",
          borderColor: tokens.borderStrong,
          whiteSpace: "nowrap",
        }}
      >
        {t("runs.sortBy", { field: t(SORT_LABELS[sort.field]) })}
        <Arrow
          aria-label={t(
            sort.direction === "asc" ? "runs.ascending" : "runs.descending",
          )}
          sx={{ fontSize: 16, marginLeft: 0.5, color: tokens.textSecondary }}
        />
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        {fields.map((field) => (
          <MenuItem
            key={field}
            selected={field === sort.field}
            onClick={() => {
              onSortChange(nextSort(sort, field));
              setAnchor(null);
            }}
            data-testid={`gridSort-${field}`}
          >
            <ListItemText>{t(SORT_LABELS[field])}</ListItemText>
            {field === sort.field && (
              <ListItemIcon sx={{ justifyContent: "flex-end" }}>
                <Arrow fontSize="small" />
              </ListItemIcon>
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
