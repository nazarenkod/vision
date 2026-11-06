import React from "react";
import { Box, ButtonBase, IconButton, Link, Typography } from "@mui/material";
import {
  AccessibilityNewOutlined,
  BugReportOutlined,
  ChevronRightRounded,
  ExpandMoreRounded,
  LinkRounded,
} from "@mui/icons-material";
import { tokens, type, radius } from "../../theme";
import { useT } from "../../i18n";
import { useTestRunState } from "../../contexts";
import { buildOverviewService } from "../../services";
import { BuildOverview as Overview } from "../../types/buildOverview";
import { RULE_LABEL } from "../ProjectForm/A11yRulesSettings";
import { StatusPill } from "../StatusPill";
import { ResultBar } from "./ResultBar";
import { DeviceTags } from "../DeviceTags";
import { EmptyState } from "../EmptyState";
import {
  Card,
  Head,
  Num,
  Row,
  rowSx,
  TileDot,
  TileProps,
  Tiles,
} from "../SummaryParts";
import { BuildTab } from "../../_helpers/route.helpers";
import {
  featureOf,
  isWaiting,
  profileOf,
  QueueKey,
} from "../../_helpers/reviewQueue.helper";

// a burst of events while screenshots arrive or decisions land: ask once it settles
const REFRESH_DELAY_MS = 400;

export interface OverviewActions {
  openTab: (tab: BuildTab, status?: string) => void;
  openQueue: (key: QueueKey, runId?: string) => void;
  // a screenshot on the Accessibility tab (REQ-039-07)
  openA11y: (runId: string) => void;
}

/** Fetches the build overview (031) and asks again when a run of the build changes. */
export function useBuildOverview(buildId: string | undefined) {
  const { testRuns } = useTestRunState();
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [failed, setFailed] = React.useState(false);
  // what the overview depends on: any run's status, decision or a11y count
  const runsKey = React.useMemo(
    () =>
      testRuns
        .filter((run) => run.buildId === buildId)
        .map((run) => `${run.id}:${run.status}:${run.a11yNewCount ?? ""}`)
        .join(","),
    [testRuns, buildId],
  );
  const loaded = React.useRef(false);

  React.useEffect(() => {
    loaded.current = false;
    setOverview(null);
    setFailed(false);
  }, [buildId]);

  React.useEffect(() => {
    if (!buildId) return;
    let cancelled = false;
    const timer = setTimeout(
      () =>
        buildOverviewService
          .get(buildId)
          .then((result) => {
            if (cancelled) return;
            loaded.current = true;
            setFailed(false);
            setOverview(result);
          })
          .catch(() => !cancelled && setFailed(true)),
      loaded.current ? REFRESH_DELAY_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buildId, runsKey]);

  return { overview, failed };
}

const OverviewTiles: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
  const { counts, progress } = overview;
  const someone = t("overview.someone");
  const tiles: TileProps[] = [
    {
      key: "screens",
      value: counts.total,
      label: t("overview.screens"),
      onClick: () => actions.openTab("all"),
    },
    {
      key: "waiting",
      value: counts.waiting,
      label: t("overview.waiting"),
      // the tile says only what waits; the progress and who decided, on hover
      hint: progress.needed
        ? [
            t("overview.decidedOf", {
              decided: progress.decided,
              needed: progress.needed,
            }),
            ...progress.people.map(
              (person) =>
                `${person.name ?? someone}: ${t("overview.personDecisions", {
                  approved: person.approved,
                  rejected: person.rejected,
                })}`,
            ),
          ].join("\n")
        : undefined,
      marker: <TileDot color={tokens.status.changed.bar} />,
      onClick: counts.waiting
        ? () => actions.openQueue({ kind: "all" })
        : undefined,
    },
    {
      key: "rejected",
      value: counts.rejected,
      label: t("overview.rejected"),
      marker: <TileDot color={tokens.status.failed.bar} />,
      onClick: () => actions.openTab("all", "failed"),
    },
    {
      key: "a11y",
      value: counts.a11yNew,
      unit: t("overview.a11yUnit"),
      // short enough for the strip; what the number counts, on hover
      label: t("overview.a11y"),
      hint: t("overview.a11yNew"),
      marker: <AccessibilityNewOutlined sx={{ fontSize: type.body }} />,
      onClick: () => actions.openTab("a11y"),
    },
    {
      key: "bugs",
      value: counts.bugs,
      label: t("overview.jiraBugs"),
      marker: <BugReportOutlined sx={{ fontSize: type.body }} />,
      onClick: counts.bugs
        ? () =>
            document
              .getElementById("overview-bugs")
              ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        : undefined,
    },
  ];
  // the numbers in the text colour, what each means by its marker (046);
  // a zero says nothing needs doing: it steps back, the screens count never does (REQ-039-01)
  return (
    <Tiles
      tiles={tiles.map((tile) => ({
        ...tile,
        quiet: tile.key !== "screens" && tile.value === 0,
      }))}
    />
  );
};

// the check or feature, its result in a short bar and words ("3 changed · 9
// unchanged"), its bugs: what waits is in the words already (REQ-048-01)
const CHECK_COLUMNS = "minmax(0, 1fr) 220px 56px";

/**
 * The build's devices (REQ-048-06): a set of tags per profile, in the build
 * header on every tab. A device opens its screenshots waiting for a decision;
 * with none waiting, its first screenshot.
 */
export const BuildDevices: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { testRuns } = useTestRunState();
  if (!overview.devices.length) return null;
  return (
    <Box
      data-testid="buildDevices"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        // a wider gap between devices than between the tags of one
        columnGap: 1.5,
        rowGap: 0.5,
        minWidth: 0,
      }}
    >
      {overview.devices.map((row) => {
        const waiting = row.changed + row.new;
        const profile = [row.device, row.os, row.browser, row.viewport].join(
          "|",
        );
        const first = testRuns.find(
          (run) =>
            run.buildId === overview.build.id && profileOf(run) === profile,
        );
        const open = waiting
          ? () => actions.openQueue({ kind: "device", profile })
          : first
            ? () => actions.openQueue({ kind: "run", id: first.id })
            : undefined;
        return (
          <ButtonBase
            key={profile}
            data-testid="buildDevice"
            aria-label={`${row.device} ${row.os}`}
            onClick={open}
            disabled={!open}
            sx={{
              p: "2px",
              borderRadius: radius.control,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <DeviceTags
              testId="buildDeviceTags"
              dense
              parts={{
                os: row.os,
                device: row.device,
                browser: row.browser,
                // the size of the screen: what the test sent, else the screenshot's
                viewport: row.viewport || row.screen,
              }}
            />
          </ButtonBase>
        );
      })}
    </Box>
  );
};

type FeatureRow = Overview["features"][number];
const waitingOf = (row: FeatureRow) => row.changed + row.new;
// a feature opens by itself when something in it needs a look (REQ-048-04)
const needsLook = (row: FeatureRow) =>
  waitingOf(row) + row.rejected + row.bugs > 0;

/** A check's whole name: names are sentences, so it wraps rather than being cut (REQ-048-03). */
const CheckName: React.FunctionComponent<{
  name: string;
  indent?: boolean;
}> = ({ name, indent }) => (
  <Typography
    data-testid="overviewCheckName"
    sx={{
      fontSize: 13,
      lineHeight: 1.35,
      overflowWrap: "anywhere",
      pl: indent ? 3.5 : 0,
    }}
  >
    {name}
  </Typography>
);

/**
 * The checks of the build in one table (REQ-048-01): a feature the tests named
 * is a group with its checks under it (REQ-048-02); a check without one is a
 * plain row (REQ-048-03). A check opens its screenshots waiting for a decision,
 * in the feature's queue when it is in one, or its first screenshot (REQ-048-05).
 */
const Checks: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
  const { testRuns } = useTestRunState();
  // every row at once: those with something to look at first, then the rest (REQ-039-02)
  const rows = [
    ...overview.features,
    // an older server folded them without listing them
    ...(overview.quietFeatures.features ?? []),
  ];
  // the groups someone opened or closed; the rest follow needsLook
  const [toggled, setToggled] = React.useState<Set<string>>(new Set());
  const toggle = (name: string) =>
    setToggled((current) => {
      const next = new Set(current);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  const runs = testRuns.filter((run) => run.buildId === overview.build.id);
  const openCheck = (name: string, feature?: string) => {
    const mine = runs.filter(
      (run) => run.name === name && (featureOf(run) || undefined) === feature,
    );
    const waiting = mine.find(isWaiting);
    if (waiting)
      actions.openQueue(
        feature ? { kind: "feature", name: feature } : { kind: "check", name },
        waiting.id,
      );
    else if (mine[0]) actions.openQueue({ kind: "run", id: mine[0].id });
  };
  const checkRow = (row: FeatureRow, feature?: string) => (
    <Row
      key={`${feature ?? ""}\u0000${row.name}`}
      columns={CHECK_COLUMNS}
      label={row.name}
      testId={feature ? "overviewFeatureCheck" : "overviewCheck"}
      onClick={() => openCheck(row.name, feature)}
    >
      <CheckName name={row.name} indent={!!feature} />
      <ResultBar outcome={row} text={t} hint words />
      <Num value={row.bugs} zero="0" />
    </Row>
  );
  return (
    <Card index={7} testId="overviewTable">
      <Head
        columns={CHECK_COLUMNS}
        cells={[
          [t("overview.check")],
          [t("overview.result")],
          [t("overview.bugs"), true],
        ]}
      />
      {rows.map((row) => {
        if (!row.grouped) return checkRow(row);
        const open = needsLook(row) !== toggled.has(row.name);
        const checks = row.checks ?? [];
        return (
          <React.Fragment key={`f\u0000${row.name}`}>
            <Box
              data-testid="overviewFeature"
              data-open={open || undefined}
              sx={rowSx(CHECK_COLUMNS, false)}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}>
                <IconButton
                  size="small"
                  data-testid="overviewFeatureToggle"
                  aria-expanded={open}
                  aria-label={t(open ? "overview.collapse" : "overview.expand")}
                  onClick={() => toggle(row.name)}
                  sx={{ p: 0.25, mt: "-1px", color: tokens.textSecondary }}
                >
                  {open ? (
                    <ExpandMoreRounded sx={{ fontSize: type.title }} />
                  ) : (
                    <ChevronRightRounded sx={{ fontSize: type.title }} />
                  )}
                </IconButton>
                <ButtonBase
                  data-testid="overviewFeatureName"
                  onClick={() =>
                    waitingOf(row)
                      ? actions.openQueue({ kind: "feature", name: row.name })
                      : toggle(row.name)
                  }
                  sx={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    borderRadius: radius.control,
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: 13,
                      lineHeight: 1.35,
                      overflowWrap: "anywhere",
                    }}
                  >
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {row.name}
                    </Box>{" "}
                    <Box
                      component="span"
                      data-testid="overviewFeatureCount"
                      sx={{ color: tokens.textSecondary }}
                    >
                      ·{" "}
                      {t("overview.checksCount", {
                        count: checks.length || row.total,
                      })}
                    </Box>
                  </Typography>
                </ButtonBase>
              </Box>
              <ResultBar outcome={row} text={t} hint words />
              <Num value={row.bugs} zero="0" />
            </Box>
            {open && checks.map((check) => checkRow(check, row.name))}
          </React.Fragment>
        );
      })}
    </Card>
  );
};

const BUG_COLUMNS = "24px 104px minmax(0, 1fr) auto";

/** A card with nothing to list: one line, not a title and a table header over nothing. */
const EmptyLine: React.FunctionComponent<{
  testId: string;
  icon: typeof BugReportOutlined;
  children: React.ReactNode;
}> = ({ testId, icon: Icon, children }) => (
  <Box
    data-testid={testId}
    sx={{
      px: 2,
      minHeight: 48,
      display: "flex",
      alignItems: "center",
      gap: 1.25,
      color: tokens.textSecondary,
      fontSize: 13,
    }}
  >
    <Icon sx={{ fontSize: type.title, color: tokens.textMuted }} />
    {children}
  </Box>
);

// the problem, then New or Known pinned to the right edge; the device is the
// screen's, already named in the build header (REQ-047-04)
const A11Y_COLUMNS = "minmax(0, 1fr) 72px";

/**
 * The accessibility problems of the build's screenshots (039): a row per
 * problem per screenshot, new first, each opening its screenshot on the
 * Accessibility tab.
 */
const A11yProblems: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
  const a11y = overview.a11y;
  // no screenshot came with a UI tree: nothing was checked, nothing to say
  if (!a11y?.checked) return null;
  if (!a11y.problems.length) {
    return (
      <Card index={10} testId="overviewA11y">
        <EmptyLine testId="overviewNoA11y" icon={AccessibilityNewOutlined}>
          {t("overview.noA11y")}
        </EmptyLine>
      </Card>
    );
  }
  return (
    <Card index={10} testId="overviewA11y">
      <Head
        columns={A11Y_COLUMNS}
        cells={[[t("overview.a11y")], [t("overview.a11yState"), true]]}
      />
      {a11y.problems.map((problem, i) => {
        const rule = RULE_LABEL[problem.rule]
          ? t(RULE_LABEL[problem.rule])
          : problem.rule;
        return (
          <Row
            key={`${problem.testRunId}:${problem.rule}:${problem.element}:${i}`}
            columns={A11Y_COLUMNS}
            label={`${rule} ${problem.check} ${problem.element}`}
            testId="overviewA11yProblem"
            onClick={() => actions.openA11y(problem.testRunId)}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                noWrap
                sx={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: problem.isNew ? tokens.text : tokens.textSecondary,
                }}
              >
                {rule}
              </Typography>
              <Typography
                noWrap
                title={`${problem.check} · ${problem.element}`}
                sx={{ fontSize: type.caption, color: tokens.textMuted }}
              >
                {[problem.check, problem.element].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
            <Box sx={{ justifySelf: "end" }}>
              <StatusPill
                tone={problem.isNew ? "changed" : "neutral"}
                label={t(
                  problem.isNew
                    ? "overview.a11yIssueNew"
                    : "overview.a11yIssueKnown",
                )}
              />
            </Box>
          </Row>
        );
      })}
      {a11y.more > 0 && (
        <Row
          columns="minmax(0, 1fr)"
          testId="overviewA11yMore"
          onClick={() => actions.openTab("a11y")}
        >
          <Box component="span" sx={{ color: tokens.textSecondary }}>
            {t("overview.a11yMore", { count: a11y.more })}
          </Box>
        </Row>
      )}
    </Card>
  );
};

const Bugs: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
  // no bugs: the tile says 0 already (REQ-048-07)
  if (overview.bugs.length === 0) return null;
  return (
    <Card
      title={t("overview.jiraBugs")}
      index={8}
      testId="overviewBugs"
      id="overview-bugs"
    >
      <Head
        columns={BUG_COLUMNS}
        cells={[[""], [t("overview.key")], [t("overview.summary")], [""]]}
      />
      {overview.bugs.map((bug) => {
        const Icon =
          bug.kind === "a11y"
            ? AccessibilityNewOutlined
            : bug.isNew
              ? BugReportOutlined
              : LinkRounded;
        return (
          <Row
            key={bug.jiraKey}
            columns={BUG_COLUMNS}
            label={`${bug.jiraKey} ${bug.summary}`}
            testId="overviewBug"
            onClick={() =>
              actions.openQueue({ kind: "run", id: bug.testRunId })
            }
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: radius.control,
                display: "grid",
                placeItems: "center",
                bgcolor:
                  bug.kind === "a11y" ? tokens.a11ySoft : tokens.diffSoft,
                color: bug.kind === "a11y" ? tokens.a11y : tokens.diff,
              }}
            >
              <Icon sx={{ fontSize: type.body }} />
            </Box>
            {bug.jiraUrl ? (
              <Link
                href={bug.jiraUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                sx={{
                  fontFamily: tokens.mono,
                  fontSize: type.caption,
                  fontWeight: 600,
                  color: tokens.brand,
                }}
              >
                {bug.jiraKey}
              </Link>
            ) : (
              <Box
                component="span"
                sx={{
                  fontFamily: tokens.mono,
                  fontSize: type.caption,
                  fontWeight: 600,
                  color: tokens.brand,
                }}
              >
                {bug.jiraKey}
              </Box>
            )}
            <Typography noWrap sx={{ fontSize: 13 }}>
              {bug.summary}
            </Typography>
            <StatusPill
              tone={bug.isNew ? "new" : "neutral"}
              label={t(bug.isNew ? "overview.bugNew" : "overview.bugKnown")}
            />
          </Row>
        );
      })}
    </Card>
  );
};

/**
 * The build's Overview tab (031): its state, where the changes are and its
 * bugs. Change groups live in the Changes tab: on the overview they repeated
 * the features whenever screenshots came without UI trees.
 */
export const BuildOverview: React.FunctionComponent<{
  overview: Overview | null;
  failed: boolean;
  actions: OverviewActions;
}> = ({ overview, failed, actions }) => {
  const { t } = useT();
  if (!overview) {
    return failed ? <EmptyState title={t("overview.loadFailed")} /> : null;
  }
  return (
    <Box
      data-testid="buildOverview"
      sx={{
        px: 3,
        py: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxWidth: 1240,
      }}
    >
      <OverviewTiles overview={overview} actions={actions} />
      {/* the checks take the whole width, so a name is never cut (REQ-047-01) */}
      <Checks
        // another build starts folded again
        key={overview.build.id}
        overview={overview}
        actions={actions}
      />
      <Bugs overview={overview} actions={actions} />
      <A11yProblems overview={overview} actions={actions} />
    </Box>
  );
};
