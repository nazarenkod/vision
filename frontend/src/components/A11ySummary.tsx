import React from "react";
import { Box, ButtonBase } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTestRunState } from "../contexts";
import { buildTestRunLocation } from "../_helpers/route.helpers";
import { StatusPill } from "./StatusPill";
import { radius, tokens, type } from "../theme";
import { buildOverviewService } from "../services";
import { BuildA11yProblem } from "../types/buildOverview";
import { RULE_LABEL } from "./ProjectForm/A11yRulesSettings";
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

  // each check's problems (065); asked again when a count changes: a bug filed,
  // a false positive, a screenshot of a running build
  const countsKey = checked
    .map((run) => `${run.id}:${run.a11yNewCount}:${run.a11yTotalCount}`)
    .join(",");
  const [problems, setProblems] = React.useState<
    Map<string, BuildA11yProblem[]>
  >(new Map());
  React.useEffect(() => {
    let current = true;
    buildOverviewService
      .a11yProblems(buildId)
      .then((lists) => {
        if (current)
          setProblems(
            new Map(lists.map((list) => [list.testRunId, list.problems])),
          );
      })
      // the counts above still say how many; the list is a bonus
      .catch(() => current && setProblems(new Map()));
    return () => {
      current = false;
    };
  }, [buildId, countsKey]);

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
        {checked.map((run) => [
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
          </Row>,
          <ProblemList
            key={`${run.id}:problems`}
            problems={problems.get(run.id) ?? []}
            onOpen={(problem) =>
              navigate(
                buildTestRunLocation(buildId, run.id, {
                  tab: "a11y",
                  issue: problem.violationId,
                }),
              )
            }
          />,
        ])}
      </Card>
    </Box>
  );
};

/**
 * Every open problem of a check under its row (065): state, rule and element,
 * new first; a line opens the review with that problem selected.
 */
const ProblemList: React.FunctionComponent<{
  problems: BuildA11yProblem[];
  onOpen: (problem: BuildA11yProblem) => void;
}> = ({ problems, onOpen }) => {
  const { t } = useT();
  if (!problems.length) return null;
  return (
    <Box
      component="ul"
      data-testid="a11yProblems"
      sx={{
        listStyle: "none",
        m: 0,
        // lined up with the check's name; the next row draws the line under it
        px: 1,
        pt: 0,
        pb: 1.25,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {problems.map((problem) => {
        const rule = RULE_LABEL[problem.rule]
          ? t(RULE_LABEL[problem.rule])
          : problem.rule;
        const state =
          problem.state === "reported"
            ? (problem.jiraKey ?? "")
            : t(
                problem.state === "new"
                  ? "overview.a11yIssueNew"
                  : "overview.a11yIssueKnown",
              );
        const element =
          problem.count > 1
            ? `${problem.element} ×${problem.count}`
            : problem.element;
        return (
          <li key={problem.violationId}>
            <ButtonBase
              data-testid="a11yProblem"
              onClick={() => onOpen(problem)}
              aria-label={`${state}: ${rule} · ${element}`}
              sx={{
                width: "100%",
                justifyContent: "flex-start",
                alignItems: "baseline",
                gap: 1.25,
                px: 1,
                py: 0.625,
                borderRadius: radius.control,
                fontSize: type.small,
                textAlign: "left",
                "&:hover": { bgcolor: tokens.subtle },
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 72,
                  flexShrink: 0,
                  fontSize: type.caption,
                  fontWeight: problem.state === "known" ? 400 : 600,
                  color:
                    problem.state === "new"
                      ? tokens.a11y
                      : problem.state === "reported"
                        ? tokens.textSecondary
                        : tokens.textMuted,
                }}
              >
                {state}
              </Box>
              <Box component="span" sx={{ color: tokens.text }}>
                {rule}
              </Box>
              <Box
                component="span"
                sx={{ color: tokens.textSecondary, minWidth: 0 }}
              >
                · {element}
              </Box>
            </ButtonBase>
          </li>
        );
      })}
    </Box>
  );
};
