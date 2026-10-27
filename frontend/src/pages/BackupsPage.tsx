import React from "react";
import {
  Alert,
  Box,
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
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { backupsService } from "../services";
import { BackupsOverview } from "../types";
import { DriveCard } from "../components/Backups/DriveCard";

const when = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "never";

const size = (bytes: number | null) =>
  bytes === null ? "" : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const BackupsPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [overview, setOverview] = React.useState<BackupsOverview | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [time, setTime] = React.useState("");
  const [keep, setKeep] = React.useState("");

  const load = React.useCallback(
    () =>
      backupsService
        .overview()
        .then((data) => {
          setOverview(data);
          setTime(data.settings.time);
          setKeep(String(data.settings.keep));
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
        enqueueSnackbar("Backup asked for; it starts within 5 minutes", {
          variant: "success",
        });
        load();
      })
      .catch((err) => enqueueSnackbar(`${err}`, { variant: "error" }));

  const saveSettings = () =>
    backupsService
      .saveSettings({ time, keep: Number(keep) })
      .then(() => {
        enqueueSnackbar("Backup schedule saved", { variant: "success" });
        load();
      })
      .catch((err) => enqueueSnackbar(`${err}`, { variant: "error" }));

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
          Backups
        </Typography>
        <Button
          variant="contained"
          data-testid="backupNow"
          disabled={!overview?.available || waiting}
          onClick={run}
        >
          Back up now
        </Button>
      </Box>

      {loadError && <Alert severity="error">{loadError}</Alert>}
      {overview && !overview.available && (
        <Alert severity="info">
          Backups cannot be set up from here yet: update Vision with
          ./scripts/vision.sh up -d --build, then reload this page.
        </Alert>
      )}

      {overview && (
        <>
          <Card variant="outlined" data-testid="backupStatus">
            <CardHeader title="Status" />
            <CardContent
              sx={{ display: "flex", flexDirection: "column", gap: 1 }}
            >
              {overview.warning && (
                <Alert severity="warning">{overview.warning}</Alert>
              )}
              {overview.lastError && (
                <Alert severity="error" data-testid="backupError">
                  Last attempt: {overview.lastError}
                </Alert>
              )}
              <Typography>
                Last successful backup:{" "}
                <b data-testid="lastSuccess">{when(overview.lastSuccessAt)}</b>
              </Typography>
              <Typography>
                Last attempt: {when(overview.lastAttemptAt)}
              </Typography>
              {overview.pendingUploads > 0 && (
                <Typography>
                  Waiting for upload: {overview.pendingUploads}
                </Typography>
              )}
              {overview.runningSince ? (
                <Typography data-testid="backupRunning">
                  A backup is running since {when(overview.runningSince)}.
                </Typography>
              ) : (
                overview.backupRequestedAt && (
                  <Typography data-testid="backupRequested">
                    Asked for at {when(overview.backupRequestedAt)}; the server
                    starts it within 5 minutes.
                  </Typography>
                )
              )}
            </CardContent>
          </Card>

          <DriveCard drive={overview.drive} onChange={load} />

          <Card variant="outlined">
            <CardHeader title="Schedule" />
            <CardContent
              sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}
            >
              <TextField
                size="small"
                type="time"
                label="Daily at (server time)"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                inputProps={{ "data-testid": "backupTime" }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                size="small"
                type="number"
                label="Database backups kept in Drive"
                value={keep}
                onChange={(event) => setKeep(event.target.value)}
                inputProps={{ min: 1, max: 365, "data-testid": "backupKeep" }}
              />
              <Button
                variant="outlined"
                data-testid="saveBackupSettings"
                disabled={!overview.available}
                onClick={saveSettings}
              >
                Save
              </Button>
            </CardContent>
          </Card>

          {overview.remote && (
            <Card variant="outlined">
              <CardHeader title="In Google Drive" />
              <CardContent>
                {overview.remote.error ? (
                  <Alert severity="error">{overview.remote.error}</Alert>
                ) : overview.remote.backups.length ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Backup</TableCell>
                        <TableCell>Uploaded</TableCell>
                        <TableCell align="right">Size</TableCell>
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
                    No backups in Drive yet.
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
