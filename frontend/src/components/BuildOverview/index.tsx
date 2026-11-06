import React from "react";
import { Box, Link, Typography } from "@mui/material";
import {
  AccessibilityNewOutlined,
  BugReportOutlined,
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
import { TagOverflow } from "../DeviceTags";
import { DeviceParts, deviceTagsOf } from "../../_helpers/device.helper";
import { EmptyState } from "../EmptyState";
import {
  Card,
  Head,
  NameCell,
  Num,
  Row,
  TileDot,
  TileProps,
  Tiles,
} from "../SummaryParts";
import { BuildTab } from "../../_helpers/route.helpers";
import { QueueKey } from "../../_helpers/reviewQueue.helper";

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

// the result is a short bar and its words: "1 changed · 1 new" (046)
// the name keeps room for "No feature" and a screen's name under it in either language
const FEATURE_COLUMNS = "minmax(150px, 1fr) 72px 140px 68px 40px";
// the devices take the page's width; "Accessibility" fits over its numbers
const DEVICE_COLUMNS = "minmax(0, 1fr) 150px 80px 96px";

/**
 * A device's tags in one line (046): a row never grows to two lines for a long
 * model name; the tags that do not fit become "+N" with their values on hover,
 * so no tag is cut mid-word (REQ-046-31).
 */
const OneLineDevice: React.FunctionComponent<{
  parts: DeviceParts;
}> = ({ parts }) => (
  <TagOverflow
    testId="overviewDeviceTags"
    tagTestId="deviceTag"
    dense
    tags={deviceTagsOf(parts).map((tag) => tag.value)}
  />
);

/**
 * A screen sent without featureName: "No feature" in grey with the screen
 * under it, so its name is not read as a feature's (046).
 */
const NoFeatureCell: React.FunctionComponent<{ name: string }> = ({ name }) => {
  const { t } = useT();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        data-testid="overviewNoFeature"
        noWrap
        sx={{ fontSize: type.small, color: tokens.textSecondary }}
      >
        {t("overview.noFeature")}
      </Typography>
      <Typography
        data-testid="overviewScreenName"
        noWrap
        title={name}
        sx={{ fontSize: type.caption, color: tokens.textSecondary }}
      >
        {name}
      </Typography>
    </Box>
  );
};

const Devices: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
  return (
    <Card index={9} testId="overviewDevices">
      <Head
        columns={DEVICE_COLUMNS}
        cells={[
          [t("overview.device")],
          [t("overview.result")],
          [t("overview.review"), true],
          [t("overview.a11y"), true],
        ]}
      />
      {overview.devices.map((row) => {
        const waiting = row.changed + row.new;
        const profile = [row.device, row.os, row.browser, row.viewport].join(
          "|",
        );
        return (
          <Row
            key={profile}
            columns={DEVICE_COLUMNS}
            label={`${row.device} ${row.os}`}
            testId="overviewDevice"
            onClick={
              waiting
                ? () => actions.openQueue({ kind: "device", profile })
                : undefined
            }
          >
            <OneLineDevice
              parts={{
                os: row.os,
                device: row.device,
                browser: row.browser,
                // the size of the screen: what the test sent, else the screenshot's
                viewport: row.viewport || row.screen,
              }}
            />
            <ResultBar outcome={row} text={t} hint words />
            <Num value={waiting} zero="0" />
            <Num value={row.a11yNew} zero="0" />
          </Row>
        );
      })}
    </Card>
  );
};

const FeatureRows: React.FunctionComponent<{
  rows: Overview["features"];
  actions: OverviewActions;
}> = ({ rows, actions }) => {
  const { t } = useT();
  return (
    <>
      {rows.map((row) => {
        const waiting = row.changed + row.new;
        return (
          <Row
            key={`${row.grouped}:${row.name}`}
            columns={FEATURE_COLUMNS}
            label={row.name}
            testId="overviewFeature"
            onClick={
              waiting
                ? () =>
                    actions.openQueue({
                      kind: row.grouped ? "feature" : "check",
                      name: row.name,
                    })
                : undefined
            }
          >
            {row.grouped ? (
              <NameCell name={row.name} />
            ) : (
              <NoFeatureCell name={row.name} />
            )}
            {/* a check on its own counts itself: only a feature says how many it holds */}
            {row.grouped ? (
              <Num value={row.total} testId="overviewChecks" />
            ) : (
              <span />
            )}
            <ResultBar outcome={row} text={t} hint words />
            <Num value={waiting} zero="0" />
            <Num value={row.bugs} zero="0" />
          </Row>
        );
      })}
    </>
  );
};

const Features: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
  // every feature at once: those with something to look at first, then the rest (REQ-039-02)
  const rows = [
    ...overview.features,
    // an older server folded them without listing them
    ...(overview.quietFeatures.features ?? []),
  ];
  return (
    <Card index={7} testId="overviewFeatures">
      <Head
        columns={FEATURE_COLUMNS}
        cells={[
          [t("overview.feature")],
          [t("overview.checks"), true],
          [t("overview.result")],
          [t("overview.review"), true],
          [t("overview.bugs"), true],
        ]}
      />
      <FeatureRows rows={rows} actions={actions} />
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

// the problem, the device's tags, then New or Known pinned to the right edge
const A11Y_COLUMNS = "minmax(0, 1fr) minmax(96px, 280px) 72px";

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
        cells={[
          [t("overview.a11y")],
          [t("overview.device")],
          [t("overview.a11yState"), true],
        ]}
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
            <OneLineDevice parts={{ os: problem.os, device: problem.device }} />
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
  // no bugs: one line, not a table's title and header over nothing
  if (overview.bugs.length === 0) {
    return (
      <Card index={8} testId="overviewBugs" id="overview-bugs">
        <EmptyLine testId="overviewNoBugs" icon={BugReportOutlined}>
          {t("overview.noBugs")}
        </EmptyLine>
      </Card>
    );
  }
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
      {/* features beside the bugs when both fit; the devices and the accessibility problems take the
          whole width, so a device keeps its tags on one line (046) */}
      <Box
        sx={{
          display: "grid",
          // side by side only when each gets room for its names and summaries;
          // narrower, the bugs go under the features
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
          gap: 2,
          alignItems: "start",
        }}
      >
        <Features
          // another build starts folded again
          key={overview.build.id}
          overview={overview}
          actions={actions}
        />
        <Bugs overview={overview} actions={actions} />
      </Box>
      <Devices overview={overview} actions={actions} />
      <A11yProblems overview={overview} actions={actions} />
    </Box>
  );
};
