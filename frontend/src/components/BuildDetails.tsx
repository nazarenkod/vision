import React from "react";
import { Typography, Box, LinearProgress } from "@mui/material";
import { BuildStatusChip } from "./BuildStatusChip";
import { useBuildState } from "../contexts";
import { LOCATOR_BUILD_DETAILS } from "../constants/help";
import { Tooltip } from "./Tooltip";
import { motion, tokens } from "../theme";
import { useT } from "../i18n";
import { buildPeriod } from "../_helpers/buildPeriod.helper";

/**
 * Build header: identity, when it ran and a bar of how the screenshots came
 * out. The numbers are the Overview's tiles and the tabs' badges (REQ-031-15).
 */
const BuildDetails: React.FunctionComponent<{
  // what can be done with the build: Report, Review (031)
  actions?: React.ReactNode;
}> = ({ actions }) => {
  const { selectedBuild } = useBuildState();
  const { t, formatDate } = useT();
  const buildNumber = React.useMemo(
    () => `#${selectedBuild?.number} ${selectedBuild?.ciBuildId || ""}`,
    [selectedBuild?.number, selectedBuild?.ciBuildId],
  );

  if (!selectedBuild) {
    return null;
  }

  const total =
    selectedBuild.unresolvedCount +
    selectedBuild.failedCount +
    selectedBuild.passedCount;
  const share = (count: number) => (total ? `${(count * 100) / total}%` : "0%");

  return (
    <Box
      id={LOCATOR_BUILD_DETAILS}
      sx={{
        px: 3,
        pt: 2.5,
        pb: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px 14px",
        }}
      >
        <Tooltip title={buildNumber}>
          <Typography variant="h5" component="h1" noWrap sx={{ maxWidth: 260 }}>
            {buildNumber}
          </Typography>
        </Tooltip>
        <Tooltip title={selectedBuild.branchName}>
          <Typography
            noWrap
            sx={{
              fontFamily: tokens.mono,
              fontSize: 16,
              color: tokens.textSecondary,
              maxWidth: 420,
            }}
          >
            {selectedBuild.branchName}
          </Typography>
        </Tooltip>
        <BuildStatusChip status={selectedBuild.status} />
        <Typography
          variant="body2"
          color="textSecondary"
          data-testid="buildPeriod"
        >
          {buildPeriod(selectedBuild.createdAt, selectedBuild.updatedAt, {
            formatDate,
            t,
          })}
        </Typography>
        {actions && (
          <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>{actions}</Box>
        )}
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Box
          // a new build fills its bar again (REQ-018-23)
          key={selectedBuild.id}
          data-testid="buildStatusBar"
          role="img"
          aria-label={t("builds.statusBar", {
            unresolved: selectedBuild.unresolvedCount,
            failed: selectedBuild.failedCount,
            passed: selectedBuild.passedCount,
          })}
          sx={{
            display: "flex",
            height: 6,
            borderRadius: 999,
            overflow: "hidden",
            gap: "2px",
            bgcolor: tokens.subtle,
            animation: `v-fill ${motion.fill}ms ${motion.easing} both ${motion.fast}ms`,
          }}
        >
          <Box
            sx={{
              width: share(selectedBuild.unresolvedCount),
              bgcolor: tokens.status.changed.bar,
            }}
          />
          <Box
            sx={{
              width: share(selectedBuild.failedCount),
              bgcolor: tokens.status.failed.bar,
            }}
          />
          <Box
            sx={{
              width: share(selectedBuild.passedCount),
              bgcolor: tokens.status.passed.bar,
            }}
          />
        </Box>
      </Box>
      {selectedBuild.isRunning && <LinearProgress />}
    </Box>
  );
};

export default BuildDetails;
