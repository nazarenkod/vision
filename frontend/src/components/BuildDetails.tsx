import React from "react";
import { Typography, Box, LinearProgress } from "@mui/material";
import { BuildStatusChip } from "./BuildStatusChip";
import { useBuildState, useTestRunState } from "../contexts";
import { LOCATOR_BUILD_DETAILS } from "../constants/help";
import { Tooltip } from "./Tooltip";
import { motion, tokens } from "../theme";
import { CountUp } from "./motion/useCountUp";
import { useT } from "../i18n";

/** Build header: identity, status and a bar of how the screenshots came out. */
const BuildDetails: React.FunctionComponent = () => {
  const { selectedBuild } = useBuildState();
  const { testRuns } = useTestRunState();
  const { t, tx, formatDate } = useT();
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
          {formatDate(selectedBuild.createdAt)}
          {selectedBuild.updatedAt &&
            t("builds.lastRun", { date: formatDate(selectedBuild.updatedAt) })}
        </Typography>
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
            {tx(
              "builds.total",
              {
                value: (
                  <b style={{ color: tokens.text }}>
                    <CountUp value={total} />
                  </b>
                ),
              },
              { count: total },
            )}
          </span>
          <span>
            {tx(
              "builds.unresolved",
              {
                value: (
                  <b style={{ color: tokens.text }}>
                    <CountUp value={selectedBuild.unresolvedCount} />
                  </b>
                ),
              },
              { count: selectedBuild.unresolvedCount },
            )}
          </span>
          <span>
            {tx(
              "builds.failed",
              {
                value: (
                  <b style={{ color: tokens.text }}>
                    <CountUp value={selectedBuild.failedCount} />
                  </b>
                ),
              },
              { count: selectedBuild.failedCount },
            )}
          </span>
          <span>
            {tx(
              "builds.passed",
              {
                value: (
                  <b style={{ color: tokens.text }}>
                    <CountUp value={selectedBuild.passedCount} />
                  </b>
                ),
              },
              { count: selectedBuild.passedCount },
            )}
          </span>
          {a11yNew > 0 && (
            <span>
              {tx(
                "builds.a11yNew",
                {
                  value: (
                    <b style={{ color: tokens.status.changed.fg }}>
                      <CountUp value={a11yNew} />
                    </b>
                  ),
                },
                { count: a11yNew },
              )}
            </span>
          )}
        </Box>
      </Box>
      {selectedBuild.isRunning && <LinearProgress />}
    </Box>
  );
};

export default BuildDetails;
