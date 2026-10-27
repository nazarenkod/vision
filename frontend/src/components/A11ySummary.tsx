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
import { deviceLabel } from "../_helpers/device.helper";

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
        color: accent && value ? tokens.status.changed.fg : tokens.text,
      }}
    >
      {value}
    </Typography>
  </Box>
);

/** Accessibility of the build, per screenshot that came with a UI tree. */
export const A11ySummary: React.FunctionComponent<{ buildId: string }> = ({
  buildId,
}) => {
  const { testRuns } = useTestRunState();
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
      <Box sx={{ p: 6, textAlign: "center", maxWidth: 640, mx: "auto" }}>
        <Typography variant="h6">
          No accessibility data in this build
        </Typography>
        <Typography color="textSecondary">
          Accessibility is checked when a screenshot comes with its Appium page
          source. In Java or Kotlin add{" "}
          <code>.uiTree(driver.getPageSource())</code> to the TestRunOptions;
          for manual testing use the CLI (help menu, Manual checks).
        </Typography>
      </Box>
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
        {checked.length} of {withTree} screenshots came with a UI tree. Issues
        are compared with each screen&apos;s baseline, so only issues this build
        introduced count as new. Filed bugs and false positives do not count.
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 1.5,
        }}
      >
        <Stat label="New issues" value={totalNew} accent />
        <Stat label="All open issues" value={total} />
        <Stat label="Screens checked" value={checked.length} />
        <Stat
          label="Screens with new issues"
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
              <TableCell>Screen</TableCell>
              <TableCell>Device</TableCell>
              <TableCell>New</TableCell>
              <TableCell>Open issues</TableCell>
              <TableCell>Screenshot</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {checked.map((run) => (
              <TableRow key={run.id} hover>
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
                  {deviceLabel(run, "—")}
                </TableCell>
                <TableCell>
                  {run.a11yNewCount ? (
                    <StatusPill tone="changed" label={run.a11yNewCount} />
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
                    label={run.status}
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
