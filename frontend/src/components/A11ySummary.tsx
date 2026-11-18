import React from "react";
import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import { ChevronRightRounded, ExpandMoreRounded } from "@mui/icons-material";
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
import { Card, Head, NameCell, Num, Row, rowSx, Tiles } from "./SummaryParts";

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

  // each check's problems (065); asked again when a count changes: a bug filed,
  // a false positive, a screenshot of a running build
  const countsKey = checked
    .map((run) => `${run.id}:${run.a11yNewCount}:${run.a11yTotalCount}`)
    .join(",");
  const [problems, setProblems] = React.useState<
    Map<string, BuildA11yProblem[]>
  >(new Map());
  // the lists start folded (REQ-065-10); the review opens over the tab, so a
  // list someone unfolded is still unfolded when they come back from it
  const [unfolded, setUnfolded] = React.useState<Set<string>>(new Set());
  const toggle = (runId: string) =>
    setUnfolded((current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
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
        {checked.map((run) => {
          const list = problems.get(run.id) ?? [];
          const open = unfolded.has(run.id) && list.length > 0;
          const openRun = () =>
            navigate(buildTestRunLocation(buildId, run.id, { tab: "a11y" }));
          return (
            <React.Fragment key={run.id}>
              {/* a box, not a button: the toggle in it is a button of its own,
                  as in the Overview's feature rows (REQ-048-02) */}
              <Box
                data-testid="a11yScreen"
                data-open={open || undefined}
                onClick={openRun}
                sx={{ ...rowSx(COLUMNS, true), cursor: "pointer" }}
              >
                <Box
                  sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}
                >
                  {list.length ? (
                    <IconButton
                      size="small"
                      data-testid="a11yProblemsToggle"
                      aria-expanded={open}
                      aria-label={t("a11ySummary.problems", {
                        count: list.length,
                      })}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle(run.id);
                      }}
                      sx={{ p: 0.25, mt: "-1px", color: tokens.textSecondary }}
                    >
                      {open ? (
                        <ExpandMoreRounded sx={{ fontSize: type.title }} />
                      ) : (
                        <ChevronRightRounded sx={{ fontSize: type.title }} />
                      )}
                    </IconButton>
                  ) : (
                    // names stay in one column with or without a toggle
                    <Box sx={{ width: 20, flexShrink: 0 }} aria-hidden />
                  )}
                  <ButtonBase
                    aria-label={run.name}
                    onClick={(event) => {
                      event.stopPropagation();
                      openRun();
                    }}
                    sx={{
                      justifyContent: "flex-start",
                      textAlign: "left",
                      borderRadius: radius.control,
                      minWidth: 0,
                    }}
                  >
                    <NameCell name={run.name} />
                  </ButtonBase>
                </Box>
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
              </Box>
              {open &&
                list.map((problem) => (
                  <ProblemRow
                    key={`${run.id}:${problem.violationId}`}
                    problem={problem}
                    onOpen={() =>
                      navigate(
                        buildTestRunLocation(buildId, run.id, {
                          tab: "a11y",
                          issue: problem.violationId,
                        }),
                      )
                    }
                  />
                ))}
            </React.Fragment>
          );
        })}
      </Card>
    </Box>
  );
};

/**
 * One open problem of a check (065), a row of the checks' table under its
 * check, like a check under its feature on the Overview: the rule, the element
 * under it, the state where the check has its status; it opens the review with
 * the problem chosen.
 */
const ProblemRow: React.FunctionComponent<{
  problem: BuildA11yProblem;
  onOpen: () => void;
}> = ({ problem, onOpen }) => {
  const { t } = useT();
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
    <Row
      columns={COLUMNS}
      label={`${rule} · ${element}: ${state}`}
      testId="a11yProblem"
      onClick={onOpen}
    >
      {/* under the check's name, past its toggle, and as wide as the columns
          up to the state: a problem has no device or counts of its own */}
      <Box sx={{ minWidth: 0, pl: 3, gridColumn: "1 / span 4" }}>
        <Typography
          noWrap
          title={rule}
          sx={{
            fontSize: 13,
            fontWeight: 500,
            color: problem.state === "new" ? tokens.text : tokens.textSecondary,
          }}
        >
          {rule}
        </Typography>
        <Typography
          noWrap
          title={element}
          sx={{ fontSize: type.caption, color: tokens.textMuted }}
        >
          {element}
        </Typography>
      </Box>
      <Box>
        <StatusPill
          tone={problem.state === "new" ? "changed" : "neutral"}
          label={
            problem.state === "reported" ? (
              <Box component="span" sx={{ fontFamily: tokens.mono }}>
                {state}
              </Box>
            ) : (
              state
            )
          }
        />
      </Box>
    </Row>
  );
};
