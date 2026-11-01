import React from "react";
import { Box, ButtonBase, Link, Typography } from "@mui/material";
import {
  AccessibilityNewOutlined,
  AccountTreeOutlined,
  BugReportOutlined,
  ChevronRight,
  CheckRounded,
  HourglassEmptyRounded,
  LinkRounded,
  ScheduleRounded,
} from "@mui/icons-material";
import { motion, tokens } from "../../theme";
import { useT } from "../../i18n";
import type { MessageKey } from "../../i18n";
import { useTestRunState } from "../../contexts";
import { buildOverviewService } from "../../services";
import { BuildOverview as Overview } from "../../types/buildOverview";
import { ChangeGroup } from "../../types/insights";
import { TestRun } from "../../types";
import { StatusPill } from "../StatusPill";
import { ResultBar } from "./ResultBar";
import { EmptyState } from "../EmptyState";
import { CountUp } from "../motion/useCountUp";
import { staggered } from "../motion/Stagger";
import { thumbnailFor } from "../../_helpers/testRunImage.helper";
import { BuildTab } from "../../_helpers/route.helpers";
import { sincePrevious } from "../../_helpers/previousBuild.helper";
import { QueueKey, queueIds } from "../../_helpers/reviewQueue.helper";

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

const Card: React.FunctionComponent<{
  title: string;
  index: number;
  children: React.ReactNode;
  testId?: string;
  id?: string;
}> = ({ title, index, children, testId, id }) => (
  <Box
    component="section"
    id={id}
    data-testid={testId}
    {...staggered(index)}
    sx={{
      bgcolor: tokens.surface,
      border: `1px solid ${tokens.border}`,
      borderRadius: 3,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
    }}
  >
    <Typography
      component="h3"
      sx={{
        px: 2,
        py: 1.5,
        fontSize: 14,
        fontWeight: 650,
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      {title}
    </Typography>
    {children}
  </Box>
);

const rowSx = (columns: string, clickable: boolean) => ({
  display: "grid",
  gridTemplateColumns: columns,
  alignItems: "center",
  gap: 1.5,
  px: 2,
  minHeight: 48,
  width: "100%",
  // header rows are plain boxes, the others buttons: the same box model for both
  boxSizing: "border-box" as const,
  textAlign: "left" as const,
  borderTop: `1px solid ${tokens.border}`,
  fontSize: 13,
  transition: `background-color ${motion.base}ms ${motion.easing}`,
  "& > *": { minWidth: 0 },
  ...(clickable && { "&:hover": { bgcolor: tokens.subtle } }),
});

const Head: React.FunctionComponent<{
  columns: string;
  cells: Array<[string, boolean?]>;
}> = ({ columns, cells }) => (
  <Box
    sx={{
      ...rowSx(columns, false),
      minHeight: 32,
      borderTop: 0,
      bgcolor: tokens.subtle,
      fontSize: 11.5,
      fontWeight: 600,
      color: tokens.textSecondary,
    }}
  >
    {cells.map(([label, right], i) => (
      <span key={i} style={right ? { textAlign: "right" } : undefined}>
        {label}
      </span>
    ))}
  </Box>
);

/** A row that opens something; a plain row when it does not. */
const Row: React.FunctionComponent<{
  columns: string;
  onClick?: () => void;
  children: React.ReactNode;
  label?: string;
  testId?: string;
}> = ({ columns, onClick, children, label, testId }) =>
  onClick ? (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      sx={rowSx(columns, true)}
    >
      {children}
    </ButtonBase>
  ) : (
    <Box data-testid={testId} sx={rowSx(columns, false)}>
      {children}
    </Box>
  );

const Num: React.FunctionComponent<{ value: number }> = ({ value }) => (
  <Box
    component="span"
    sx={{
      textAlign: "right",
      fontFamily: tokens.mono,
      fontSize: 12,
      fontVariantNumeric: "tabular-nums",
      fontWeight: value ? 600 : 400,
      color: value ? tokens.text : tokens.textMuted,
    }}
  >
    {value}
  </Box>
);

const Verdict: React.FunctionComponent<{ overview: Overview }> = ({
  overview,
}) => {
  const { t } = useT();
  const { verdict, counts, progress, previous } = overview;
  const done = verdict === "passed" || verdict === "reviewed";
  const Icon =
    verdict === "running"
      ? HourglassEmptyRounded
      : done
        ? CheckRounded
        : ScheduleRounded;
  const tone = done ? tokens.status.passed : tokens.status.changed;
  const share = progress.needed ? progress.decided / progress.needed : 1;
  return (
    <Box
      data-testid="overviewVerdict"
      {...staggered(0)}
      sx={{
        bgcolor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: 3,
        px: 2,
        py: 1.75,
        // one line when it fits; on a narrow window the chip and progress go below
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 1.75,
        rowGap: 1.25,
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          bgcolor: tone.bg,
          color: tone.fg,
        }}
      >
        <Icon sx={{ fontSize: 18 }} />
      </Box>
      <Typography
        component="h2"
        sx={{ fontSize: 16, fontWeight: 650, whiteSpace: "nowrap" }}
      >
        {t(`overview.verdict.${verdict}` as MessageKey)}
      </Typography>
      <Typography
        sx={{
          fontSize: 13,
          color: tokens.textSecondary,
          whiteSpace: "nowrap",
          flex: "1 1 auto",
        }}
      >
        {done
          ? t("overview.decidedSummary", {
              passed: counts.passed,
              rejected: counts.rejected,
            })
          : t("overview.needDecision", {
              waiting: counts.waiting,
              total: counts.total,
            })}
      </Typography>
      <Box
        data-testid="overviewPrevious"
        sx={{
          height: 26,
          px: 1.25,
          borderRadius: 999,
          bgcolor: tokens.subtle,
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          fontSize: 12,
          color: tokens.textSecondary,
          whiteSpace: "nowrap",
        }}
      >
        <AccountTreeOutlined sx={{ fontSize: 14 }} />
        {previous ? sincePrevious(previous, t) : t("overview.firstBuild")}
      </Box>
      <Box
        data-testid="overviewProgress"
        sx={{ display: "flex", flexDirection: "column", gap: 0.5, width: 190 }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: tokens.textSecondary,
          }}
        >
          <span>{t("overview.decided")}</span>
          <span>
            <b style={{ color: tokens.text }}>{progress.decided}</b> /{" "}
            {progress.needed}
          </span>
        </Box>
        <Box
          sx={{
            height: 6,
            borderRadius: 999,
            bgcolor: tokens.border,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${share * 100}%`,
              bgcolor: tokens.status.passed.bar,
              transition: `width ${motion.fill}ms ${motion.easing}`,
            }}
          />
        </Box>
        {progress.people.length > 0 && (
          <Typography
            noWrap
            title={progress.people
              .map(
                (person) =>
                  `${person.name ?? t("overview.someone")}: ${t(
                    "overview.personDecisions",
                    {
                      approved: person.approved,
                      rejected: person.rejected,
                    },
                  )}`,
              )
              .join("\n")}
            sx={{ fontSize: 11.5, color: tokens.textMuted }}
          >
            {progress.people
              .map(
                (person) =>
                  `${person.name ?? t("overview.someone")} ${person.approved + person.rejected}`,
              )
              .join(" · ")}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

const Tiles: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
  const { counts } = overview;
  const tiles: Array<{
    key: string;
    value: number;
    label: string;
    color?: string;
    onClick?: () => void;
  }> = [
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
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 1.25,
      }}
    >
      {tiles.map((tile, i) => (
        <ButtonBase
          key={tile.key}
          data-testid={`overviewTile-${tile.key}`}
          disabled={!tile.onClick}
          onClick={tile.onClick}
          {...staggered(i + 1)}
          sx={{
            bgcolor: tokens.surface,
            border: `1px solid ${tokens.border}`,
            borderRadius: 3,
            px: 1.75,
            py: 1.25,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 0.125,
            minWidth: 0,
            transition: `border-color ${motion.base}ms, transform ${motion.base}ms ${motion.easing}`,
            "&:hover": {
              borderColor: tokens.brand,
              transform: "translateY(-1px)",
            },
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: 24,
              fontWeight: 650,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              fontVariantNumeric: "tabular-nums",
              color: tile.value && tile.color ? tile.color : tokens.text,
            }}
          >
            <CountUp value={tile.value} />
          </Box>
          <Box component="span" sx={{ fontSize: 12.5, fontWeight: 500 }}>
            {tile.label}
          </Box>
        </ButtonBase>
      ))}
    </Box>
  );
};

const THUMB_SX = {
  width: 20,
  height: 41,
  borderRadius: 0.75,
  cursor: "pointer",
  transition: `transform ${motion.base}ms ${motion.easing}`,
  "&:hover": { transform: "translateY(-2px)" },
};

/** A small screenshot; one that does not load shows as an empty frame, not a broken picture. */
const Thumb: React.FunctionComponent<{ run: TestRun; onOpen: () => void }> = ({
  run,
  onOpen,
}) => {
  const [broken, setBroken] = React.useState(false);
  const open = (event: React.MouseEvent) => {
    event.stopPropagation();
    onOpen();
  };
  return broken ? (
    <Box
      data-testid="thumbMissing"
      role="img"
      aria-label={run.name}
      onClick={open}
      sx={{
        ...THUMB_SX,
        bgcolor: tokens.subtle,
        border: `1px dashed ${tokens.borderStrong}`,
      }}
    />
  ) : (
    <Box
      component="img"
      src={thumbnailFor(run, true)}
      alt={run.name}
      loading="lazy"
      onError={() => setBroken(true)}
      onClick={open}
      sx={{
        ...THUMB_SX,
        objectFit: "cover",
        objectPosition: "top",
        boxShadow: tokens.shadowShot,
      }}
    />
  );
};

const DECIDE_COLUMNS = "minmax(0, 1fr) 72px 32px 20px";

const ToDecide: React.FunctionComponent<{
  overview: Overview;
  groups: ChangeGroup[] | null;
  testRuns: TestRun[];
  actions: OverviewActions;
}> = ({ overview, groups, testRuns, actions }) => {
  const { t } = useT();
  const byId = React.useMemo(
    () => new Map(testRuns.map((run) => [run.id, run])),
    [testRuns],
  );
  const rows = (groups ?? [])
    .map((group) => {
      const key: QueueKey = { kind: "group", fingerprint: group.fingerprint };
      const ids = queueIds(key, testRuns, groups ?? []);
      return { group, key, ids };
    })
    .filter((row) => row.ids.length > 0);

  if (overview.verdict !== "waiting" && overview.verdict !== "running") {
    return (
      <Card
        title={t("overview.decisions")}
        index={6}
        testId="overviewDecisions"
      >
        <Head
          columns="minmax(0, 1fr) auto"
          cells={[[t("overview.decisions")], [""]]}
        />
        {overview.progress.people.map((person) => (
          <Row key={person.name ?? "?"} columns="minmax(0, 1fr) auto">
            <span>{person.name ?? t("overview.someone")}</span>
            <span style={{ color: tokens.textSecondary }}>
              {t("overview.personDecisions", {
                approved: person.approved,
                rejected: person.rejected,
              })}
            </span>
          </Row>
        ))}
      </Card>
    );
  }
  return (
    <Card title={t("overview.toDecide")} index={6} testId="overviewToDecide">
      <Head
        columns={DECIDE_COLUMNS}
        cells={[[t("overview.group")], [t("overview.screens")], [""], [""]]}
      />
      {rows.length === 0 && (
        <Box sx={{ p: 2, color: tokens.textSecondary, fontSize: 13 }}>
          {groups ? t("overview.nothingToDecide") : "…"}
        </Box>
      )}
      {rows.map(({ group, key, ids }) => (
        <Row
          key={group.id}
          columns={DECIDE_COLUMNS}
          onClick={() => actions.openQueue(key)}
          label={
            group.kind === "new" ? t("groups.newScreenshots") : group.title
          }
          testId="overviewGroup"
        >
          {group.kind === "new" ? (
            <span>
              <StatusPill tone="new" label={t("groups.newScreenshots")} />
            </span>
          ) : (
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
              {group.title}
            </Typography>
          )}
          <Box sx={{ display: "flex", gap: 0.625 }}>
            {ids.slice(0, 3).map((id) => {
              const run = byId.get(id);
              return run ? (
                <Thumb
                  key={id}
                  run={run}
                  onOpen={() => actions.openQueue(key, id)}
                />
              ) : null;
            })}
          </Box>
          <Num value={ids.length} />
          <ChevronRight sx={{ fontSize: 18, color: tokens.textMuted }} />
        </Row>
      ))}
    </Card>
  );
};

const TABLE_COLUMNS = "minmax(0, 1fr) 80px 52px 40px";

const Devices: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
  return (
    <Card title={t("overview.devices")} index={7} testId="overviewDevices">
      <Head
        columns={TABLE_COLUMNS}
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
            columns={TABLE_COLUMNS}
            label={`${row.device} ${row.os}`}
            testId="overviewDevice"
            onClick={
              waiting
                ? () => actions.openQueue({ kind: "device", profile })
                : undefined
            }
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.25,
              }}
            >
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                {row.device || "—"}
              </Typography>
              <Typography
                noWrap
                sx={{ fontSize: 11.5, color: tokens.textSecondary }}
              >
                {[row.os, row.browser, row.viewport]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
            </Box>
            <ResultBar outcome={row} />
            <Num value={waiting} />
            <Num value={row.a11yNew} />
          </Row>
        );
      })}
    </Card>
  );
};

const BUG_COLUMNS = "24px 104px minmax(0, 1fr) auto";

const Bugs: React.FunctionComponent<{
  overview: Overview;
  actions: OverviewActions;
}> = ({ overview, actions }) => {
  const { t } = useT();
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
      {overview.bugs.length === 0 && (
        <Box sx={{ p: 2, color: tokens.textSecondary, fontSize: 13 }}>
          {t("overview.noBugs")}
        </Box>
      )}
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

/** The build's Overview tab (031): its state, what to decide, where, and its bugs. */
export const BuildOverview: React.FunctionComponent<{
  overview: Overview | null;
  failed: boolean;
  groups: ChangeGroup[] | null;
  actions: OverviewActions;
}> = ({ overview, failed, groups, actions }) => {
  const { t } = useT();
  const { testRuns } = useTestRunState();
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
      <Verdict overview={overview} />
      <Tiles overview={overview} actions={actions} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          gap: 1.75,
          alignItems: "start",
        }}
      >
        <ToDecide
          overview={overview}
          groups={groups}
          testRuns={testRuns}
          actions={actions}
        />
        <Devices overview={overview} actions={actions} />
        <Bugs overview={overview} actions={actions} />
      </Box>
    </Box>
  );
};
