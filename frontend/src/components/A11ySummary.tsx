import React from "react";
import {
  Box,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { useTestRunState } from "../contexts";
import { buildTestRunLocation } from "../_helpers/route.helpers";
import { StatusPill } from "./StatusPill";
import { tokens } from "../theme";
import { CountUp } from "./motion/useCountUp";
import { staggered } from "./motion/Stagger";
import { EmptyState } from "./EmptyState";
import { deviceLabel } from "../_helpers/device.helper";
import { labelOf, useT } from "../i18n";

const Stat: React.FunctionComponent<{
  label: string;
  value: number;
  accent?: boolean;
}> = ({ label, value, accent }) => (
  <Box
    sx={{
      bgcolor: tokens.surface,
      border: `1px solid ${tokens.border}`,
      borderRadius: 3,
      px: 2,
      py: 1.5,
      display: "flex",
      flexDirection: "column",
      gap: 0.25,
      minWidth: 0,
    }}
  >
    <Typography variant="body2" color="textSecondary">
      {label}
    </Typography>
    <Typography
      sx={{
        fontSize: 24,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
        color: accent && value ? tokens.a11y : tokens.text,
      }}
    >
      <CountUp value={value} />
    </Typography>
  </Box>
);

/** Accessibility of the build, per screenshot that came with a UI tree. */
export const A11ySummary: React.FunctionComponent<{ buildId: string }> = ({
  buildId,
}) => {
  const { testRuns } = useTestRunState();
  const { t, tx } = useT();
  const checked = React.useMemo(
    () =>
      testRuns
        .filter((run) => run.buildId === buildId && run.a11yTotalCount != null)
        .sort(
          (a, b) =>
            (b.a11yNewCount ?? 0) - (a.a11yNewCount ?? 0) ||
            a.name.localeCompare(b.name),
        ),
    [testRuns, buildId],
  );
  const totalNew = checked.reduce(
    (sum, run) => sum + (run.a11yNewCount ?? 0),
    0,
  );
  const total = checked.reduce(
    (sum, run) => sum + (run.a11yTotalCount ?? 0),
    0,
  );
  const withTree = testRuns.filter((run) => run.buildId === buildId).length;

  if (!checked.length) {
    return (
      <EmptyState title={t("a11ySummary.empty")}>
        {tx("a11ySummary.emptyHint", {
          code: <code>.uiTree(driver.getPageSource())</code>,
        })}
      </EmptyState>
    );
  }

  return (
    <Box
      sx={{ px: 3, py: 2, display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Typography
        variant="body2"
        color="textSecondary"
        sx={{ maxWidth: "72ch" }}
      >
        {t("a11ySummary.intro", { checked: checked.length, total: withTree })}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 1.5,
        }}
      >
        <Stat label={t("a11ySummary.newIssues")} value={totalNew} accent />
        <Stat label={t("a11ySummary.openIssues")} value={total} />
        <Stat label={t("a11ySummary.screensChecked")} value={checked.length} />
        <Stat
          label={t("a11ySummary.screensWithNew")}
          value={checked.filter((run) => run.a11yNewCount).length}
          accent
        />
      </Box>
      <TableContainer
        sx={{
          bgcolor: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: 3,
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("a11ySummary.screen")}</TableCell>
              <TableCell>{t("a11ySummary.device")}</TableCell>
              <TableCell>{t("a11ySummary.new")}</TableCell>
              <TableCell>{t("a11ySummary.open")}</TableCell>
              <TableCell>{t("a11ySummary.screenshot")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {checked.map((run, index) => (
              <TableRow
                key={run.id}
                hover
                {...staggered(index, checked.length)}
              >
                <TableCell>
                  <MuiLink
                    component={Link}
                    to={buildTestRunLocation(buildId, run.id)}
                    sx={{ fontWeight: 500 }}
                  >
                    {run.name}
                  </MuiLink>
                </TableCell>
                <TableCell
                  sx={{
                    fontFamily: tokens.mono,
                    fontSize: 12.5,
                    color: tokens.textSecondary,
                  }}
                >
                  {deviceLabel(run, "—", t)}
                </TableCell>
                <TableCell>
                  {run.a11yNewCount ? (
                    <Box
                      component="span"
                      sx={{
                        display: "inline-flex",
                        height: 22,
                        alignItems: "center",
                        px: 1,
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        color: tokens.a11y,
                        bgcolor: tokens.a11ySoft,
                      }}
                    >
                      {run.a11yNewCount}
                    </Box>
                  ) : (
                    <span>0</span>
                  )}
                </TableCell>
                <TableCell>{run.a11yTotalCount}</TableCell>
                <TableCell>
                  <StatusPill
                    tone={
                      run.status === "unresolved"
                        ? "changed"
                        : run.status === "new"
                          ? "new"
                          : "passed"
                    }
                    label={labelOf(t, "testStatus", run.status)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
