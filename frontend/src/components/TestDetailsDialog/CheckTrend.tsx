import React from "react";
import { Box } from "@mui/material";
import { TrendPoint } from "../../types";
import { TestStatus } from "../../types/testStatus";
import { testRunService } from "../../services";
import { tokens } from "../../theme";
import { Tooltip } from "../Tooltip";
import { labelOf, useT } from "../../i18n";

const WIDTH = 160;
const HEIGHT = 24;
const GAP = 2;
const MAX_BAR = 8;
// a run without changes still shows as a stub, so a bar is never missing
const MIN_BAR = 3;

/** The bar's colour and how strongly it shows, by the run's status. */
const look = (status: string): { color: string; opacity: number } => {
  switch (status) {
    case TestStatus.ok:
      // fine, but nobody decided anything: the passed colour, faint
      return { color: tokens.status.passed.bar, opacity: 0.35 };
    case TestStatus.approved:
    case TestStatus.autoApproved:
      return { color: tokens.status.passed.bar, opacity: 1 };
    case TestStatus.unresolved:
      return { color: tokens.status.changed.bar, opacity: 1 };
    case TestStatus.new:
      return { color: tokens.status.new.bar, opacity: 1 };
    case TestStatus.failed:
      return { color: tokens.status.failed.bar, opacity: 1 };
    default:
      return { color: tokens.status.neutral.bar, opacity: 1 };
  }
};

/**
 * How this check went in its last runs, up to the one on screen (REQ-046-08):
 * a bar per run, as high as its changed share, coloured by its status, the
 * current one outlined. Hovering a bar names its build, share, status and
 * date (REQ-046-09).
 */
export const CheckTrend: React.FunctionComponent<{
  testRunId: string;
  /** the run on screen as it is now: a decision made here shows at once */
  current?: Pick<TrendPoint, "status" | "diffPercent">;
}> = ({ testRunId, current }) => {
  const { t, formatNumber, formatDate } = useT();
  // undefined while loading, null when the trend could not be loaded
  const [points, setPoints] = React.useState<TrendPoint[] | null>();

  React.useEffect(() => {
    let live = true;
    setPoints(undefined);
    Promise.resolve()
      .then(() => testRunService.getTrend(testRunId))
      .then((trend) => live && setPoints(Array.isArray(trend) ? trend : null))
      // the trend only adds to the review: without it the header goes on
      .catch(() => live && setPoints(null));
    return () => {
      live = false;
    };
  }, [testRunId]);

  if (points === null || points?.length === 0) return null;
  // the width is kept while loading, so the header does not jump
  if (!points)
    return (
      <Box
        data-testid="checkTrendLoading"
        sx={{ width: WIDTH, height: HEIGHT, flexShrink: 0 }}
      />
    );

  const runs = points.map((point) =>
    point.id === testRunId && current ? { ...point, ...current } : point,
  );
  const bar = Math.max(
    1,
    Math.min(
      MAX_BAR,
      Math.floor((WIDTH - GAP * (runs.length - 1)) / runs.length),
    ),
  );
  const top = Math.max(...runs.map((run) => run.diffPercent || 0));
  const heightOf = (diff: number) =>
    top > 0
      ? Math.max(MIN_BAR, Math.round(((diff || 0) / top) * HEIGHT))
      : MIN_BAR;
  const share = (value: number) =>
    formatNumber(Math.round((value || 0) * 100) / 100);

  return (
    <Box
      data-testid="checkTrend"
      role="img"
      aria-label={t("compare.trend", { count: runs.length })}
      sx={{
        display: "flex",
        alignItems: "flex-end",
        gap: `${GAP}px`,
        width: WIDTH,
        height: HEIGHT,
        flexShrink: 0,
      }}
    >
      {runs.map((run) => {
        const isCurrent = run.id === testRunId;
        const { color, opacity } = look(run.status);
        return (
          <Tooltip
            key={run.id}
            title={t("compare.trendRun", {
              build: run.buildNumber == null ? "—" : `#${run.buildNumber}`,
              diff: share(run.diffPercent),
              status: labelOf(t, "testStatus", run.status),
              date: formatDate(run.createdAt, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }),
            })}
          >
            {/* the whole column takes the pointer: a stub of 3 px is hard to hit */}
            <Box
              data-testid="trendBar"
              data-status={run.status}
              data-current={isCurrent || undefined}
              sx={{
                width: bar,
                height: "100%",
                display: "flex",
                alignItems: "flex-end",
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: "100%",
                  height: heightOf(run.diffPercent),
                  bgcolor: color,
                  opacity: isCurrent ? 1 : opacity,
                  borderRadius: 0,
                  outline: isCurrent ? `1px solid ${tokens.text}` : undefined,
                  outlineOffset: isCurrent ? "1px" : undefined,
                }}
              />
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};
