import React from "react";
import {
  Alert,
  Box,
  InputAdornment,
  Button,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { backupsService } from "../services";
import { BackupsOverview } from "../types";
import { DriveCard } from "../components/Backups/DriveCard";
import { BackupDay, dayStrip } from "../_helpers/backups.helper";
import { tokens } from "../theme";
import { staggered } from "../components/motion/Stagger";
import { useT } from "../i18n";

const size = (bytes: number | null) =>
  bytes === null ? "" : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const DAY_COLOUR = {
  kept: tokens.status.passed.bar,
  missing: tokens.status.failed.bar,
  rotated: tokens.border,
};

/** The last 14 days at a glance: kept, missed, or past what Drive keeps. */
const DayStrip: React.FunctionComponent<{ days: BackupDay[] }> = ({ days }) => {
  const { t } = useT();
  const missed = days.filter((d) => d.state === "missing").length;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Box
        data-testid="backupDays"
        role="img"
        aria-label={t("backups.lastDaysLabel", { count: days.length, missed })}
        sx={{ display: "flex", gap: 0.5 }}
      >
        {days.map((d, index) => (
          <Tooltip
            key={d.date}
            title={t(
              d.state === "kept"
                ? "backups.dayKept"
                : d.state === "missing"
                  ? "backups.dayMissing"
                  : "backups.dayOld",
              { date: d.date },
            )}
          >
            <Box
              data-state={d.state}
              {...staggered(index, days.length)}
              sx={{
                width: 16,
                height: 16,
                borderRadius: "4px",
                bgcolor: DAY_COLOUR[d.state],
              }}
            />
          </Tooltip>
        ))}
      </Box>
      <Typography variant="caption" color="textSecondary">
        {t("backups.lastDays", { count: days.length })}
        {missed
          ? t("backups.missed", { count: missed })
          : t("backups.noneMissed")}
      </Typography>
    </Box>
  );
};

const BackupsPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t, formatDate } = useT();
  const when = (value: string | null) =>
    value ? formatDate(value) : t("backups.never");
  const [overview, setOverview] = React.useState<BackupsOverview | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [time, setTime] = React.useState("");
  const [keep, setKeep] = React.useState("");
  // what the server has, so Save is offered only for a change
  const [savedSchedule, setSavedSchedule] = React.useState({
    time: "",
    keep: "",
  });

  const load = React.useCallback(
    () =>
      backupsService
        .overview()
        .then((data) => {
          setOverview(data);
          setTime(data.settings.time);
          setKeep(String(data.settings.keep));
          setSavedSchedule({
            time: data.settings.time,
            keep: String(data.settings.keep),
          });
          setLoadError(null);
        })
        .catch((err) => setLoadError(`${err}`)),
    [],
  );

  React.useEffect(() => {
    load();
  }, [load]);

  // the host script picks a request up within 5 minutes; follow it until it is done
  const waiting = !!overview?.runningSince || !!overview?.backupRequestedAt;
  React.useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [waiting, load]);

  const run = () =>
    backupsService
      .run()
      .then(() => {
        enqueueSnackbar(t("backups.requested"), {
          variant: "success",
        });
        load();
      })
      .catch((err) => enqueueSnackbar(`${err}`, { variant: "error" }));

  const saveSettings = () =>
    backupsService
      .saveSettings({ time, keep: Number(keep) })
      .then(() => {
        enqueueSnackbar(t("backups.scheduleSaved"), { variant: "success" });
        load();
      })
      .catch((err) => enqueueSnackbar(`${err}`, { variant: "error" }));

  const scheduleField = (
    id: string,
    label: string,
    help: string,
    field: React.ReactNode,
  ) => (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Typography
        id={id}
        component="label"
        sx={{ fontSize: 13, fontWeight: 600, color: tokens.textSecondary }}
      >
        {label}
      </Typography>
      {field}
      <Typography sx={{ fontSize: 12, color: tokens.textMuted, minHeight: 16 }}>
        {help}
      </Typography>
    </Box>
  );

  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxWidth: 960,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
          {t("backups.title")}
        </Typography>
        <Button
          variant="contained"
          data-testid="backupNow"
          disabled={!overview?.available || waiting}
          onClick={run}
        >
          {t("backups.now")}
        </Button>
      </Box>

      {loadError && <Alert severity="error">{loadError}</Alert>}
      {overview && !overview.available && (
        <Alert severity="info">{t("backups.unavailable")}</Alert>
      )}

      {overview && (
        <>
          <Card variant="outlined" data-testid="backupStatus">
            <CardHeader title={t("backups.status")} />
            <CardContent
              sx={{ display: "flex", flexDirection: "column", gap: 1 }}
            >
              {overview.warning && (
                <Alert severity="warning">{overview.warning}</Alert>
              )}
              {overview.lastError && (
                <Alert severity="error" data-testid="backupError">
                  {t("backups.lastAttemptError", { error: overview.lastError })}
                </Alert>
              )}
              <Typography>
                {t("backups.lastSuccess")}{" "}
                <b data-testid="lastSuccess">{when(overview.lastSuccessAt)}</b>
              </Typography>
              {overview.remote && !overview.remote.error && (
                <DayStrip
                  days={dayStrip(
                    overview.remote.backups,
                    new Date(),
                    overview.settings.keep,
                  )}
                />
              )}
              <Typography>
                {t("backups.lastAttempt", {
                  when: when(overview.lastAttemptAt),
                })}
              </Typography>
              {overview.pendingUploads > 0 && (
                <Typography>
                  {t("backups.waitingUpload", {
                    count: overview.pendingUploads,
                  })}
                </Typography>
              )}
              {overview.runningSince ? (
                <Typography data-testid="backupRunning">
                  {t("backups.running", { when: when(overview.runningSince) })}
                </Typography>
              ) : (
                overview.backupRequestedAt && (
                  <Typography data-testid="backupRequested">
                    {t("backups.askedAt", {
                      when: when(overview.backupRequestedAt),
                    })}
                  </Typography>
                )
              )}
            </CardContent>
          </Card>

          <DriveCard drive={overview.drive} onChange={load} />

          <Card variant="outlined">
            <CardHeader title={t("backups.schedule")} />
            {/* labels above the fields: floating ones were cut to "Daily at (ser…" */}
            <CardContent
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 3,
                alignItems: "flex-end",
              }}
            >
              {scheduleField(
                "backupTimeLabel",
                t("backups.dailyAt"),
                t("backups.dailyAtHelp"),
                <TextField
                  size="small"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  inputProps={{
                    "data-testid": "backupTime",
                    "aria-labelledby": "backupTimeLabel",
                  }}
                  sx={{ width: 150 }}
                />,
              )}
              {scheduleField(
                "backupKeepLabel",
                t("backups.keep"),
                t("backups.keepHelp"),
                <TextField
                  size="small"
                  type="number"
                  value={keep}
                  onChange={(event) => setKeep(event.target.value)}
                  inputProps={{
                    min: 1,
                    max: 365,
                    "data-testid": "backupKeep",
                    "aria-labelledby": "backupKeepLabel",
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {t("backups.keepUnit", { count: Number(keep) || 0 })}
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 150 }}
                />,
              )}
              <Button
                variant="contained"
                data-testid="saveBackupSettings"
                disabled={
                  !overview.available ||
                  (time === savedSchedule.time && keep === savedSchedule.keep)
                }
                onClick={saveSettings}
                // level with the fields, above their helper lines
                sx={{ mb: "22px" }}
              >
                {t("backups.save")}
              </Button>
            </CardContent>
          </Card>

          {overview.remote && (
            <Card variant="outlined">
              <CardHeader title={t("backups.inDrive")} />
              <CardContent>
                {overview.remote.error ? (
                  <Alert severity="error">{overview.remote.error}</Alert>
                ) : overview.remote.backups.length ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("backups.backup")}</TableCell>
                        <TableCell>{t("backups.uploaded")}</TableCell>
                        <TableCell align="right">{t("backups.size")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {overview.remote.backups.map((backup) => (
                        <TableRow key={backup.name} data-testid="backupRow">
                          <TableCell>{backup.name}</TableCell>
                          <TableCell>{when(backup.modifiedTime)}</TableCell>
                          <TableCell align="right">
                            {size(backup.size)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography color="textSecondary">
                    {t("backups.noneInDrive")}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
};

export default BackupsPage;
