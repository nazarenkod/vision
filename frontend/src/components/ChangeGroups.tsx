import React from "react";
import {
  Box,
  Button,
  Typography,
  Skeleton,
  Tooltip,
  ButtonBase,
  IconButton,
  Collapse,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { v4 as uuid } from "uuid";
import { AccessTimeOutlined, ExpandMore } from "@mui/icons-material";
import { useTestRunState } from "../contexts";
import { insightsService, staticService, testRunService } from "../services";
import {
  AiStatus,
  CaptureWarning,
  ChangeGroup,
  GroupSummary,
  StructuralChange,
  TestRun,
  captureWarnings,
} from "../types";
import { buildTestRunLocation } from "../_helpers/route.helpers";
import { BaseModal } from "./BaseModal";
import { PillTone, StatusPill } from "./StatusPill";
import { motion, tokens } from "../theme";
import { staggered } from "./motion/Stagger";
import { shimmer } from "./SkeletonList";
import { EmptyState } from "./EmptyState";
import { useDecisionSnackbar } from "./useDecisionSnackbar";

const MAX_THUMBS = 6;
const MAX_AUTO_SUMMARIES = 10;
const REFRESH_DELAY_MS = 800;

let aiStatusRequest: Promise<AiStatus | null> | null = null;
/** AI status is per instance; asked once per page load. */
export const useAiStatus = (): AiStatus | null => {
  const [status, setStatus] = React.useState<AiStatus | null>(null);
  React.useEffect(() => {
    aiStatusRequest =
      aiStatusRequest ?? insightsService.aiStatus().catch(() => null);
    aiStatusRequest.then(setStatus);
  }, []);
  return status;
};

const variantLabel = (run: TestRun) =>
  [run.device, run.browser, run.viewport, run.customTags]
    .filter(Boolean)
    .join(" · ") || run.name;

export function describeChange(change: StructuralChange): string {
  switch (change.kind) {
    case "text":
    case "label":
      return `${change.kind === "text" ? "Text" : "Label"} of ${change.element}: “${change.before}” → “${change.after}”`;
    case "added":
      return `${change.element} appeared`;
    case "removed":
      return `${change.element} disappeared`;
    case "resized":
      return `${change.element} resized ${change.before} → ${change.after} dp`;
    case "state":
      return `${change.element}: ${change.before} → ${change.after}`;
    default:
      return `${change.element} moved`;
  }
}

const VERDICT: Record<
  GroupSummary["verdict"],
  { tone: PillTone; label: string }
> = {
  intended: { tone: "passed", label: "Likely intended" },
  regression: { tone: "failed", label: "Possible regression" },
  noise: { tone: "neutral", label: "Probably noise" },
};

const Tag: React.FunctionComponent<{
  children: React.ReactNode;
  color?: string;
}> = ({ children, color }) => (
  <Box
    component="span"
    sx={{
      font: `600 10.5px ${tokens.mono}`,
      color: color ?? tokens.textSecondary,
      border: `1px solid ${color ?? tokens.a11yExisting}`,
      borderRadius: "4px",
      px: 0.5,
      lineHeight: "16px",
      flexShrink: 0,
    }}
  >
    {children}
  </Box>
);

const Thumb: React.FunctionComponent<{ run: TestRun; onOpen: () => void }> = ({
  run,
  onOpen,
}) => (
  <ButtonBase
    onClick={onOpen}
    aria-label={`Open ${run.name} ${variantLabel(run)}`}
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: 0.75,
      width: 112,
      borderRadius: 2,
      "&:hover .thumb, &:focus-visible .thumb": {
        transform: "translateY(-2px)",
      },
    }}
  >
    <Box
      className="thumb"
      component="img"
      src={staticService.getImage(
        run.diffThumbnailName ?? run.imageThumbnailName ?? run.imageName,
      )}
      alt=""
      loading="lazy"
      sx={{
        width: 112,
        height: 160,
        // whole screen: a change at the bottom (a menu) must show too
        objectFit: "contain",
        borderRadius: 2,
        p: 0.75,
        boxSizing: "border-box",
        background: tokens.lightbox,
        boxShadow: tokens.shadowShot,
        transition: `transform ${motion.base}ms ${motion.easing}`,
      }}
    />
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: 0.5,
        font: `400 11px ${tokens.mono}`,
      }}
    >
      <Typography noWrap sx={{ font: "inherit", color: tokens.textSecondary }}>
        {variantLabel(run)}
      </Typography>
      {run.diffPercent > 0 && (
        <span style={{ color: tokens.diff, flexShrink: 0 }}>
          {run.diffPercent.toFixed(1)}%
        </span>
      )}
    </Box>
    <RunFlags run={run} />
  </ButtonBase>
);

const FLAG_LABEL: Record<CaptureWarning["kind"], string> = {
  loading: "Loading",
  "screen-mismatch": "Other screen?",
  "duplicate-screen": "Duplicate?",
};

/** Small flags for what the UI tree noticed about a screenshot. */
export const RunFlags: React.FunctionComponent<{ run: TestRun }> = ({
  run,
}) => {
  const warnings = captureWarnings(run);
  if (!warnings.length && !run.semanticChangeCount) return null;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {warnings.map((warning) => (
        <Tooltip key={warning.kind} title={warning.message}>
          <span>
            <StatusPill
              tone="failed"
              label={FLAG_LABEL[warning.kind] ?? warning.kind}
            />
          </span>
        </Tooltip>
      ))}
      {!!run.semanticChangeCount && (
        <Tooltip title="Elements changed in ways the screenshot does not show: labels, states, invisible controls">
          <span>
            <StatusPill
              tone="changed"
              label={`${run.semanticChangeCount} hidden`}
            />
          </span>
        </Tooltip>
      )}
    </Box>
  );
};

interface Props {
  buildId: string;
  onCountChange?: (count: number) => void;
}

/**
 * The build's screenshots that need a decision, grouped by the change they
 * carry: one card per change, with one approve or reject for all of it.
 */
export const ChangeGroups: React.FunctionComponent<Props> = ({
  buildId,
  onCountChange,
}) => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const announce = useDecisionSnackbar();
  const { testRuns } = useTestRunState();
  const aiStatus = useAiStatus();
  const [groups, setGroups] = React.useState<ChangeGroup[] | null>(null);
  const [summaries, setSummaries] = React.useState<
    Record<string, GroupSummary | "loading" | "error">
  >({});
  const [confirm, setConfirm] = React.useState<{
    group: ChangeGroup;
    action: "approve" | "reject";
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const toggleGroup = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // refetch when a decision changes what still needs one
  const pendingKey = React.useMemo(
    () =>
      testRuns
        .filter(
          (run) =>
            run.buildId === buildId &&
            (run.status === "unresolved" || run.status === "new"),
        )
        .map((run) => `${run.id}:${run.diffPercent}`)
        .sort()
        .join(","),
    [testRuns, buildId],
  );

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () => {
        insightsService
          .getGroups(buildId)
          .then((result) => !cancelled && setGroups(result))
          .catch(
            (error) =>
              !cancelled &&
              enqueueSnackbar(`Cannot load change groups: ${error}`, {
                variant: "error",
              }),
          );
      },
      groups ? REFRESH_DELAY_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // groups is read only to skip the delay on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId, pendingKey, enqueueSnackbar]);

  React.useEffect(() => setGroups(null), [buildId]);

  React.useEffect(() => {
    onCountChange?.(groups?.filter((g) => g.kind !== "new").length ?? 0);
  }, [groups, onCountChange]);

  const summarize = React.useCallback(
    (group: ChangeGroup) => {
      setSummaries((current) => ({ ...current, [group.id]: "loading" }));
      insightsService
        .groupSummary(buildId, group.id)
        .then((summary) =>
          setSummaries((current) => ({ ...current, [group.id]: summary })),
        )
        .catch(() =>
          setSummaries((current) => ({ ...current, [group.id]: "error" })),
        );
    },
    [buildId],
  );

  // AI answers are cached server-side and capped per day, so the first cards explain themselves
  React.useEffect(() => {
    if (!aiStatus?.enabled || !groups) return;
    groups
      .filter((group) => group.kind !== "new" && !(group.id in summaries))
      .slice(0, MAX_AUTO_SUMMARIES)
      .forEach(summarize);
  }, [aiStatus?.enabled, groups, summaries, summarize]);

  const open = (run: TestRun) =>
    navigate(buildTestRunLocation(buildId, run.id));

  const decide = async () => {
    if (!confirm) return;
    const ids = confirm.group.testRuns.map((run) => run.id);
    setBusy(true);
    try {
      const decision =
        confirm.action === "approve"
          ? await testRunService.approveBulk(
              ids,
              confirm.group.testRuns.some((run) => run.merge),
            )
          : await testRunService.rejectBulk(ids);
      announce(confirm.action, ids.length, decision);
    } catch (error) {
      enqueueSnackbar(`${error}`, { variant: "error" });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const ignoreNoise = async (group: ChangeGroup) => {
    if (!group.noise?.ignoreArea) return;
    try {
      await testRunService.addIgnoreAreas({
        ids: group.testRuns.map((run) => run.id),
        ignoreAreas: [{ id: uuid(), ...group.noise.ignoreArea }],
      });
      enqueueSnackbar("Ignore area added; the screenshots are compared again", {
        variant: "success",
      });
    } catch (error) {
      enqueueSnackbar(`${error}`, { variant: "error" });
    }
  };

  if (!groups) {
    return (
      <Box
        aria-busy="true"
        sx={{ px: 3, py: 2, display: "flex", flexDirection: "column", gap: 2 }}
      >
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ ...shimmer, height: 140, borderRadius: 3 }} />
        ))}
      </Box>
    );
  }

  if (!groups.length) {
    return (
      <EmptyState title="Nothing needs a decision in this build">
        Every screenshot matches its baseline or has been reviewed.
      </EmptyState>
    );
  }

  return (
    <Box
      sx={{ px: 3, py: 2, display: "flex", flexDirection: "column", gap: 2 }}
    >
      {groups.map((group, index) => {
        const summary = summaries[group.id];
        const many = group.testRuns.length > 1;
        const noise = group.noise;
        const expanded = !collapsed.has(group.id);
        return (
          <Box
            key={group.id}
            component="section"
            aria-label={group.title}
            data-testid="changeGroup"
            {...staggered(index, groups.length)}
            sx={{
              bgcolor: tokens.surface,
              border: `1px ${noise ? "dashed" : "solid"} ${noise ? tokens.borderStrong : tokens.border}`,
              borderRadius: 3,
              px: 2,
              py: 1.5,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "8px 12px",
              }}
            >
              <IconButton
                size="small"
                aria-label={expanded ? "Collapse group" : "Expand group"}
                aria-expanded={expanded}
                data-testid="toggleGroup"
                onClick={() => toggleGroup(group.id)}
                sx={{ ml: -0.75, color: tokens.textMuted }}
              >
                <ExpandMore
                  sx={{
                    transform: expanded ? "none" : "rotate(-90deg)",
                    transition: `transform ${motion.nav}ms ${motion.easing}`,
                  }}
                />
              </IconButton>
              {noise && (
                <AccessTimeOutlined
                  sx={{ color: tokens.textMuted, fontSize: 20 }}
                />
              )}
              <Typography variant="h6" component="h3">
                {group.kind === "new" ? "New screenshots" : group.title}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {group.kind === "new"
                  ? `${group.testRuns.length} without a baseline`
                  : group.kind === "component"
                    ? `Changed the same way on ${group.screens.length} screens`
                    : `${many ? `Same change in ${group.testRuns.length} screenshots` : "1 screenshot"}${
                        group.screens.length > 1
                          ? ` · ${group.screens.length} screens`
                          : ""
                      }`}
              </Typography>
              <Box sx={{ flex: 1 }} />
              {noise?.ignoreArea && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => ignoreNoise(group)}
                >
                  {noise.kind === "status-bar"
                    ? "Ignore status bar"
                    : "Ignore this area"}
                </Button>
              )}
              <Button
                variant="outlined"
                size="small"
                color="error"
                sx={{ color: tokens.status.failed.fg }}
                onClick={() => setConfirm({ group, action: "reject" })}
              >
                {many ? "Reject all" : "Reject"}
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => setConfirm({ group, action: "approve" })}
              >
                {group.kind === "new"
                  ? "Accept as baselines"
                  : many
                    ? `Approve all ${group.testRuns.length}`
                    : "Approve"}
              </Button>
            </Box>

            <Collapse in={expanded} timeout={motion.slow}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  pt: 1.5,
                }}
              >
                {noise && (
                  <Typography variant="body2" color="textSecondary">
                    {noise.message}
                  </Typography>
                )}

                {!!group.alsoChangedElsewhere?.length && (
                  <Typography variant="body2" color="textSecondary">
                    The component changed the same way on{" "}
                    {group.alsoChangedElsewhere.map((run, index) => (
                      <React.Fragment key={run.id}>
                        {index > 0 && ", "}
                        <ButtonBase
                          onClick={() => open(run)}
                          sx={{
                            font: "inherit",
                            color: tokens.brand,
                            textDecoration: "underline",
                            verticalAlign: "baseline",
                          }}
                        >
                          {run.name}
                        </ButtonBase>
                      </React.Fragment>
                    ))}{" "}
                    too, but those changed elsewhere as well and are reviewed on
                    their own.
                  </Typography>
                )}

                {group.changes.slice(0, 3).map((change) => (
                  <Box
                    key={`${change.kind}:${change.key}`}
                    sx={{
                      display: "flex",
                      gap: 1,
                      alignItems: "baseline",
                      fontSize: 13.5,
                    }}
                  >
                    <Tag>UI TREE</Tag>
                    <span>{describeChange(change)}</span>
                  </Box>
                ))}

                {group.kind !== "new" && aiStatus?.enabled && (
                  <Box
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 1,
                      alignItems: "baseline",
                      fontSize: 13.5,
                    }}
                  >
                    <Tag color={tokens.brand}>AI</Tag>
                    {summary === "loading" || summary === undefined ? (
                      <Skeleton width={360} />
                    ) : summary === "error" ? (
                      <Button size="small" onClick={() => summarize(group)}>
                        Explain this change
                      </Button>
                    ) : (
                      <>
                        <span>{summary.summary}</span>
                        <StatusPill
                          tone={VERDICT[summary.verdict].tone}
                          label={`${VERDICT[summary.verdict].label} · ${summary.confidence.toFixed(2)}`}
                          title={
                            summary.source === "rules"
                              ? "Decided by rules, no AI call"
                              : `Model: ${summary.model}`
                          }
                        />
                      </>
                    )}
                  </Box>
                )}

                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1.5,
                    alignItems: "center",
                  }}
                >
                  {group.testRuns.slice(0, MAX_THUMBS).map((run) => (
                    <Thumb key={run.id} run={run} onOpen={() => open(run)} />
                  ))}
                  {group.testRuns.length > MAX_THUMBS && (
                    <Tooltip title="Open the first one to step through all of them">
                      <Typography variant="body2" color="textSecondary">
                        + {group.testRuns.length - MAX_THUMBS} more
                      </Typography>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Collapse>
          </Box>
        );
      })}

      <BaseModal
        open={!!confirm}
        title={
          confirm
            ? `${confirm.action === "approve" ? "Approve" : "Reject"} ${confirm.group.testRuns.length} screenshot${
                confirm.group.testRuns.length > 1 ? "s" : ""
              }?`
            : ""
        }
        submitButtonText={confirm?.action === "approve" ? "Approve" : "Reject"}
        onCancel={() => setConfirm(null)}
        onSubmit={decide}
        content={
          <Typography>
            {confirm?.action === "approve"
              ? "They become the new baselines for their screens and devices."
              : "They stay as they are and the build keeps failing until fixed."}
            {busy ? " Working…" : ""}
          </Typography>
        }
      />
    </Box>
  );
};
