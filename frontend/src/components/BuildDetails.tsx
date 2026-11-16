import React from "react";
import { Typography, Box, LinearProgress } from "@mui/material";
import { BuildStatusChip } from "./BuildStatusChip";
import { useBuildState } from "../contexts";
import { LOCATOR_BUILD_DETAILS } from "../constants/help";
import { Tooltip } from "./Tooltip";
import { tokens } from "../theme";
import { useT } from "../i18n";
import { buildDuration, buildPeriod } from "../_helpers/buildPeriod.helper";

/**
 * Build header: identity and when it ran. How the screens came out is the
 * Overview's tiles and the tabs' badges (REQ-031-15); a bar of it only
 * repeated them (REQ-058-01).
 */
const BuildDetails: React.FunctionComponent<{
  // what can be done with the build: Report, Review (031)
  actions?: React.ReactNode;
  // the build's devices, after its time (REQ-048-06)
  devices?: React.ReactNode;
}> = ({ actions, devices }) => {
  const { selectedBuild } = useBuildState();
  const { t, formatDate } = useT();
  const buildNumber = React.useMemo(
    () => `#${selectedBuild?.number} ${selectedBuild?.ciBuildId || ""}`,
    [selectedBuild?.number, selectedBuild?.ciBuildId],
  );

  if (!selectedBuild) {
    return null;
  }

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
        {actions && (
          <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>{actions}</Box>
        )}
      </Box>

      {/* when it ran, then on which devices (REQ-048-06) */}
      <Box
        data-testid="buildMeta"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          // the time beside the first line of devices when they wrap
          alignItems: "flex-start",
          gap: "6px 14px",
          mt: -0.5,
          minWidth: 0,
        }}
      >
        <Typography
          variant="body2"
          color="textSecondary"
          data-testid="buildPeriod"
        >
          {[
            buildPeriod(selectedBuild.createdAt, selectedBuild.updatedAt, {
              formatDate,
              t,
            }),
            // how long it ran, without counting it up from the times (REQ-039-04)
            buildDuration(selectedBuild.createdAt, selectedBuild.updatedAt, t),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Typography>
        {devices && (
          <Box
            // stays beside the time; its devices wrap inside
            sx={{
              flex: "1 1 240px",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              minWidth: 0,
              "&::before": {
                flexShrink: 0,
                content: '""',
                width: "1px",
                height: 16,
                mt: "4px",
                bgcolor: tokens.border,
              },
            }}
          >
            {devices}
          </Box>
        )}
      </Box>

      {selectedBuild.isRunning && <LinearProgress />}
    </Box>
  );
};

export default BuildDetails;
