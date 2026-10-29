import React from "react";
import {
  Box,
  Chip,
  LinearProgress,
  TablePagination,
  Toolbar,
  Typography,
} from "@mui/material";
import TestStatusChip from "../TestStatusChip";
import {
  useTestRunState,
  useTestRunDispatch,
  useBuildState,
} from "../../contexts";
import { useSnackbar } from "notistack";
import { useHotkeys } from "react-hotkeys-hook";
import {
  DataGrid,
  useGridApiRef,
  GridCellParams,
  GridColDef,
  GridRowParams,
  GridValueGetterParams,
  GridRenderCellParams,
  GridSortDirection,
  GridSortModel,
  gridFilteredSortedRowIdsSelector,
} from "@mui/x-data-grid";
import { DataGridCustomToolbar } from "./DataGridCustomToolbar";
import { BulkOperation } from "./BulkOperation";
import { TestRunGrid } from "./TestRunGrid";
import {
  TestRunDensity,
  TestRunListControls,
  TestRunView,
} from "./TestRunListControls";
import {
  DEFAULT_SORT,
  TestRunGridHeader,
  TestRunSort,
} from "./TestRunGridHeader";
import TestRunFilters from "./TestRunFilters";
import { TestRun, TestStatus } from "../../types";
import { testRunService } from "../../services";
import { useNavigate } from "react-router";
import { buildTestRunLocation } from "../../_helpers/route.helpers";
import { TEST_RUN_SHOW_DIFF_KEY } from "../../constants";
import {
  byAttention,
  statusesByAttention,
  statusRank,
} from "../../_helpers/testRunStatus.helper";
import { tagsOf } from "../../_helpers/testRunTags.helper";
import { Text, useT } from "../../i18n";

// https://mui.com/x/react-data-grid/column-definition/
const buildColumns = (t: Text): GridColDef[] => [
  {
    field: "id",
    filterable: false,
  },
  {
    field: "name",
    headerName: t("runs.name"),
    flex: 1,
    filterable: false,
    renderCell: (params: GridRenderCellParams) => (
      // the cell is a flex row, so without a zero minimum the name pushes past
      // its edge instead of ending in an ellipsis
      <Typography
        variant="body2"
        noWrap
        minWidth={0}
        title={params.row["name"]}
      >
        {params.row["name"]}
      </Typography>
    ),
  },
  {
    field: "tags",
    headerName: t("runs.tags"),
    flex: 1,
    filterable: false,
    valueGetter: (params: GridValueGetterParams) =>
      TAG_FIELDS.map((field) => params.row[field]).reduce(
        (prev, curr) => prev.concat(curr ? `${curr};` : ""),
        "",
      ),
    renderCell: (params: GridCellParams) => (
      <React.Fragment>
        {params.formattedValue
          ?.toString()
          .split(";")
          .map(
            (tag: string | null) =>
              tag && (
                <Chip
                  key={tag}
                  size="small"
                  label={tag}
                  style={{
                    margin: "1px",
                  }}
                />
              ),
          )}
      </React.Fragment>
    ),
  },
  {
    field: "status",
    headerName: t("runs.status"),
    flex: 0.3,
    // room for the longest status pill, «чекає рішення», at 1280px
    minWidth: 140,
    filterable: false,
    renderCell: (params: GridRenderCellParams) => (
      <TestStatusChip status={params.row["status"]?.toString()} />
    ),
    sortComparator: (v1: TestStatus, v2: TestStatus) =>
      statusRank(v2) - statusRank(v1),
  },
];

const TAG_FIELDS: Array<keyof TestRun> = [
  "os",
  "device",
  "browser",
  "viewport",
  "customTags",
];

const PAGE_SIZE_OPTIONS = [10, 30, 100];

const byName = (a: TestRun, b: TestRun): number => a.name.localeCompare(b.name);

// the table's own status comparator: ascending runs from ok to new, so that
// descending means needs-attention-first in both views and the arrows agree
const bySettled = (a: TestRun, b: TestRun): number => -byAttention(a, b);

// the direction applies to the chosen field only: negating the whole comparator
// would reverse the tie-break too, so a descending status listed names Z to A
const comparatorFor =
  (sort: TestRunSort, tagFields: Array<keyof TestRun>) =>
  (a: TestRun, b: TestRun): number => {
    const ascending =
      sort.field === "status"
        ? bySettled(a, b)
        : sort.field === "name"
          ? byName(a, b)
          : tagsOf(a, tagFields).localeCompare(tagsOf(b, tagFields));
    const primary = sort.direction === "asc" ? ascending : -ascending;
    const tieBreak = sort.field === "name" ? byAttention(a, b) : byName(a, b);

    return primary || tieBreak;
  };

type TagGroups = Array<[keyof TestRun, Set<string>]>;

const matchesNameQuery = (run: TestRun, query: string): boolean =>
  !query || run.name.toLowerCase().includes(query);

const matchesStatuses = (run: TestRun, statuses: TestStatus[]): boolean =>
  statuses.length === 0 || statuses.includes(run.status);

const matchesTagGroups = (run: TestRun, groups: TagGroups): boolean =>
  groups.every(([field, values]) => values.has(String(run[field] ?? "")));

const runTagValues = (run: TestRun): string[] =>
  TAG_FIELDS.map((field) => run[field]).filter(
    (v): v is string => typeof v === "string" && Boolean(v),
  );

const TestRunList: React.FunctionComponent = () => {
  const apiRef = useGridApiRef();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { t } = useT();
  const { selectedTestRun, testRuns, loading } = useTestRunState();
  const { selectedBuild } = useBuildState();
  const testRunDispatch = useTestRunDispatch();

  const [paginationModel, setPaginationModel] = React.useState({
    pageSize: 10,
    page: 0,
  });

  const [sortModel, setSortModel] = React.useState<GridSortModel>([
    {
      field: "status",
      sort: "desc" as GridSortDirection,
    },
  ]);

  const [nameFilter, setNameFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<TestStatus[]>([]);
  const [tagFilter, setTagFilter] = React.useState<string[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  // deliberately not remembered, like the sort below: a build is opened to be
  // reviewed as it stands, and the flat table is what the list has always been
  const [view, setView] = React.useState<TestRunView>("table");
  const [density, setDensity] = React.useState<TestRunDensity>("standard");
  const [showDiff, setShowDiff] = React.useState(
    () => localStorage.getItem(TEST_RUN_SHOW_DIFF_KEY) !== "false",
  );
  // a remembered card order also made the two views open on different columns
  const [gridSort, setGridSort] = React.useState<TestRunSort>(DEFAULT_SORT);

  useHotkeys("d", () => setShowDiff((prev) => !prev), {
    enabled: view === "grid" && !selectedTestRun,
  });

  // A build holds thousands of runs and selecting them all is one click, so
  // every membership test below reads a set rather than scanning the array.
  const selectedIdSet = React.useMemo(
    () => new Set(selectedIds),
    [selectedIds],
  );

  // every filtered run, not just the page: the table's header box does the same
  const toggleAll = React.useCallback(
    (ids: string[]) =>
      setSelectedIds((prev) => {
        const previous = new Set(prev);
        return ids.every((id) => previous.has(id)) ? [] : ids;
      }),
    [],
  );

  const clearSelection = React.useCallback(() => setSelectedIds([]), []);

  const toggleRun = React.useCallback(
    (id: string) =>
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
      ),
    [],
  );

  // the data grid takes its density prop as an initial value only, so later
  // changes have to go through the api
  React.useEffect(() => {
    apiRef.current?.setDensity?.(density);
  }, [apiRef, density, view]);

  // a tag on a card filters by it, and clicking it again lets go
  const toggleTag = React.useCallback(
    (tag: string) =>
      setTagFilter((prev) =>
        prev.includes(tag)
          ? prev.filter((item) => item !== tag)
          : [...prev, tag],
      ),
    [],
  );

  const resetFilters = React.useCallback(() => {
    setNameFilter("");
    setStatusFilter([]);
    setTagFilter([]);
  }, []);

  const tagFieldByValue = React.useMemo(() => {
    const map = new Map<string, keyof TestRun>();
    testRuns.forEach((run) => {
      TAG_FIELDS.forEach((field) => {
        const value = run[field];
        if (typeof value === "string" && value) {
          map.set(value, field);
        }
      });
    });
    return map;
  }, [testRuns]);

  const selectedTagsByField = React.useMemo(() => {
    const grouped = new Map<keyof TestRun, Set<string>>();
    tagFilter.forEach((tag) => {
      const field = tagFieldByValue.get(tag);
      if (!field) {
        return;
      }
      const values = grouped.get(field) ?? new Set<string>();
      values.add(tag);
      grouped.set(field, values);
    });
    return grouped;
  }, [tagFilter, tagFieldByValue]);

  const query = nameFilter.trim().toLowerCase();
  const tagGroups = React.useMemo(
    () => Array.from(selectedTagsByField.entries()),
    [selectedTagsByField],
  );

  const filteredRows = React.useMemo(
    () =>
      testRuns.filter(
        (run) =>
          matchesNameQuery(run, query) &&
          matchesStatuses(run, statusFilter) &&
          matchesTagGroups(run, tagGroups),
      ),
    [testRuns, query, statusFilter, tagGroups],
  );

  const gridRows = React.useMemo(
    () => [...filteredRows].sort(comparatorFor(gridSort, TAG_FIELDS)),
    [filteredRows, gridSort],
  );

  const columns = React.useMemo(() => buildColumns(t), [t]);

  // the dialog walks the grid's runs in the grid's order. Not limited to the
  // current page, matching how the table publishes every filtered row rather
  // than the visible ones.
  const gridRunIds = React.useMemo(
    () => gridRows.map((run) => run.id),
    [gridRows],
  );

  // the footer speaks of cards, so it counts the ticked cards on show, not runs
  // a filter has since hidden
  const selectedCardCount = React.useMemo(
    () => gridRows.filter((run) => selectedIdSet.has(run.id)).length,
    [gridRows, selectedIdSet],
  );

  // clamped rather than corrected in state: deleting runs shrinks the card
  // count under a page number that was valid a moment ago
  const gridPageCount = Math.max(
    1,
    Math.ceil(gridRows.length / paginationModel.pageSize),
  );
  const gridPage = Math.min(paginationModel.page, gridPageCount - 1);
  const pagedRuns = gridRows.slice(
    gridPage * paginationModel.pageSize,
    (gridPage + 1) * paginationModel.pageSize,
  );

  // Options for each filter are derived from rows matching all OTHER filters,
  // so only values that would actually return results are offered.
  const statusOptions = React.useMemo(() => {
    const present = new Set<TestStatus>(statusFilter);
    testRuns.forEach((run) => {
      if (matchesNameQuery(run, query) && matchesTagGroups(run, tagGroups)) {
        present.add(run.status);
      }
    });
    return statusesByAttention(Array.from(present));
  }, [testRuns, query, tagGroups, statusFilter]);

  const tagOptions = React.useMemo(() => {
    const present = new Set<string>(tagFilter);
    testRuns.forEach((run) => {
      if (matchesNameQuery(run, query) && matchesStatuses(run, statusFilter)) {
        // read the fields straight off the run: an array per run is thousands
        // of throwaway allocations on every keystroke
        TAG_FIELDS.forEach((field) => {
          const value = run[field];
          if (typeof value === "string" && value) {
            present.add(value);
          }
        });
      }
    });
    const fieldIndex = (value: string): number => {
      const field = tagFieldByValue.get(value);
      return field ? TAG_FIELDS.indexOf(field) : TAG_FIELDS.length;
    };
    return Array.from(present).sort(
      (a, b) => fieldIndex(a) - fieldIndex(b) || a.localeCompare(b),
    );
  }, [testRuns, query, statusFilter, tagFilter, tagFieldByValue]);

  React.useEffect(() => {
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [nameFilter, statusFilter, tagFilter]);

  // Drop selected filter values that no longer exist in the data
  // (e.g. after their test runs were deleted).
  React.useEffect(() => {
    if (testRuns.length === 0) {
      return;
    }
    const existingTags = new Set<string>();
    const existingStatuses = new Set<TestStatus>();
    testRuns.forEach((run) => {
      runTagValues(run).forEach((value) => existingTags.add(value));
      existingStatuses.add(run.status);
    });
    setTagFilter((prev) => {
      const next = prev.filter((tag) => existingTags.has(tag));
      return next.length === prev.length ? prev : next;
    });
    setStatusFilter((prev) => {
      const next = prev.filter((status) => existingStatuses.has(status));
      return next.length === prev.length ? prev : next;
    });
  }, [testRuns]);

  const getTestRunListCallback = React.useCallback(() => {
    testRunDispatch({
      type: "request",
    });
    if (selectedBuild?.id) {
      testRunService
        .getList(selectedBuild.id)
        .then((payload) =>
          testRunDispatch({
            type: "get",
            payload,
          }),
        )
        .catch((err: string) => {
          testRunDispatch({ type: "failure" });
          enqueueSnackbar(err, {
            variant: "error",
          });
        });
    } else {
      testRunDispatch({
        type: "get",
        payload: [],
      });
    }
  }, [testRunDispatch, enqueueSnackbar, selectedBuild?.id]);

  React.useEffect(() => {
    getTestRunListCallback();
  }, [getTestRunListCallback]);

  // workaround https://github.com/mui/mui-x/issues/1106
  React.useEffect(() => {
    let unsubscribe: () => void;
    const handleStateChange = () => {
      unsubscribe?.();
      if (!selectedTestRun) {
        testRunDispatch({
          type: "filterSort",
          payload: gridFilteredSortedRowIdsSelector(apiRef),
        });
      }
      unsubscribe?.();
    };
    return apiRef.current?.subscribeEvent?.(
      "stateChange",
      () =>
        (unsubscribe = apiRef.current?.subscribeEvent(
          "stateChange",
          handleStateChange,
        )),
    );
  }, [apiRef, apiRef.current?.instanceId]);

  // the data grid publishes the order the details dialog navigates; with the
  // grid view mounted instead, it has to publish its own
  React.useEffect(() => {
    if (view === "grid" && !selectedTestRun) {
      testRunDispatch({ type: "filterSort", payload: gridRunIds });
    }
  }, [view, gridRunIds, selectedTestRun, testRunDispatch]);

  if (selectedBuild) {
    return (
      <Box display="flex" flexDirection="column" height="100%">
        <Box paddingX={2} paddingTop={1} paddingBottom={1}>
          <TestRunFilters
            tagOptions={tagOptions}
            statusOptions={statusOptions}
            name={nameFilter}
            statuses={statusFilter}
            tags={tagFilter}
            onNameChange={setNameFilter}
            onStatusesChange={setStatusFilter}
            onTagsChange={setTagFilter}
            onReset={resetFilters}
          />
        </Box>
        <Box flex={1} minHeight={0}>
          {view === "table" ? (
            <DataGrid
              apiRef={apiRef}
              rows={gridRows}
              columns={columns}
              columnVisibilityModel={{
                id: false,
              }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pagination
              loading={loading}
              slots={{
                toolbar: DataGridCustomToolbar,
              }}
              density={density}
              slotProps={{
                toolbar: {
                  selectedIds,
                  rows: filteredRows,
                  view,
                  onViewChange: setView,
                  density,
                  onDensityChange: setDensity,
                  showDiff,
                  onShowDiffChange: setShowDiff,
                  onProcessed: clearSelection,
                },
              }}
              rowSelectionModel={selectedIds}
              onRowSelectionModelChange={(model) =>
                setSelectedIds(model.map(String))
              }
              checkboxSelection
              disableColumnSelector
              disableColumnMenu
              disableRowSelectionOnClick
              sortModel={sortModel}
              onSortModelChange={(model) => setSortModel(model)}
              onRowClick={(param: GridRowParams) => {
                navigate(
                  buildTestRunLocation(
                    selectedBuild.id,
                    param.row["id"].toString(),
                  ),
                );
              }}
            />
          ) : (
            // framed like the data grid, so both views read as one widget. The
            // colour too: the data grid sets text.primary on its own subtree,
            // and without it the toolbar and header inherit the body's pure
            // black and read heavier than the table's
            <Box
              height="100%"
              display="flex"
              flexDirection="column"
              border={1}
              borderColor="divider"
              borderRadius={1}
              color="text.primary"
            >
              <Toolbar variant="dense">
                <TestRunListControls
                  view={view}
                  onViewChange={setView}
                  density={density}
                  onDensityChange={setDensity}
                  showDiff={showDiff}
                  onShowDiffChange={setShowDiff}
                />
                <Box marginLeft="auto">
                  <BulkOperation
                    selectedIds={selectedIds}
                    rows={gridRows}
                    selectionNoun="cards"
                    onProcessed={clearSelection}
                  />
                </Box>
              </Toolbar>
              <TestRunGridHeader
                sort={gridSort}
                onSortChange={setGridSort}
                density={density}
                selectedCount={selectedCardCount}
                totalCount={gridRunIds.length}
                onToggleAll={() => toggleAll(gridRunIds)}
              />
              {loading && <LinearProgress />}
              <Box flex={1} overflow="auto">
                {gridRows.length === 0 ? (
                  <Typography
                    variant="subtitle1"
                    align="center"
                    color="textSecondary"
                    sx={{ padding: 2 }}
                    data-testid="testRunGridEmpty"
                  >
                    {t("runs.noMatch")}
                  </Typography>
                ) : (
                  <TestRunGrid
                    runs={pagedRuns}
                    selectedIdSet={selectedIdSet}
                    density={density}
                    showDiff={showDiff}
                    activeTags={tagFilter}
                    tagFields={TAG_FIELDS}
                    onToggle={toggleRun}
                    onToggleTag={toggleTag}
                    onOpen={(id) =>
                      navigate(buildTestRunLocation(selectedBuild.id, id))
                    }
                  />
                )}
              </Box>
              <Box
                display="flex"
                alignItems="center"
                borderTop={1}
                borderColor="divider"
              >
                {selectedCardCount > 0 && (
                  <Typography
                    variant="body2"
                    marginLeft={2}
                    data-testid="gridSelectionCount"
                  >
                    {t("runs.cardsSelected", { count: selectedCardCount })}
                  </Typography>
                )}
                <Box marginLeft="auto">
                  <TablePagination
                    component="div"
                    count={gridRows.length}
                    page={gridPage}
                    rowsPerPage={paginationModel.pageSize}
                    rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                    labelRowsPerPage={t("runs.cardsPerPage")}
                    onPageChange={(event, next) =>
                      setPaginationModel((prev) => ({ ...prev, page: next }))
                    }
                    onRowsPerPageChange={(event) =>
                      setPaginationModel({
                        page: 0,
                        pageSize: Number(event.target.value),
                      })
                    }
                  />
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return <Typography variant="h5">{t("runs.selectBuild")}</Typography>;
};

export default TestRunList;
