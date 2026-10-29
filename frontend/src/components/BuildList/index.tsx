import React, { FunctionComponent } from "react";
import { makeStyles, createStyles } from "@mui/styles";
import { tokens } from "../../theme";
import { staggered } from "../motion/Stagger";
import {
  List,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Checkbox,
  Typography,
  Grid,
  Pagination,
  LinearProgress,
  Menu,
  MenuItem,
  Box,
  TextField,
  Fade,
} from "@mui/material";
import { MoreVert, DeleteOutline } from "@mui/icons-material";
import { DebounceInput } from "react-debounce-input";
import {
  useBuildState,
  useBuildDispatch,
  deleteBuild,
  useProjectState,
} from "../../contexts";
import { BuildStatusChip } from "../BuildStatusChip";
import { SkeletonList } from "../SkeletonList";
import { useSnackbar } from "notistack";
import { TextValidator } from "react-material-ui-form-validator";
import { Build } from "../../types";
import { BaseModal } from "../BaseModal";
import { buildsService } from "../../services";
import { useLocation, useNavigate } from "react-router";
import {
  buildTestRunLocation,
  getQueryParams,
} from "../../_helpers/route.helpers";
import { Tooltip } from "../Tooltip";
import { useT } from "../../i18n";

const useStyles = makeStyles(() =>
  createStyles({
    listContainer: {
      height: "100%",
      overflow: "auto",
    },
    listItemSecondaryAction: {
      visibility: "hidden",
    },
    listItem: {
      paddingRight: 48,
      margin: "2px 8px",
      borderRadius: 8,
      alignItems: "flex-start",
      "&:hover $listItemSecondaryAction": {
        visibility: "inherit",
      },
    },
  }),
);

const BuildList: FunctionComponent = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const { buildList, selectedBuild, loading, error, total, take } =
    useBuildState();
  const buildDispatch = useBuildDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { t, formatDate } = useT();
  const { selectedProjectId } = useProjectState();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuBuild, setMenuBuild] = React.useState<Build | null>();
  const [newCiBuildId, setNewCiBuildId] = React.useState("");
  const [paginationPage, setPaginationPage] = React.useState(1);
  // the build the page was opened on, if any: read once, since picking a build
  // from the list afterwards must not move the list under the reviewer
  const linkedBuildId = React.useRef(getQueryParams(location.search).buildId);
  const [searchQuery, setSearchQuery] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [selectingAll, setSelectingAll] = React.useState(false);
  const selectAllRequest = React.useRef(0);

  const allSelected = total > 0 && selectedIds.length === total;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const clearSelection = () => setSelectedIds([]);

  // the list is paginated, so selecting everything the search matched needs the
  // ids the current page does not hold
  const selectAllMatching = () => {
    if (buildList.length === total) {
      setSelectedIds(buildList.map((build) => build.id));
      return;
    }
    if (!selectedProjectId) {
      return;
    }

    const request = ++selectAllRequest.current;
    setSelectingAll(true);
    buildsService
      .getList(selectedProjectId, total, 0, searchQuery)
      .then((payload) => {
        if (request === selectAllRequest.current) {
          setSelectedIds(payload.data.map((build) => build.id));
        }
      })
      .catch((err: string) => enqueueSnackbar(err, { variant: "error" }))
      .finally(() => setSelectingAll(false));
  };

  const toggleSelectAll = () =>
    selectedIds.length > 0 ? clearSelection() : selectAllMatching();

  const selectAllLabel =
    selectedIds.length > 0
      ? t("builds.clearSelection")
      : t("builds.selectAll", { total });

  const handleMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    build: Build,
  ) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setMenuBuild(build);
  };

  const handleMenuClose = () => {
    setMenuBuild(null);
  };

  const toggleDeleteDialogOpen = () => {
    setDeleteDialogOpen(!deleteDialogOpen);
  };

  const toggleEditDialogOpen = () => {
    setEditDialogOpen(!editDialogOpen);
  };

  const selectBuildCalback = React.useCallback(
    (id?: string) => navigate(buildTestRunLocation(id)),
    [navigate],
  );

  const loadPage = React.useCallback(
    (page: number, aroundBuildId?: string) => {
      setPaginationPage(page);
      listRef.current?.scrollTo({ top: 0 });
      if (selectedProjectId) {
        // the link has been followed; from here the reviewer's own paging and
        // searching decide the page
        linkedBuildId.current = undefined;
        buildDispatch({ type: "request" });
        buildsService
          .getList(
            selectedProjectId,
            take,
            take * (page - 1),
            searchQuery,
            aroundBuildId,
          )
          .then((payload) => {
            // asked for a build's page, the answer says where that page starts
            // and so which page number to show. A build the list cannot place
            // leaves the skip as asked, and this lands back on the same page.
            if (aroundBuildId && payload.take > 0) {
              setPaginationPage(Math.floor(payload.skip / payload.take) + 1);
            }
            buildDispatch({ type: "get", payload });
          })
          .catch((err: string) => {
            buildDispatch({ type: "failure", payload: err });
            enqueueSnackbar(err, {
              variant: "error",
            });
          });
      }
    },
    [buildDispatch, enqueueSnackbar, selectedProjectId, take, searchQuery],
  );

  const handlePaginationChange = React.useCallback(
    (page: number) => loadPage(page),
    [loadPage],
  );

  // A link carries a build, not the page it sits on, so the list has to ask for
  // the page that holds it — otherwise a build on the fourth page opens behind
  // a list showing the first.
  React.useEffect(() => {
    loadPage(1, linkedBuildId.current);
  }, [loadPage]);

  React.useEffect(() => {
    // drops an in-flight select all so its ids cannot land on another search
    selectAllRequest.current += 1;
    setSelectedIds([]);
  }, [selectedProjectId, searchQuery]);

  // another project's builds must not linger while its list is being fetched
  React.useEffect(() => {
    buildDispatch({ type: "reset" });
  }, [buildDispatch, selectedProjectId]);

  const handleBulkDelete = () => {
    if (bulkDeleting) {
      return;
    }
    setBulkDeleting(true);
    setBulkDeleteDialogOpen(false);
    const ids = [...selectedIds];

    // every delete settles into a result, so this cannot reject
    void Promise.all(
      ids.map((id) =>
        deleteBuild(buildDispatch, id)
          .then(() => ({ id, ok: true }))
          .catch(() => ({ id, ok: false })),
      ),
    ).then((results) => {
      const deleted = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);

      if (deleted.length > 0) {
        enqueueSnackbar(t("builds.deletedMany", { count: deleted.length }), {
          variant: "success",
        });
      }
      if (failed.length > 0) {
        enqueueSnackbar(t("builds.deleteFailed", { count: failed.length }), {
          variant: "error",
        });
      }
      if (deleted.some((r) => r.id === selectedBuild?.id)) {
        selectBuildCalback();
      }

      setBulkDeleting(false);
      clearSelection();

      const remaining = total - deleted.length;
      const lastPage = Math.max(1, Math.ceil(remaining / take));
      handlePaginationChange(Math.min(paginationPage, lastPage));
    });
  };

  return (
    <>
      <Box height="91%" display="flex" flexDirection="column">
        <Box padding={1} display="flex" alignItems="center">
          {/* kept mounted so an empty search does not shift the search field */}
          <Tooltip title={selectAllLabel}>
            <span>
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={someSelected}
                disabled={selectingAll || buildList.length === 0}
                onChange={toggleSelectAll}
                inputProps={{ "aria-label": selectAllLabel }}
                data-testid="buildSelectAll"
              />
            </span>
          </Tooltip>
          <Box flexGrow={1}>
            <DebounceInput
              size="small"
              variant="outlined"
              fullWidth
              label={t("builds.search")}
              placeholder={t("builds.searchPlaceholder")}
              value={searchQuery}
              element={TextField}
              debounceTimeout={300}
              onChange={(event) => setSearchQuery(event.target.value)}
              inputProps={{ "data-testid": "buildSearch", autoComplete: "off" }}
            />
          </Box>
          {/* fades in place so picking a build does not resize the search field */}
          <Fade in={selectedIds.length > 0}>
            <span>
              <Tooltip
                title={t("builds.deleteSelected", {
                  count: selectedIds.length,
                })}
              >
                <IconButton
                  color="error"
                  disabled={bulkDeleting}
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  data-testid="buildDeleteSelected"
                >
                  <DeleteOutline />
                </IconButton>
              </Tooltip>
            </span>
          </Fade>
        </Box>
        <Box
          flex={1}
          overflow="auto"
          ref={listRef}
          data-testid="buildListScroll"
        >
          <List>
            {loading && buildList.length === 0 ? (
              <SkeletonList />
            ) : error && buildList.length === 0 ? (
              <Typography
                variant="subtitle1"
                align="center"
                color="error"
                sx={{ padding: 2, overflowWrap: "anywhere" }}
                data-testid="buildListError"
              >
                {t("builds.loadFailed")}
              </Typography>
            ) : buildList.length === 0 ? (
              <Typography
                variant="subtitle1"
                align="center"
                color="textSecondary"
                sx={{ padding: 2, overflowWrap: "anywhere" }}
                data-testid="buildListEmpty"
              >
                {searchQuery
                  ? t("builds.noMatch", { search: searchQuery })
                  : t("builds.empty")}
              </Typography>
            ) : (
              buildList.map((build, index) => (
                <React.Fragment key={build.id}>
                  <ListItemButton
                    {...staggered(index, buildList.length)}
                    selected={selectedBuild?.id === build.id}
                    onClick={() => selectBuildCalback(build.id)}
                    classes={{
                      root: classes.listItem,
                    }}
                  >
                    <Checkbox
                      edge="start"
                      size="small"
                      checked={selectedIds.includes(build.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleSelect(build.id)}
                    />
                    <ListItemText
                      disableTypography
                      sx={{ my: 0 }}
                      primary={
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            style={{ wordWrap: "break-word" }}
                          >
                            {`#${build.number} ${build.ciBuildId || ""}`}
                          </Typography>
                          <BuildStatusChip status={build.status} />
                        </Box>
                      }
                      secondary={
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.25,
                            mt: 0.5,
                          }}
                        >
                          <Tooltip title={build.branchName}>
                            <Typography
                              noWrap
                              sx={{
                                fontFamily: tokens.mono,
                                fontSize: 12.5,
                                color: "text.primary",
                              }}
                            >
                              {build.branchName}
                            </Typography>
                          </Tooltip>
                          <Typography variant="caption" color="textSecondary">
                            {`${t("builds.summary", {
                              changed: build.unresolvedCount,
                              passed: build.passedCount,
                            })}${
                              build.failedCount
                                ? t("builds.summaryFailed", {
                                    count: build.failedCount,
                                  })
                                : ""
                            } · ${formatDate(build.updatedAt ?? build.createdAt)}`}
                          </Typography>
                        </Box>
                      }
                    />

                    <ListItemSecondaryAction
                      className={classes.listItemSecondaryAction}
                    >
                      <IconButton
                        onClick={(event) => handleMenuClick(event, build)}
                        size="large"
                      >
                        <MoreVert />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItemButton>
                  {build.isRunning && <LinearProgress />}
                </React.Fragment>
              ))
            )}
          </List>
        </Box>
      </Box>
      <Box height="9%">
        <Grid container justifyContent="center">
          <Grid item>
            <Pagination
              size="small"
              defaultPage={1}
              page={paginationPage}
              count={Math.ceil(total / take)}
              onChange={(event, page) => handlePaginationChange(page)}
            />
          </Grid>
        </Grid>
      </Box>

      {menuBuild && (
        <Menu
          anchorEl={anchorEl}
          open={!!menuBuild && !!anchorEl}
          onClose={handleMenuClose}
        >
          {menuBuild.isRunning && (
            <MenuItem
              onClick={() => {
                buildsService
                  .update(menuBuild.id, { isRunning: false })
                  .then(() =>
                    enqueueSnackbar(`${menuBuild.id} finished`, {
                      variant: "success",
                    }),
                  )
                  .catch((err) =>
                    enqueueSnackbar(err, {
                      variant: "error",
                    }),
                  );
                handleMenuClose();
              }}
            >
              {t("builds.stop")}
            </MenuItem>
          )}
          {/* the menu closes, the build stays selected for the dialog */}
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              toggleEditDialogOpen();
            }}
          >
            {t("builds.editCiBuild")}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              toggleDeleteDialogOpen();
            }}
          >
            {t("builds.delete")}
          </MenuItem>
        </Menu>
      )}
      {menuBuild && (
        <BaseModal
          open={editDialogOpen}
          title={t("builds.editTitle")}
          submitButtonText={t("builds.edit")}
          onCancel={toggleEditDialogOpen}
          content={
            <React.Fragment>
              <Typography>
                {t("builds.editText", {
                  number: menuBuild.number || menuBuild.id,
                })}
              </Typography>
              <TextValidator
                name="newCiBuildId"
                validators={["minStringLength:2"]}
                errorMessages={[t("validation.twoCharacters")]}
                margin="dense"
                id="name"
                label={t("builds.newCiBuildId")}
                type="text"
                fullWidth
                required
                value={newCiBuildId}
                inputProps={{
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    setNewCiBuildId(event.target.value),
                  "data-testid": "newCiBuildId",
                }}
              />
            </React.Fragment>
          }
          onSubmit={() => {
            buildsService
              .update(menuBuild.id, {
                ciBuildId: newCiBuildId,
              })
              .then(() => {
                toggleEditDialogOpen();
              })
              .catch((err) =>
                enqueueSnackbar(err, {
                  variant: "error",
                }),
              );
            handleMenuClose();
          }}
        />
      )}
      {menuBuild && (
        <BaseModal
          open={deleteDialogOpen}
          title={t("builds.deleteTitle")}
          submitButtonText={t("builds.delete")}
          onCancel={toggleDeleteDialogOpen}
          content={
            <Typography>
              {t("builds.deleteConfirm", {
                number: menuBuild.number || menuBuild.id,
              })}
            </Typography>
          }
          onSubmit={() => {
            deleteBuild(buildDispatch, menuBuild.id)
              .then(() => {
                toggleDeleteDialogOpen();
                enqueueSnackbar(
                  t("builds.deleted", {
                    number: menuBuild.number || menuBuild.id,
                  }),
                  {
                    variant: "success",
                  },
                );
              })
              .then(() => {
                const lastPage = Math.max(1, Math.ceil((total - 1) / take));
                handlePaginationChange(Math.min(paginationPage, lastPage));
              })
              .then(() => {
                if (menuBuild.id === selectedBuild?.id) {
                  selectBuildCalback();
                }
              })
              .catch((err) =>
                enqueueSnackbar(err, {
                  variant: "error",
                }),
              );
            handleMenuClose();
          }}
        />
      )}
      <BaseModal
        open={bulkDeleteDialogOpen}
        title={t("builds.deleteManyTitle")}
        submitButtonText={t("builds.delete")}
        onCancel={() => setBulkDeleteDialogOpen(false)}
        content={
          <>
            <Typography>
              {t("builds.deleteManyConfirm", { count: selectedIds.length })}
            </Typography>
            <Typography>{t("builds.deleteManyHint")}</Typography>
          </>
        }
        onSubmit={handleBulkDelete}
      />
    </>
  );
};

export default React.memo(BuildList);
