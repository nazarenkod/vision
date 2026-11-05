import React from "react";
import {
  Box,
  TextField,
  MenuItem,
  Button,
  IconButton,
  InputAdornment,
  Popover,
} from "@mui/material";
import { Close, FilterList, Search } from "@mui/icons-material";
import { tokens, radius, type } from "../theme";
import { TestRun, TestVariation } from "../types";
import { DebounceInput } from "react-debounce-input";
import { LOCATOR_RESET_FILTER } from "../constants/help";
import { labelOf, useT } from "../i18n";
import {
  activeFilters,
  distinctValues,
  FilterField,
} from "../_helpers/filters.helper";

const emptyFn = () => undefined;

type FilterState = [string, React.Dispatch<React.SetStateAction<string>>];

interface IProps {
  items: TestRun[] | TestVariation[];
  queryState: FilterState;
  osState: FilterState;
  deviceState: FilterState;
  browserState: FilterState;
  viewportState: FilterState;
  customTagsState: FilterState;
  testStatusState?: FilterState;
  branchNameState?: FilterState;
}

type Filter = FilterField & {
  options: string[];
  set: (value: string) => void;
  labelOfValue: (value: string) => string;
};

/**
 * A search field and one Filters button; the chosen filters stand beside it
 * as chips that remove themselves, and Clear drops them all (REQ-046-54).
 */
const Filters: React.FunctionComponent<IProps> = ({
  items,
  queryState,
  osState,
  deviceState,
  browserState,
  viewportState,
  customTagsState,
  testStatusState,
  branchNameState,
}) => {
  const { t } = useT();
  const [query, setQuery] = queryState;
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [testStatus, setTestStatus] = testStatusState || [null, emptyFn];
  const [branchName, setBranchName] = branchNameState || [null, emptyFn];
  const list = items as (TestRun | TestVariation)[];

  const asIs = (value: string) => value;
  const filter = (
    key: string,
    label: string,
    value: string | null,
    set: (value: string) => void,
    options: string[],
    labelOfValue: (value: string) => string = asIs,
  ): Filter => ({
    key,
    label,
    value,
    set,
    options,
    labelOfValue,
    shownValue: value ? labelOfValue(value) : undefined,
  });

  const filters: Filter[] = [
    filter(
      "os",
      t("filters.os"),
      osState[0],
      osState[1],
      distinctValues(list.map((item) => item.os)),
    ),
    filter(
      "device",
      t("filters.device"),
      deviceState[0],
      deviceState[1],
      distinctValues(list.map((item) => item.device)),
    ),
    filter(
      "browser",
      t("filters.browser"),
      browserState[0],
      browserState[1],
      distinctValues(list.map((item) => item.browser)),
    ),
    filter(
      "viewport",
      t("filters.viewport"),
      viewportState[0],
      viewportState[1],
      distinctValues(list.map((item) => item.viewport)),
    ),
    filter(
      "customTags",
      t("filters.customTags"),
      customTagsState[0],
      customTagsState[1],
      distinctValues(list.map((item) => item.customTags)),
    ),
    ...(testStatusState
      ? [
          filter(
            "testStatus",
            t("filters.status"),
            testStatus,
            setTestStatus,
            distinctValues((list as TestRun[]).map((item) => item.status)),
            (value) => labelOf(t, "testStatus", value),
          ),
        ]
      : []),
    ...(branchNameState
      ? [
          filter(
            "branchName",
            t("filters.branch"),
            branchName,
            setBranchName,
            distinctValues(list.map((item) => item.branchName)),
          ),
        ]
      : []),
  ];
  const offered = filters.filter((one) => one.options.length > 0 || one.value);
  const active = activeFilters(filters);
  const byKey = new Map(filters.map((one) => [one.key, one]));
  const clear = () => {
    setQuery("");
    filters.forEach((one) => one.set(""));
  };

  return (
    <Box
      data-testid="filters"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1,
      }}
    >
      <DebounceInput
        size="small"
        placeholder={t("filters.search")}
        value={query}
        element={TextField}
        minLength={2}
        debounceTimeout={300}
        onChange={(event) => setQuery(event?.target.value)}
        inputProps={{
          "aria-label": t("filters.search"),
          "data-testid": "filterSearch",
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ width: 280, bgcolor: tokens.surface }}
      />
      <Button
        id={LOCATOR_RESET_FILTER}
        variant="outlined"
        color="inherit"
        startIcon={<FilterList fontSize="small" />}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        data-testid="filtersButton"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ borderColor: tokens.borderStrong, bgcolor: tokens.surface }}
      >
        {t("filters.title")}
        {active.length > 0 && (
          <Box
            component="span"
            data-testid="filtersCount"
            sx={{
              ml: 0.75,
              px: 0.75,
              minWidth: 18,
              borderRadius: radius.pill,
              fontSize: type.caption,
              lineHeight: "18px",
              textAlign: "center",
              color: tokens.brandInk,
              bgcolor: tokens.brand,
            }}
          >
            {active.length}
          </Box>
        )}
      </Button>
      {active.map((one) => (
        <Box
          key={one.key}
          component="span"
          data-testid="filterChip"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.25,
            height: 28,
            pl: 1.25,
            pr: 0.25,
            borderRadius: radius.control,
            fontSize: type.small,
            color: tokens.brandDark,
            bgcolor: tokens.brandSoft,
          }}
        >
          {one.text}
          <IconButton
            size="small"
            aria-label={t("filters.remove", { name: one.label })}
            onClick={() => byKey.get(one.key)?.set("")}
            sx={{ p: 0.25, color: tokens.brandDark }}
          >
            <Close sx={{ fontSize: type.body }} />
          </IconButton>
        </Box>
      ))}
      {(active.length > 0 || query) && (
        <Button
          size="small"
          color="inherit"
          onClick={clear}
          data-testid="clearFilters"
          sx={{ color: tokens.textSecondary }}
        >
          {t("filters.clear")}
        </Button>
      )}
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-label": t("filters.title"),
            sx: { mt: 0.5, p: 2, width: 280 },
          } as object,
        }}
      >
        <Box
          data-testid="filtersPanel"
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          {offered.map((one) => (
            <TextField
              key={one.key}
              select
              size="small"
              fullWidth
              label={one.label}
              value={one.value ?? ""}
              onChange={(event) => one.set(event.target.value)}
              SelectProps={{
                id: `filter_${one.key}`,
                displayEmpty: true,
                renderValue: (selected) =>
                  selected ? (
                    one.labelOfValue(String(selected))
                  ) : (
                    <Box component="span" sx={{ color: tokens.textMuted }}>
                      {t("filters.all")}
                    </Box>
                  ),
              }}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="">{t("filters.all")}</MenuItem>
              {one.options.map((option) => (
                <MenuItem key={option} value={option}>
                  {one.labelOfValue(option)}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </Box>
      </Popover>
    </Box>
  );
};

export default Filters;
