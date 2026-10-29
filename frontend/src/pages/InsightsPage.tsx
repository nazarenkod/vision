import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { pillField } from "../components/pillField";
import ProjectSelect from "../components/ProjectSelect";
import { BaseModal } from "../components/BaseModal";
import { StatusPill } from "../components/StatusPill";
import { insightsService, testVariationService } from "../services";
import { ProjectInsights } from "../types";
import { useUserState } from "../contexts";
import { routes } from "../constants";
import { motion, tokens } from "../theme";
import { CountUp } from "../components/motion/useCountUp";
import { ErrorState } from "../components/EmptyState";
import { shimmer } from "../components/SkeletonList";
import { barShare, largest } from "../_helpers/insights.helper";
import { MessageKey, useT } from "../i18n";

const PERIODS = [30, 90, 180, 365];
const PERIOD_KEY = "vision.insightsDays";

const readPeriod = () => {
  try {
    const value = Number(localStorage.getItem(PERIOD_KEY));
    return PERIODS.includes(value) ? value : 90;
  } catch {
    return 90;
  }
};

const checkName = (item: { name: string; customTags: string }) =>
  item.customTags ? `${item.name} [${item.customTags}]` : item.name;

const RULE_KEY: Record<string, MessageKey> = {
  "touch-target": "a11y.rule.touchTarget",
  "low-contrast": "a11y.rule.lowContrast",
  "missing-label": "a11y.rule.missingLabel",
  "input-without-label": "a11y.rule.inputWithoutLabel",
  "duplicate-label": "a11y.rule.duplicateLabel",
  "redundant-role": "a11y.rule.redundantRole",
  "not-accessible": "a11y.rule.notAccessible",
};

const Section: React.FunctionComponent<{
  title: string;
  hint: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, hint, action, children }) => (
  <Box
    component="section"
    className="v-enter"
    sx={{
      bgcolor: tokens.surface,
      border: `1px solid ${tokens.border}`,
      borderRadius: 3,
      p: 2.5,
      display: "flex",
      flexDirection: "column",
      gap: 1.5,
    }}
  >
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="textSecondary">
          {hint}
        </Typography>
      </Box>
      {action}
    </Box>
    {children}
  </Box>
);

const Empty: React.FunctionComponent<{ text: string }> = ({ text }) => (
  <Typography variant="body2" color="textSecondary" sx={{ py: 1 }}>
    {text}
  </Typography>
);

const Stat: React.FunctionComponent<{
  label: string;
  value: React.ReactNode;
  tone?: "warning" | "danger";
}> = ({ label, value, tone }) => (
  <Box
    sx={{
      bgcolor: tokens.surface,
      border: `1px solid ${tokens.border}`,
      borderRadius: 3,
      px: 2,
      py: 1.5,
      minWidth: 150,
      flex: "1 1 150px",
    }}
  >
    <Typography
      sx={{
        fontSize: 26,
        fontWeight: 650,
        letterSpacing: "-0.01em",
        fontVariantNumeric: "tabular-nums",
        color:
          tone === "danger"
            ? tokens.status.failed.fg
            : tone === "warning"
              ? tokens.status.changed.fg
              : tokens.text,
      }}
    >
      {typeof value === "number" ? <CountUp value={value} /> : value}
    </Typography>
    <Typography variant="body2" color="textSecondary">
      {label}
    </Typography>
  </Box>
);

/** A number with a thin bar: its share of the largest in the table. */
const Amount: React.FunctionComponent<{
  value: number;
  max: number;
  colour: string;
}> = ({ value, max, colour }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 110 }}>
    <Box
      component="b"
      sx={{ fontVariantNumeric: "tabular-nums", minWidth: 22, fontWeight: 600 }}
    >
      {value}
    </Box>
    <Box
      aria-hidden="true"
      sx={{
        flex: 1,
        height: 6,
        borderRadius: 3,
        bgcolor: tokens.subtle,
        overflow: "hidden",
      }}
    >
      <Box
        data-testid="amountBar"
        style={{ width: `${barShare(value, max)}%` }}
        sx={{
          height: "100%",
          borderRadius: 3,
          bgcolor: colour,
          animation: `v-fill 700ms ${motion.easing} both 200ms`,
        }}
      />
    </Box>
  </Box>
);

/**
 * What a project's history says: baselines nobody uses, screens that keep
 * changing or flipping, the worst screens for accessibility, noise to tolerate,
 * screenshots taken too early, and checks a device is missing.
 */
const InsightsPage: React.FunctionComponent = () => {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { t, formatDate, formatNumber } = useT();
  // the parts toLocaleDateString shows
  const date = (value: string | null) =>
    value
      ? formatDate(value, { year: "numeric", month: "numeric", day: "numeric" })
      : "—";
  const { user } = useUserState();
  const canEdit = user?.role === "admin" || user?.role === "editor";
  const [days, setDays] = React.useState(readPeriod);
  const [data, setData] = React.useState<ProjectInsights | null>();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirm, setConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const [loadError, setLoadError] = React.useState<string>();
  const load = React.useCallback(() => {
    if (!projectId) return;
    setData(undefined);
    insightsService
      .getProjectInsights(projectId, days)
      .then((result) => {
        setData(result);
        setSelected(new Set());
      })
      .catch((error) => {
        setData(null);
        // the reason stays on the page, next to Try again
        setLoadError(String(error));
      });
  }, [projectId, days]);

  React.useEffect(load, [load]);

  const changePeriod = (value: number) => {
    setDays(value);
    try {
      localStorage.setItem(PERIOD_KEY, String(value));
    } catch {
      // a convenience only
    }
  };

  const deleteSelected = async () => {
    setConfirm(false);
    setDeleting(true);
    let done = 0;
    for (const id of selected) {
      try {
        await testVariationService.remove(id);
        done++;
      } catch (error) {
        enqueueSnackbar(String(error), { variant: "error" });
      }
    }
    setDeleting(false);
    enqueueSnackbar(t("insights.deleted", { count: done }), {
      variant: "success",
    });
    load();
  };

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Box
      sx={{ px: 4, py: 3, display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="h4" component="h1">
          {t("insights.title")}
        </Typography>
        <ProjectSelect
          compact
          projectId={projectId}
          onProjectSelect={(id) => navigate(`${routes.INSIGHTS_PAGE}/${id}`)}
        />
        <Box sx={{ flex: 1 }} />
        <TextField
          select
          size="small"
          label={t("insights.period")}
          value={days}
          onChange={(event) => changePeriod(Number(event.target.value))}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160, ...pillField() }}
          data-testid="insightsPeriod"
        >
          {PERIODS.map((period) => (
            <MenuItem key={period} value={period}>
              {t("insights.lastDays", { count: period })}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {data === undefined && (
        <Box
          aria-busy="true"
          sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
        >
          <Box sx={{ display: "flex", gap: 1.5 }}>
            {[0, 1, 2, 3].map((i) => (
              <Box
                key={i}
                sx={{ ...shimmer, height: 76, flex: 1, borderRadius: 3 }}
              />
            ))}
          </Box>
          <Box sx={{ ...shimmer, height: 240, borderRadius: 3 }} />
        </Box>
      )}
      {data === null && (
        <ErrorState
          title={t("insights.loadFailed")}
          reason={loadError}
          onRetry={load}
        />
      )}
      {data && (
        <>
          {data.partialHistory && (
            <Alert severity="info">
              {t("insights.partial", { date: date(data.historyStart) })}
            </Alert>
          )}

          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <Stat
              label={t("insights.baselines")}
              value={data.summary.baselines}
            />
            <Stat
              label={t("insights.unusedFor", { count: data.days })}
              value={data.summary.unused}
              tone={data.summary.unused ? "warning" : undefined}
            />
            <Stat
              label={t("insights.changedOf", { count: data.summary.runs })}
              value={`${formatNumber(data.summary.changedPercent)}%`}
            />
            <Stat
              label={t("insights.flips")}
              value={data.summary.flips}
              tone={data.summary.flips ? "danger" : undefined}
            />
            <Stat
              label={t("insights.a11yIssues")}
              value={data.summary.a11yIssues}
            />
            <Stat label={t("insights.waiting")} value={data.summary.waiting} />
            <Stat
              label={t("insights.median")}
              value={
                data.summary.medianDecisionHours === null
                  ? "—"
                  : t("insights.hours", {
                      count: data.summary.medianDecisionHours,
                    })
              }
            />
          </Box>

          <Section
            title={t("insights.unused")}
            hint={t(
              data.partialHistory
                ? "insights.unusedHintPartial"
                : "insights.unusedHint",
              { count: data.days },
            )}
            action={
              canEdit && data.unused.length > 0 ? (
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    onClick={() =>
                      setSelected(
                        selected.size === data.unused.length
                          ? new Set()
                          : new Set(data.unused.map((item) => item.id)),
                      )
                    }
                  >
                    {selected.size === data.unused.length
                      ? t("insights.selectNone")
                      : t("insights.selectAll")}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    disabled={!selected.size || deleting}
                    onClick={() => setConfirm(true)}
                  >
                    {t("insights.delete", { count: selected.size || "" })}
                  </Button>
                </Box>
              ) : undefined
            }
          >
            {data.unused.length === 0 ? (
              <Empty text={t("insights.allUsed")} />
            ) : (
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {canEdit && <TableCell padding="checkbox" />}
                      <TableCell>{t("insights.check")}</TableCell>
                      <TableCell>{t("insights.device")}</TableCell>
                      <TableCell>{t("insights.branch")}</TableCell>
                      <TableCell>{t("insights.lastUsed")}</TableCell>
                      <TableCell align="right">
                        {t("insights.idleDays")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.unused.map((item) => (
                      <TableRow key={item.id} hover>
                        {canEdit && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={selected.has(item.id)}
                              onChange={() => toggle(item.id)}
                              inputProps={{
                                "aria-label": t("insights.select", {
                                  name: item.name,
                                }),
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          {checkName(item)}{" "}
                          {!item.hasBaseline && (
                            <StatusPill
                              tone="neutral"
                              label={t("insights.neverApproved")}
                            />
                          )}
                        </TableCell>
                        <TableCell>{item.device}</TableCell>
                        <TableCell
                          sx={{ fontFamily: tokens.mono, fontSize: 13 }}
                        >
                          {item.branchName}
                        </TableCell>
                        <TableCell>{date(item.lastUsedAt)}</TableCell>
                        <TableCell align="right">{item.idleDays}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Section>

          <Section
            title={t("insights.unstable")}
            hint={t("insights.unstableHint")}
          >
            {data.unstable.length === 0 ? (
              <Empty text={t("insights.noUnstable")} />
            ) : (
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("insights.check")}</TableCell>
                      <TableCell>{t("insights.devices")}</TableCell>
                      <TableCell align="right">{t("insights.runs")}</TableCell>
                      <TableCell align="right">
                        {t("insights.changed")}
                      </TableCell>
                      <TableCell align="right">
                        {t("insights.flipsColumn")}
                      </TableCell>
                      <TableCell align="right">
                        {t("insights.rejected")}
                      </TableCell>
                      <TableCell align="right">
                        {t("insights.newBaselines")}
                      </TableCell>
                      <TableCell>{t("insights.lastChange")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.unstable.map((item) => (
                      <TableRow key={checkName(item)} hover>
                        <TableCell>{checkName(item)}</TableCell>
                        <TableCell sx={{ color: tokens.textSecondary }}>
                          {item.devices.join(", ")}
                        </TableCell>
                        <TableCell align="right">{item.runs}</TableCell>
                        <TableCell align="right">
                          {formatNumber(item.changedPercent)}%
                        </TableCell>
                        <TableCell align="right">
                          <Amount
                            value={item.flips}
                            max={largest(data.unstable.map((u) => u.flips))}
                            colour={tokens.status.failed.bar}
                          />
                        </TableCell>
                        <TableCell align="right">{item.rejected}</TableCell>
                        <TableCell align="right">
                          {item.baselineChanges}
                        </TableCell>
                        <TableCell>{date(item.lastChangeAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Section>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
              gap: 2,
            }}
          >
            <Section
              title={t("insights.hotspots")}
              hint={t("insights.hotspotsHint")}
            >
              {data.a11yScreens.length === 0 ? (
                <Empty text={t("insights.noHotspots")} />
              ) : (
                <TableContainer sx={{ maxHeight: 380 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("insights.check")}</TableCell>
                        <TableCell align="right">
                          {t("insights.issues")}
                        </TableCell>
                        <TableCell align="right">{t("insights.new")}</TableCell>
                        <TableCell align="right">
                          {t("insights.bugsFiled")}
                        </TableCell>
                        <TableCell align="right">
                          {t("insights.falsePositives")}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.a11yScreens.map((item) => (
                        <TableRow key={checkName(item)} hover>
                          <TableCell>{checkName(item)}</TableCell>
                          <TableCell align="right">
                            <Amount
                              value={item.issues}
                              max={largest(
                                data.a11yScreens.map((a) => a.issues),
                              )}
                              colour={tokens.a11y}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {item.newIssues ? (
                              <StatusPill
                                tone="changed"
                                label={item.newIssues}
                              />
                            ) : (
                              0
                            )}
                          </TableCell>
                          <TableCell align="right">{item.reported}</TableCell>
                          <TableCell align="right">{item.ignored}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Section>
            <Section
              title={t("insights.frequent")}
              hint={t("insights.frequentHint")}
            >
              {data.a11yRules.length === 0 ? (
                <Empty text={t("insights.nothingToRank")} />
              ) : (
                data.a11yRules.map((rule) => (
                  <Box
                    key={rule.rule}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 2,
                    }}
                  >
                    <Typography variant="body2">
                      {RULE_KEY[rule.rule] ? t(RULE_KEY[rule.rule]) : rule.rule}
                    </Typography>
                    <Box sx={{ width: 160, flexShrink: 0 }}>
                      <Amount
                        value={rule.count}
                        max={largest(data.a11yRules.map((r) => r.count))}
                        colour={tokens.a11y}
                      />
                    </Box>
                  </Box>
                ))
              )}
            </Section>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
              gap: 2,
            }}
          >
            <Section title={t("insights.noise")} hint={t("insights.noiseHint")}>
              {data.noise.length === 0 ? (
                <Empty text={t("insights.noNoise")} />
              ) : (
                data.noise.map((item) => (
                  <Typography key={checkName(item)} variant="body2">
                    <b>{checkName(item)}</b>:{" "}
                    {t("insights.tinyApproved", {
                      count: item.tinyApproved,
                      runs: item.runs,
                    })}
                  </Typography>
                ))
              )}
            </Section>
            <Section
              title={t("insights.quality")}
              hint={t("insights.qualityHint")}
            >
              {data.captureIssues.length === 0 ? (
                <Empty text={t("insights.noQuality")} />
              ) : (
                data.captureIssues.map((item) => (
                  <Typography key={checkName(item)} variant="body2">
                    <b>{checkName(item)}</b>:{" "}
                    {t("insights.withHidden", { count: item.hidden })}{" "}
                    {t("insights.ofRuns", { count: item.runs })}
                  </Typography>
                ))
              )}
            </Section>
          </Box>

          <Section
            title={t("insights.coverage")}
            hint={t("insights.coverageHint")}
          >
            {data.coverage.length === 0 ? (
              <Empty text={t("insights.fullCoverage")} />
            ) : (
              data.coverage.map((entry) => (
                <Box key={entry.device}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t("insights.missing", {
                      device: entry.device,
                      missing: entry.missingCount,
                      total: entry.checks + entry.missingCount,
                    })}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {entry.missing.map(checkName).join(", ")}
                    {entry.missingCount > entry.missing.length ? "…" : ""}
                  </Typography>
                </Box>
              ))
            )}
          </Section>
        </>
      )}

      <BaseModal
        open={confirm}
        title={t("insights.deleteTitle", { count: selected.size })}
        submitButtonText={t("insights.deleteSubmit")}
        onCancel={() => setConfirm(false)}
        onSubmit={deleteSelected}
        content={
          <Typography variant="body2">{t("insights.deleteText")}</Typography>
        }
      />
    </Box>
  );
};

export default InsightsPage;
