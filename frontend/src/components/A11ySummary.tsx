import React from "react";
import { Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTestRunState } from "../contexts";
import { buildTestRunLocation } from "../_helpers/route.helpers";
import { StatusPill } from "./StatusPill";
import { tokens } from "../theme";
import { EmptyState } from "./EmptyState";
import { DeviceTags } from "./DeviceTags";
import { labelOf, useT } from "../i18n";
import { Card, Head, NameCell, Num, Row, Tiles } from "./SummaryParts";

// wide enough for "Screenshot" over its status pill
const COLUMNS = "minmax(0, 1fr) 200px 56px 64px 120px";

/**
 * Accessibility of the build, per screenshot that came with a UI tree; laid
 * out like the Overview tab beside it: tiles of numbers over one table.
 */
export const A11ySummary: React.FunctionComponent<{ buildId: string }> = ({
  buildId,
}) => {
  const { testRuns } = useTestRunState();
  const { t, tx } = useT();
  const navigate = useNavigate();
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
  const screenshots = testRuns.filter((run) => run.buildId === buildId).length;

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
      data-testid="a11ySummary"
      sx={{
        px: 3,
        py: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.75,
        maxWidth: 1240,
      }}
    >
      <Tiles
        testId="a11y"
        tiles={[
          {
            key: "new",
            value: totalNew,
            label: t("a11ySummary.newIssues"),
            hint: t("a11ySummary.newHint"),
            color: tokens.a11y,
          },
          {
            key: "open",
            value: total,
            label: t("a11ySummary.openIssues"),
          },
          {
            key: "checked",
            value: checked.length,
            label: t("a11ySummary.screensChecked"),
            caption: t("a11ySummary.ofScreenshots", { count: screenshots }),
          },
          {
            key: "withNew",
            value: checked.filter((run) => run.a11yNewCount).length,
            label: t("a11ySummary.screensWithNew"),
            color: tokens.a11y,
          },
        ]}
      />
      <Card index={5} testId="a11yScreens">
        <Head
          columns={COLUMNS}
          cells={[
            [t("a11ySummary.screen")],
            [t("a11ySummary.device")],
            [t("a11ySummary.new"), true],
            [t("a11ySummary.open"), true],
            [t("a11ySummary.screenshot")],
          ]}
        />
        {checked.map((run) => (
          <Row
            key={run.id}
            columns={COLUMNS}
            label={run.name}
            testId="a11yScreen"
            onClick={() =>
              navigate(buildTestRunLocation(buildId, run.id, { tab: "a11y" }))
            }
          >
            <NameCell name={run.name} />
            <DeviceTags parts={run} />
            <Num value={run.a11yNewCount ?? 0} color={tokens.a11y} />
            <Num value={run.a11yTotalCount ?? 0} />
            <Box>
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
            </Box>
          </Row>
        ))}
      </Card>
    </Box>
  );
};
