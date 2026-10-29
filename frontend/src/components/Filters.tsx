import React from "react";
import {
  Box,
  TextField,
  MenuItem,
  Button,
  InputAdornment,
} from "@mui/material";
import { Search } from "@mui/icons-material";
import { tokens } from "../theme";
import { pillField } from "./pillField";
import { TestRun, TestVariation } from "../types";
import { DebounceInput } from "react-debounce-input";
import { LOCATOR_RESET_FILTER } from "../constants/help";
import { labelOf, useT } from "../i18n";

const emptyFn = () => undefined;

interface IProps {
  items: TestRun[] | TestVariation[];
  queryState: [string, React.Dispatch<React.SetStateAction<string>>];
  osState: [string, React.Dispatch<React.SetStateAction<string>>];
  deviceState: [string, React.Dispatch<React.SetStateAction<string>>];
  browserState: [string, React.Dispatch<React.SetStateAction<string>>];
  viewportState: [string, React.Dispatch<React.SetStateAction<string>>];
  customTagsState: [string, React.Dispatch<React.SetStateAction<string>>];
  testStatusState?: [string, React.Dispatch<React.SetStateAction<string>>];
  branchNameState?: [string, React.Dispatch<React.SetStateAction<string>>];
}

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
  // `t` is taken: the lists below name each item t
  const i18n = useT();
  const [query, setQuery] = queryState;
  const [os, setOs] = osState;
  const [device, setDevice] = deviceState;
  const [browser, setBrowser] = browserState;
  const [viewport, setViewport] = viewportState;
  const [customTags, setCustomTags] = customTagsState;

  const [testStatus, setTestStatus] = testStatusState || [null, emptyFn];

  const [branchName, setBranchName] = branchNameState || [null, emptyFn];

  const osList = items
    .map((t) => t.os)
    .filter((v, i, array) => v && array.indexOf(v) === i);

  const deviceList = items
    .map((t) => t.device)
    .filter((v, i, array) => v && array.indexOf(v) === i);

  const browserList = items
    .map((t) => t.browser)
    .filter((v, i, array) => v && array.indexOf(v) === i);

  const viewportList = items
    .map((t) => t.viewport)
    .filter((v, i, array) => v && array.indexOf(v) === i);

  const customTagsList = items
    .map((t) => t.customTags)
    .filter((v, i, array) => v && array.indexOf(v) === i);

  const testStatusList =
    testStatusState &&
    items.some((i) => (i as TestRun).status) &&
    (items as TestRun[])
      .map((t) => t.status)
      .filter((v, i, array) => v && array.indexOf(v) === i);

  const branchNameList =
    branchNameState &&
    items
      .map((t) => t.branchName)
      .filter((v, i, array) => v && array.indexOf(v) === i);

  // compact selects in one row, each a rounded chip that turns green when set
  const select = (
    id: string,
    label: string,
    value: string | null,
    options: string[] | false | undefined,
    onChange: (value: string) => void,
    wrapperId?: string,
    // the label of a value: statuses have their own, the rest is data
    labelOfValue: (value: string) => string = (value) => value,
  ) =>
    options && options.length > 0 ? (
      <Box id={wrapperId} sx={{ display: "inline-flex" }}>
        <TextField
          select
          size="small"
          label={label}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          SelectProps={{
            id,
            displayEmpty: true,
            renderValue: (selected) =>
              selected ? (
                labelOfValue(String(selected))
              ) : (
                <Box component="span" sx={{ color: tokens.textMuted }}>
                  {i18n.t("filters.all")}
                </Box>
              ),
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 120, maxWidth: 220, ...pillField(Boolean(value)) }}
        >
          <MenuItem value="">{i18n.t("filters.all")}</MenuItem>
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {labelOfValue(option)}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    ) : null;

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1.25,
      }}
    >
      <DebounceInput
        size="small"
        label={i18n.t("filters.name")}
        value={query}
        element={TextField}
        minLength={2}
        debounceTimeout={300}
        onChange={(event) => setQuery(event?.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ width: 220, ...pillField(Boolean(query)) }}
      />
      {select("filter_os", i18n.t("filters.os"), os, osList, setOs)}
      {select(
        "filter_device",
        i18n.t("filters.device"),
        device,
        deviceList,
        setDevice,
      )}
      {select(
        "filter_browser",
        i18n.t("filters.browser"),
        browser,
        browserList,
        setBrowser,
      )}
      {select(
        "filter_viewport",
        i18n.t("filters.viewport"),
        viewport,
        viewportList,
        setViewport,
      )}
      {select(
        "filter_customTags",
        i18n.t("filters.customTags"),
        customTags,
        customTagsList,
        setCustomTags,
      )}
      {select(
        "filter_testStatus",
        i18n.t("filters.status"),
        testStatus,
        testStatusList,
        setTestStatus,
        undefined,
        (value) => labelOf(i18n.t, "testStatus", value),
      )}
      {select(
        "filter_branchName",
        i18n.t("filters.branch"),
        branchName,
        branchNameList,
        setBranchName,
        LOCATOR_RESET_FILTER,
      )}
      <Button
        size="small"
        disabled={
          ![
            query,
            os,
            device,
            browser,
            viewport,
            customTags,
            testStatus,
            branchName,
          ].some(Boolean)
        }
        onClick={() => {
          setQuery("");
          setOs("");
          setDevice("");
          setBrowser("");
          setViewport("");
          setCustomTags("");
          setTestStatus("");
          setBranchName("");
        }}
      >
        {i18n.t("filters.reset")}
      </Button>
    </Box>
  );
};

export default Filters;
