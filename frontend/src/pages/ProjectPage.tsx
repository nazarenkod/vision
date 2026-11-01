import React, { useEffect } from "react";
import { Box, Button, Tab, Tabs } from "@mui/material";
import { DescriptionOutlined, VisibilityOutlined } from "@mui/icons-material";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import BuildList from "../components/BuildList";
import ProjectSelect from "../components/ProjectSelect";
import TestRunList from "../components/TestRunList";
import BuildDetails from "../components/BuildDetails";
import { TestDetailsDialog } from "../components/TestDetailsDialog";
import { ChangeGroups } from "../components/ChangeGroups";
import { A11ySummary } from "../components/A11ySummary";
import { StatusPill } from "../components/StatusPill";
import {
  BuildOverview,
  OverviewActions,
  useBuildOverview,
} from "../components/BuildOverview";
import { useBuildGroups } from "../components/BuildOverview/useBuildGroups";
import { ReportDialog } from "../components/BuildReport/ReportDialog";
import {
  useHelpDispatch,
  setHelpSteps,
  useBuildState,
  useTestRunState,
} from "../contexts";
import {
  PROJECT_PAGE_STEPS,
  LOCATOR_PROJECT_PAGE_BUILD_LIST,
  LOCATOR_PROJECT_PAGE_SELECT_PROJECT,
  LOCATOR_PROJECT_PAGE_TEST_RUN_LIST,
} from "../constants";
import {
  BuildTab,
  buildProjectPageUrl,
  buildTestRunLocation,
  getQueryParams,
} from "../_helpers/route.helpers";
import {
  queueIds,
  queueParam,
  waitingInOrder,
} from "../_helpers/reviewQueue.helper";
import { tokens } from "../theme";
import { useT } from "../i18n";

const ProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const helpDispatch = useHelpDispatch();
  const { selectedBuild } = useBuildState();
  const { testRuns } = useTestRunState();
  // the tab lives in the address: a link opens it, a new build opens Overview (REQ-031-01, -02)
  const view: BuildTab = getQueryParams(location.search).tab ?? "overview";
  const { t } = useT();
  const groups = useBuildGroups(selectedBuild?.id, testRuns);
  const { overview, failed } = useBuildOverview(selectedBuild?.id);
  const [reportOpen, setReportOpen] = React.useState(false);

  useEffect(() => {
    setHelpSteps(helpDispatch, PROJECT_PAGE_STEPS);
  });

  const actions: OverviewActions = React.useMemo(
    () => ({
      openTab: (tab, status) =>
        selectedBuild &&
        navigate(
          buildTestRunLocation(selectedBuild.id, undefined, { tab, status }),
        ),
      openQueue: (key, runId) => {
        if (!selectedBuild) return;
        const ids = queueIds(key, testRuns, groups ?? []);
        const first = runId ?? ids[0];
        if (!first) return;
        navigate(
          buildTestRunLocation(selectedBuild.id, first, {
            tab: view,
            queue: queueParam(key),
          }),
        );
      },
    }),
    [selectedBuild, navigate, testRuns, groups, view],
  );

  const changeView = (next: BuildTab) => actions.openTab(next);

  const a11yNew = testRuns.reduce(
    (sum, run) => sum + (run.a11yNewCount ?? 0),
    0,
  );
  const waiting = React.useMemo(
    () => waitingInOrder(testRuns, groups ?? []).length,
    [testRuns, groups],
  );

  return (
    <>
      <Box sx={{ height: "100%", display: "flex" }}>
        <Box
          sx={{
            width: 320,
            flexShrink: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            bgcolor: tokens.surface,
            borderRight: `1px solid ${tokens.border}`,
          }}
        >
          <Box id={LOCATOR_PROJECT_PAGE_SELECT_PROJECT} sx={{ px: 1, pt: 1 }}>
            <ProjectSelect
              projectId={projectId}
              onProjectSelect={(id) => navigate(buildProjectPageUrl(id))}
            />
          </Box>
          <Box flex={1} minHeight={0} id={LOCATOR_PROJECT_PAGE_BUILD_LIST}>
            <BuildList />
          </Box>
        </Box>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <BuildDetails
            hideCounts={view === "overview"}
            actions={
              selectedBuild && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DescriptionOutlined />}
                    data-testid="openReport"
                    disabled={!overview}
                    onClick={() => setReportOpen(true)}
                  >
                    {t("overview.report")}
                  </Button>
                  {waiting > 0 && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<VisibilityOutlined />}
                      data-testid="reviewWaiting"
                      onClick={() => actions.openQueue({ kind: "all" })}
                    >
                      {t("overview.reviewN", { count: waiting })}
                    </Button>
                  )}
                </>
              )
            }
          />
          {selectedBuild && (
            <Tabs
              value={view}
              onChange={(_, next) => changeView(next)}
              sx={{ px: 3, borderBottom: `1px solid ${tokens.border}` }}
              aria-label={t("builds.views")}
            >
              <Tab value="overview" label={t("overview.tab")} />
              <Tab
                value="changes"
                label={
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    {t("builds.changes")}{" "}
                    {!!selectedBuild?.unresolvedCount && (
                      <StatusPill
                        tone="changed"
                        label={t("builds.toReview", {
                          count: selectedBuild.unresolvedCount,
                        })}
                      />
                    )}
                  </Box>
                }
              />
              <Tab
                value="all"
                label={t("builds.allTests", { count: testRuns.length })}
              />
              <Tab
                value="a11y"
                label={
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    {t("builds.accessibility")}{" "}
                    {a11yNew > 0 && (
                      <StatusPill
                        tone="changed"
                        label={t("builds.a11yNewPill", { count: a11yNew })}
                      />
                    )}
                  </Box>
                }
              />
            </Tabs>
          )}
          <Box
            // the tour points here: the list itself is hidden on the other tabs
            id={LOCATOR_PROJECT_PAGE_TEST_RUN_LIST}
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              position: "relative",
            }}
          >
            {selectedBuild && view === "overview" && (
              <BuildOverview
                overview={overview}
                failed={failed}
                actions={actions}
              />
            )}
            {selectedBuild && view === "changes" && (
              <ChangeGroups buildId={selectedBuild.id} />
            )}
            {selectedBuild && view === "a11y" && (
              <A11ySummary buildId={selectedBuild.id} />
            )}
            {/* kept mounted: it loads the build's runs and the order the review steps through */}
            <Box
              sx={
                !selectedBuild || view === "all"
                  ? { height: "100%" }
                  : {
                      // out of sight but sized: the data grid needs a height even while hidden
                      position: "absolute",
                      inset: 0,
                      visibility: "hidden",
                      // children that force visibility back on (grid icons, tooltips) stay unseen
                      opacity: 0,
                      zIndex: -1,
                      pointerEvents: "none",
                    }
              }
              aria-hidden={!!selectedBuild && view !== "all"}
            >
              <TestRunList />
            </Box>
          </Box>
        </Box>
      </Box>
      <TestDetailsDialog groups={groups} />
      {selectedBuild && overview && (
        <ReportDialog
          open={reportOpen}
          buildId={selectedBuild.id}
          overview={overview}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
};

export default ProjectPage;
