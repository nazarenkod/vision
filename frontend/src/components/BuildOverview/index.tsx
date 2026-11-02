import React from "react";
import { Box, ButtonBase, Link, Typography } from "@mui/material";
import {
  AccessibilityNewOutlined,
  BugReportOutlined,
  ExpandMoreRounded,
  LinkRounded,
} from "@mui/icons-material";
import { tokens } from "../../theme";
import { useT } from "../../i18n";
import { useTestRunState } from "../../contexts";
import { buildOverviewService } from "../../services";
import { BuildOverview as Overview } from "../../types/buildOverview";
import { StatusPill } from "../StatusPill";
import { ResultBar } from "./ResultBar";
import { EmptyState } from "../EmptyState";
import {
  Card,
  DeviceCell,
  Head,
  NameCell,
  Num,
  Row,
  rowSx,
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
      // "0 of 0 decided" says nothing: nothing needed a decision
      caption: progress.needed
        ? t("overview.decidedOf", {
            decided: progress.decided,
            needed: progress.needed,
          })
        : undefined,
      captionTitle: progress.people
        .map(
          (person) =>
            `${person.name ?? someone}: ${t("overview.personDecisions", {
              approved: person.approved,
              rejected: person.rejected,
            })}`,
        )
        .join("\n"),
      color: tokens.status.changed.fg,
      onClick: counts.waiting
        ? () => actions.openQueue({ kind: "all" })
        : undefined,
    },
    {
      key: "rejected",
      value: counts.rejected,
      label: t("overview.rejected"),
      color: tokens.status.failed.fg,
      onClick: () => actions.openTab("all", "failed"),
    },
    {
      key: "a11y",
      value: counts.a11yNew,
      label: t("overview.a11yNew"),
      color: tokens.a11y,
      onClick: () => actions.openTab("a11y"),
    },
    {
      key: "bugs",
      value: counts.bugs,
      label: t("overview.jiraBugs"),
      color: tokens.status.new.fg,
      onClick: counts.bugs
        ? () =>
            document
              .getElementById("overview-bugs")
              ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        : undefined,
    },
  ];
  return <Tiles tiles={tiles} />;
};

const FEATURE_COLUMNS = "minmax(0, 1fr) 64px 80px 64px 40px";
// wide enough for "Accessibility" over its numbers
const DEVICE_COLUMNS = "minmax(0, 1fr) 80px 64px 92px";

const Devices: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
  return (
    <Card index={7} testId="overviewDevices">
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
            <DeviceCell
              name={row.device}
              detail={[row.os, row.browser, row.viewport || row.screen]
                .filter(Boolean)
                .join(" · ")}
            />
            <ResultBar outcome={row} text={t} hint />
            <Num value={waiting} />
            <Num value={row.a11yNew} />
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
            <NameCell name={row.name} strong={row.grouped} />
            {/* a check on its own counts itself: only a feature says how many it holds */}
            {row.grouped ? (
              <Num value={row.total} testId="overviewChecks" />
            ) : (
              <span />
            )}
            <ResultBar outcome={row} text={t} hint />
            <Num value={waiting} />
            <Num value={row.bugs} />
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
  const { features, quietFeatures } = overview;
  const [quietOpen, setQuietOpen] = React.useState(false);
  return (
    <Card index={8} testId="overviewFeatures">
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
      <FeatureRows rows={features} actions={actions} />
      {/* opened, the row gives its place to the features it folded */}
      {quietFeatures.count > 0 && !quietOpen && (
        <ButtonBase
          data-testid="overviewQuietFeatures"
          aria-expanded={false}
          onClick={() => setQuietOpen(true)}
          sx={rowSx(FEATURE_COLUMNS, true)}
        >
          <Box
            component="span"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              color: tokens.textSecondary,
            }}
          >
            {t("overview.quiet", { count: quietFeatures.count })}
            <ExpandMoreRounded sx={{ fontSize: 18 }} />
          </Box>
          <span />
          <ResultBar
            outcome={{
              total: quietFeatures.screens,
              changed: 0,
              new: 0,
              rejected: 0,
              passed: quietFeatures.screens,
            }}
            text={t}
          />
          <span />
          <span />
        </ButtonBase>
      )}
      {quietOpen && (
        <FeatureRows rows={quietFeatures.features ?? []} actions={actions} />
      )}
    </Card>
  );
};

const BUG_COLUMNS = "24px 104px minmax(0, 1fr) auto";

const Bugs: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
  // no bugs: one line, not a table's title and header over nothing
  if (overview.bugs.length === 0) {
    return (
      <Card index={9} testId="overviewBugs" id="overview-bugs">
        <Box
          data-testid="overviewNoBugs"
          sx={{ px: 2, py: 1.5, color: tokens.textSecondary, fontSize: 13 }}
        >
          {t("overview.noBugs")}
        </Box>
      </Card>
    );
  }
  return (
    <Card
      title={t("overview.jiraBugs")}
      index={9}
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
                borderRadius: 1.75,
                display: "grid",
                placeItems: "center",
                bgcolor:
                  bug.kind === "a11y" ? tokens.a11ySoft : tokens.diffSoft,
                color: bug.kind === "a11y" ? tokens.a11y : tokens.diff,
              }}
            >
              <Icon sx={{ fontSize: 15 }} />
            </Box>
            {bug.jiraUrl ? (
              <Link
                href={bug.jiraUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                sx={{
                  fontFamily: tokens.mono,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: tokens.status.new.fg,
                }}
              >
                {bug.jiraKey}
              </Link>
            ) : (
              <Box
                component="span"
                sx={{
                  fontFamily: tokens.mono,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: tokens.status.new.fg,
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
        gap: 1.75,
        maxWidth: 1240,
      }}
    >
      <OverviewTiles overview={overview} actions={actions} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          gap: 1.75,
          alignItems: "start",
        }}
      >
        <Features
          // another build starts folded again
          key={overview.build.id}
          overview={overview}
          actions={actions}
        />
        {/* stacked, so the shorter cards fill the column beside the features */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.75,
            minWidth: 0,
          }}
        >
          <Devices overview={overview} actions={actions} />
          <Bugs overview={overview} actions={actions} />
        </Box>
      </Box>
    </Box>
  );
};
