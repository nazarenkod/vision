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

const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : "—";

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
    enqueueSnackbar(`Deleted ${done} baselines`, { variant: "success" });
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
          Insights
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
          label="Period"
          value={days}
          onChange={(event) => changePeriod(Number(event.target.value))}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160, ...pillField() }}
          data-testid="insightsPeriod"
        >
          {PERIODS.map((period) => (
            <MenuItem key={period} value={period}>
              Last {period} days
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
          title="Could not load the insights."
          reason={loadError}
          onRetry={load}
        />
      )}
      {data && (
        <>
          {data.partialHistory && (
            <Alert severity="info">
              Stored history starts on {date(data.historyStart)} (the oldest
              build kept: the project is younger, or older builds were removed
              by its build limit). “Unused” means unused since then.
            </Alert>
          )}

          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <Stat label="baselines" value={data.summary.baselines} />
            <Stat
              label={`unused for ${data.days} days`}
              value={data.summary.unused}
              tone={data.summary.unused ? "warning" : undefined}
            />
            <Stat
              label={`of ${data.summary.runs} runs changed`}
              value={`${data.summary.changedPercent}%`}
            />
            <Stat
              label="flips (changed, then back)"
              value={data.summary.flips}
              tone={data.summary.flips ? "danger" : undefined}
            />
            <Stat
              label="accessibility issues"
              value={data.summary.a11yIssues}
            />
            <Stat label="waiting for a decision" value={data.summary.waiting} />
            <Stat
              label="median time to a decision"
              value={
                data.summary.medianDecisionHours === null
                  ? "—"
                  : `${data.summary.medianDecisionHours} h`
              }
            />
          </Box>

          <Section
            title="Unused baselines"
            hint={`Nothing was compared with these in the last ${data.days} days${data.partialHistory ? " of history" : ""}: the screen was renamed, removed from the tests, or the device is gone. Deleting a baseline removes its images and history.`}
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
                      ? "Select none"
                      : "Select all"}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    disabled={!selected.size || deleting}
                    onClick={() => setConfirm(true)}
                  >
                    Delete {selected.size || ""}
                  </Button>
                </Box>
              ) : undefined
            }
          >
            {data.unused.length === 0 ? (
              <Empty text="Every baseline was used." />
            ) : (
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {canEdit && <TableCell padding="checkbox" />}
                      <TableCell>Check</TableCell>
                      <TableCell>Device</TableCell>
                      <TableCell>Branch</TableCell>
                      <TableCell>Last used</TableCell>
                      <TableCell align="right">Idle, days</TableCell>
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
                                "aria-label": `Select ${item.name}`,
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          {checkName(item)}{" "}
                          {!item.hasBaseline && (
                            <StatusPill tone="neutral" label="never approved" />
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
            title="Unstable screens"
            hint="Flips: the screen differed, then matched the same baseline again with nobody changing it. That is the screen moving, not the app: animations, data, timing. Screens that change on most runs or get new baselines often are listed after them."
          >
            {data.unstable.length === 0 ? (
              <Empty text="No screen changed often enough to stand out." />
            ) : (
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Check</TableCell>
                      <TableCell>Devices</TableCell>
                      <TableCell align="right">Runs</TableCell>
                      <TableCell align="right">Changed</TableCell>
                      <TableCell align="right">Flips</TableCell>
                      <TableCell align="right">Rejected</TableCell>
                      <TableCell align="right">New baselines</TableCell>
                      <TableCell>Last change</TableCell>
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
                          {item.changedPercent}%
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
              title="Accessibility hotspots"
              hint="Screens with the most issues in their newest screenshot (the worst device counts), with the bugs filed and false positives marked on them."
            >
              {data.a11yScreens.length === 0 ? (
                <Empty text="No accessibility issues, or no screenshots came with a UI tree." />
              ) : (
                <TableContainer sx={{ maxHeight: 380 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Check</TableCell>
                        <TableCell align="right">Issues</TableCell>
                        <TableCell align="right">New</TableCell>
                        <TableCell align="right">Bugs filed</TableCell>
                        <TableCell align="right">False positives</TableCell>
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
              title="Most frequent issues"
              hint="Across the newest screenshot of each check: what to fix once, in a shared component or style, to clear many screens."
            >
              {data.a11yRules.length === 0 ? (
                <Empty text="Nothing to rank." />
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
                    <Typography variant="body2">{rule.rule}</Typography>
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
            <Section
              title="Noise that gets approved"
              hint="Tiny changes (under 0.2 %) approved again and again. A tolerance, or an element rule for the part that moves, would stop sending them to review."
            >
              {data.noise.length === 0 ? (
                <Empty text="No screen keeps getting tiny changes approved." />
              ) : (
                data.noise.map((item) => (
                  <Typography key={checkName(item)} variant="body2">
                    <b>{checkName(item)}</b>: {item.tinyApproved} tiny changes
                    approved in {item.runs} runs
                  </Typography>
                ))
              )}
            </Section>
            <Section
              title="Screenshot quality"
              hint="Taken while something was still loading, or with element changes the pixels did not show. Usually a missing wait in the test."
            >
              {data.captureIssues.length === 0 ? (
                <Empty text="No screen stands out." />
              ) : (
                data.captureIssues.map((item) => (
                  <Typography key={checkName(item)} variant="body2">
                    <b>{checkName(item)}</b>:{" "}
                    {[
                      item.loading ? `${item.loading} taken while loading` : "",
                      item.hidden ? `${item.hidden} with hidden changes` : "",
                    ]
                      .filter(Boolean)
                      .join(", ")}{" "}
                    of {item.runs} runs
                  </Typography>
                ))
              )}
            </Section>
          </Box>

          <Section
            title="Device coverage"
            hint="Checks that run on other devices of the main branch but not on this one."
          >
            {data.coverage.length === 0 ? (
              <Empty text="Every device runs every check." />
            ) : (
              data.coverage.map((entry) => (
                <Box key={entry.device}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {entry.device}: {entry.missingCount} missing of{" "}
                    {entry.checks + entry.missingCount}
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
        title={`Delete ${selected.size} baselines?`}
        submitButtonText="Delete"
        onCancel={() => setConfirm(false)}
        onSubmit={deleteSelected}
        content={
          <Typography variant="body2">
            Their images and history go too. A check that runs again later comes
            back as new.
          </Typography>
        }
      />
    </Box>
  );
};

export default InsightsPage;
