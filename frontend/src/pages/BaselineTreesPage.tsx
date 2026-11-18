import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { useHotkeys } from "react-hotkeys-hook";
import { testVariationService } from "../services";
import { TestVariation } from "../types";
import { useT } from "../i18n";
import { tokens, type } from "../theme";
import { DeviceTags } from "../components/DeviceTags";
import { useProjectFromAddress } from "../contexts";
import { BaselineTreePair } from "../components/BaselineTrees/BaselineTreePair";
import { useBaselineTrees } from "../components/BaselineTrees/useBaselineTrees";
import {
  baselineTreesLocation,
  historyLocation,
  readHistoryPlace,
} from "../_helpers/baselineTrees.helper";

/** A baseline's two versions with their UI trees on the whole window, with an address to share (REQ-079-17…19). */
const BaselineTreesPage: React.FunctionComponent = () => {
  const { t } = useT();
  const { testVariationId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const place = readHistoryPlace(location.search);

  const [testVariation, setTestVariation] =
    React.useState<TestVariation | null>();
  useProjectFromAddress(testVariation?.projectId);
  React.useEffect(() => {
    let live = true;
    setTestVariation(undefined);
    testVariationService
      .getDetails(testVariationId)
      .then((found) => live && setTestVariation(found ?? null))
      // no access answers as no such baseline: the history says the same (042)
      .catch(() => live && setTestVariation(null));
    return () => {
      live = false;
    };
  }, [testVariationId]);

  const baselines = testVariation?.baselines ?? [];
  const at = baselines.findIndex((baseline) => baseline.id === place.baseline);
  // a version that is gone: the newest, and the link's element is looked for there
  const pickedIndex = Math.max(0, at);
  const picked = baselines[pickedIndex];
  const before = baselines[pickedIndex + 1];
  const trees = useBaselineTrees(testVariationId, picked, before, !!picked);

  // back to the history on the same pair, the trees and the element (REQ-079-19)
  const back = () =>
    navigate(
      historyLocation(testVariationId, {
        ...place,
        baseline: picked?.id,
        view: "tree",
      }),
    );
  useHotkeys("esc", back, [testVariationId, location.search, picked?.id]);

  if (testVariation === undefined)
    return (
      <Box sx={{ p: 3 }} role="status">
        <LinearProgress />
      </Box>
    );
  if (testVariation === null || !picked)
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" data-testid="baselineTreesFailed">
          {t("inspect.failed")}
        </Alert>
      </Box>
    );

  return (
    <Box
      data-testid="baselineTreesPage"
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
          data-testid="baselineTreesBack"
        >
          {t("baselines.backToHistory")}
        </Button>
        <Typography
          component="h1"
          sx={{ fontSize: type.title, fontWeight: 600, minWidth: 0 }}
        >
          {t("baselines.treesTitle", { name: testVariation.name })}
        </Typography>
        <DeviceTags parts={testVariation} dense />
      </Box>
      <Box sx={{ flex: 1, p: 2, minWidth: 0 }}>
        {place.baseline && at < 0 && (
          <Alert severity="info" sx={{ mb: 2, py: 0 }}>
            {t("tree.notFound")}
          </Alert>
        )}
        <BaselineTreePair
          fill
          selected={picked}
          previous={before}
          trees={trees}
          chosen={place.node}
          onChoose={(node) =>
            navigate(
              baselineTreesLocation(testVariationId, {
                ...place,
                baseline: picked.id,
                node,
              }),
              { replace: true },
            )
          }
        />
      </Box>
    </Box>
  );
};

export default BaselineTreesPage;
