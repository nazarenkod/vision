import React from "react";
import { Typography, Box, LinearProgress } from "@mui/material";
import { BuildStatusChip } from "./BuildStatusChip";
import { formatDateTime } from "../_helpers/format.helper";
import { useBuildState, useTestRunState } from "../contexts";
import { LOCATOR_BUILD_DETAILS } from "../constants/help";
import { Tooltip } from "./Tooltip";
import { motion, tokens } from "../theme";
import { CountUp } from "./motion/useCountUp";

/** Build header: identity, status and a bar of how the screenshots came out. */
const BuildDetails: React.FunctionComponent = () => {
  const { selectedBuild } = useBuildState();
  const { testRuns } = useTestRunState();
  const buildNumber = React.useMemo(
    () => `#${selectedBuild?.number} ${selectedBuild?.ciBuildId || ""}`,
    [selectedBuild?.number, selectedBuild?.ciBuildId],
  );
  const a11yNew = React.useMemo(
    () => testRuns.reduce((sum, run) => sum + (run.a11yNewCount ?? 0), 0),
    [testRuns],
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
        <Typography variant="body2" color="textSecondary">
          {formatDateTime(selectedBuild.createdAt)}
          {selectedBuild.updatedAt &&
            ` · last run ${formatDateTime(selectedBuild.updatedAt)}`}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Box
          // a new build fills its bar again (REQ-018-23)
          key={selectedBuild.id}
          data-testid="buildStatusBar"
          role="img"
          aria-label={`${selectedBuild.unresolvedCount} unresolved, ${selectedBuild.failedCount} failed, ${selectedBuild.passedCount} passed`}
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
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 20px",
            fontSize: 13,
            color: tokens.textSecondary,
            "& b": { fontVariantNumeric: "tabular-nums", fontWeight: 650 },
          }}
        >
          <span>
            <b style={{ color: tokens.text }}>
              <CountUp value={total} />
            </b>{" "}
            total
          </span>
          <span>
            <b style={{ color: tokens.text }}>
              <CountUp value={selectedBuild.unresolvedCount} />
            </b>{" "}
            unresolved
          </span>
          <span>
            <b style={{ color: tokens.text }}>
              <CountUp value={selectedBuild.failedCount} />
            </b>{" "}
            failed
          </span>
          <span>
            <b style={{ color: tokens.text }}>
              <CountUp value={selectedBuild.passedCount} />
            </b>{" "}
            passed
          </span>
          {a11yNew > 0 && (
            <span>
              <b style={{ color: tokens.status.changed.fg }}>
                <CountUp value={a11yNew} />
              </b>{" "}
              new accessibility issues
            </span>
          )}
        </Box>
      </Box>
      {selectedBuild.isRunning && <LinearProgress />}
    </Box>
  );
};

export default BuildDetails;
