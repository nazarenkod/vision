import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { useHotkeys } from "react-hotkeys-hook";
import { buildsService, insightsService, testRunService } from "../services";
import { hasUiTree, TestRun } from "../types";
import {
  A11yReport,
  InspectorNode,
  StructureInfo,
  TreeSide,
} from "../types/insights";
import { useT } from "../i18n";
import { radius, tokens, type } from "../theme";
import { DeviceTags } from "../components/DeviceTags";
import { Point, TreeScreen } from "../components/TreeScreen";
import { ElementsTab } from "../components/TestDetailsDialog/ElementsTab";
import {
  treeOf,
  useInspectorTrees,
} from "../components/TestDetailsDialog/useInspectorTrees";
import {
  comparisonLocation,
  inspectorLocation,
  nodeAt,
  readTreePlace,
  sameNode,
  treeOutlines,
} from "../_helpers/treeInspector.helper";

const NARROW = "@media (max-width: 1023.98px)";

/** One check's UI tree on the whole window, with an address to share (REQ-062-31…37). */
const InspectorPage: React.FunctionComponent = () => {
  const { t } = useT();
  const { testRunId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const place = readTreePlace(location.search);

  const [testRun, setTestRun] = React.useState<TestRun | null>();
  const [projectId, setProjectId] = React.useState<string>();
  const [structure, setStructure] = React.useState<StructureInfo | null>();
  const [report, setReport] = React.useState<A11yReport | null>();
  React.useEffect(() => {
    let live = true;
    setTestRun(undefined);
    testRunService
      .getDetails(testRunId)
      .then(async (run) => {
        if (!live) return;
        setTestRun(run);
        // the comparison lives on its project's page; without it Back goes back in history
        const build = await buildsService
          .getDetails(run.buildId)
          .catch(() => null);
        if (live && build) setProjectId(build.projectId);
      })
      // no access answers as no such check: the comparison says the same (042)
      .catch(() => live && setTestRun(null));
    insightsService
      .getStructure(testRunId)
      .then((found) => live && setStructure(found))
      .catch(() => live && setStructure(null));
    insightsService
      .getA11y(testRunId)
      .then((found) => live && setReport(found))
      .catch(() => live && setReport(null));
    return () => {
      live = false;
    };
  }, [testRunId]);

  const trees = useInspectorTrees(testRunId, !!testRun);
  const nodesOf = (side: TreeSide): InspectorNode[] =>
    treeOf(trees[side])?.nodes ?? [];
  const [pointed, setPointed] = React.useState<{
    side: TreeSide;
    index: number;
  }>();
  const chosen =
    place.node !== undefined
      ? { side: place.side, index: place.node }
      : undefined;
  // the address holds the tree and the node, so the page can be shared (REQ-062-33)
  const go = (side: TreeSide, node?: number) =>
    navigate(inspectorLocation(testRunId, side, node), { replace: true });
  const notFound =
    place.node !== undefined &&
    trees[place.side].status === "ready" &&
    !nodesOf(place.side)[place.node];

  const back = () => {
    if (!testRun || !projectId) return navigate(-1);
    navigate(
      comparisonLocation(
        projectId,
        testRun.buildId,
        testRun.id,
        place.side,
        notFound ? undefined : place.node,
      ),
    );
  };
  useHotkeys("esc", back, [testRun, projectId, location.search]);

  if (testRun === undefined)
    return (
      <Box sx={{ p: 3 }} role="status">
        <LinearProgress />
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          {t("inspect.loading")}
        </Typography>
      </Box>
    );
  if (testRun === null)
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" data-testid="inspectFailed">
          {t("inspect.failed")}
        </Alert>
      </Box>
    );

  const trees2 = {
    current: nodesOf("current"),
    baseline: nodesOf("baseline"),
  };
  const outlines = (side: TreeSide) =>
    treeOutlines(side, trees2, notFound ? undefined : chosen, pointed);
  const hover = (side: TreeSide) => (point: Point | null) => {
    const node = nodeAt(point, nodesOf(side));
    setPointed(node ? { side, index: node.index } : undefined);
  };
  const pick = (side: TreeSide) => (point: Point) => {
    const node = nodeAt(point, nodesOf(side));
    if (node) go(side, node.index);
  };

  return (
    <Box
      data-testid="inspectorPage"
      sx={{
        minHeight: "100vh",
        boxSizing: "border-box",
        bgcolor: tokens.ground,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        component="header"
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          px: 2,
          py: 1.25,
          bgcolor: tokens.surface,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <Button
          startIcon={<ArrowBack />}
          onClick={back}
          data-testid="inspectBack"
        >
          {t("inspect.back")}
        </Button>
        <Typography
          component="h1"
          sx={{ fontSize: type.title, fontWeight: 600, minWidth: 0 }}
        >
          {t("inspect.title", { name: testRun.name })}
        </Typography>
        <DeviceTags parts={testRun} dense />
      </Box>
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 3,
          p: 2,
          minWidth: 0,
          // a narrow window: the screens, the tree and the card one under another (REQ-062-36)
          [NARROW]: { flexDirection: "column", alignItems: "stretch" },
        }}
      >
        <Box
          sx={{
            flex: "999 1 480px",
            minWidth: 0,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 3,
            p: 2,
            borderRadius: radius.card,
            background: tokens.lightbox,
          }}
        >
          {testRun.baselineName && (
            <TreeScreen
              title={t("tree.baseline")}
              imageName={testRun.baselineName}
              outlines={outlines("baseline")}
              onPoint={hover("baseline")}
              onPick={pick("baseline")}
            />
          )}
          <TreeScreen
            title={t("tree.current")}
            imageName={testRun.imageName}
            outlines={outlines("current")}
            onPoint={hover("current")}
            onPick={pick("current")}
          />
        </Box>
        <Box
          sx={{
            flex: "1 1 400px",
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box",
            p: 2,
            bgcolor: tokens.surface,
            border: `1px solid ${tokens.border}`,
            borderRadius: radius.card,
            display: "flex",
            flexDirection: "column",
            // beside the screens the tree fills the window's height; under them it keeps its own
            height: "calc(100vh - 120px)",
            minHeight: 480,
            overflow: "auto",
            [NARROW]: { height: "auto" },
          }}
        >
          <ElementsTab
            fill
            hasTree={hasUiTree(testRun)}
            testRunId={testRun.id}
            trees={trees}
            structure={structure}
            report={report}
            side={place.side}
            onSideChange={(side) => {
              const now =
                place.node === undefined
                  ? undefined
                  : nodesOf(place.side)[place.node];
              go(side, sameNode(now, nodesOf(side))?.index);
              setPointed(undefined);
            }}
            chosen={notFound ? undefined : place.node}
            onChoose={(index) => go(place.side, index)}
            pointed={pointed?.side === place.side ? pointed.index : undefined}
            onPoint={(index) =>
              setPointed(
                index === undefined ? undefined : { side: place.side, index },
              )
            }
            notFound={notFound}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default InspectorPage;
