import React, { useEffect } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import BuildList from "../components/BuildList";
import ProjectSelect from "../components/ProjectSelect";
import TestRunList from "../components/TestRunList";
import BuildDetails from "../components/BuildDetails";
import { TestDetailsDialog } from "../components/TestDetailsDialog";
import { ChangeGroups } from "../components/ChangeGroups";
import { A11ySummary } from "../components/A11ySummary";
import { StatusPill } from "../components/StatusPill";
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
import { buildProjectPageUrl } from "../_helpers/route.helpers";
import { tokens } from "../theme";
import { useT } from "../i18n";

type BuildView = "changes" | "all" | "a11y";
const VIEW_KEY = "vrt.buildView";

const readView = (): BuildView => {
  try {
    const value = localStorage.getItem(VIEW_KEY);
    return value === "all" || value === "a11y" ? value : "changes";
  } catch {
    return "changes";
  }
};

const ProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const helpDispatch = useHelpDispatch();
  const { selectedBuild } = useBuildState();
  const { testRuns } = useTestRunState();
  const [view, setView] = React.useState<BuildView>(readView);
  const { t } = useT();

  useEffect(() => {
    setHelpSteps(helpDispatch, PROJECT_PAGE_STEPS);
  });

  const changeView = (next: BuildView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // the choice is a convenience only
    }
  };

  const a11yNew = testRuns.reduce(
    (sum, run) => sum + (run.a11yNewCount ?? 0),
    0,
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
          <BuildDetails />
          {selectedBuild && (
            <Tabs
              value={view}
              onChange={(_, next) => changeView(next)}
              sx={{ px: 3, borderBottom: `1px solid ${tokens.border}` }}
              aria-label={t("builds.views")}
            >
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
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              position: "relative",
            }}
          >
            {selectedBuild && view === "changes" && (
              <ChangeGroups buildId={selectedBuild.id} />
            )}
            {selectedBuild && view === "a11y" && (
              <A11ySummary buildId={selectedBuild.id} />
            )}
            {/* kept mounted: it loads the build's runs and the order the review steps through */}
            <Box
              id={LOCATOR_PROJECT_PAGE_TEST_RUN_LIST}
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
      <TestDetailsDialog />
    </>
  );
};

export default ProjectPage;
