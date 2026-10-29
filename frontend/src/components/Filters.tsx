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
                String(selected)
              ) : (
                <Box component="span" sx={{ color: tokens.textMuted }}>
                  All
                </Box>
              ),
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 120, maxWidth: 220, ...pillField(Boolean(value)) }}
        >
          <MenuItem value="">All</MenuItem>
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
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
        label="Name"
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
      {select("filter_os", "OS", os, osList, setOs)}
      {select("filter_device", "Device", device, deviceList, setDevice)}
      {select("filter_browser", "Browser", browser, browserList, setBrowser)}
      {select(
        "filter_viewport",
        "Viewport",
        viewport,
        viewportList,
        setViewport,
      )}
      {select(
        "filter_customTags",
        "Custom tags",
        customTags,
        customTagsList,
        setCustomTags,
      )}
      {select(
        "filter_testStatus",
        "Status",
        testStatus,
        testStatusList,
        setTestStatus,
      )}
      {select(
        "filter_branchName",
        "Branch",
        branchName,
        branchNameList,
        setBranchName,
        LOCATOR_RESET_FILTER,
      )}
      <Button
        size="small"
        disabled={
          ![query, os, device, browser, viewport, customTags, testStatus, branchName].some(Boolean)
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
        Reset
      </Button>
    </Box>
  );
};

export default Filters;
