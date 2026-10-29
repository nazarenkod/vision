import React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { backupsService } from "../../services";
import { BackupsOverview, DriveCode } from "../../types";
import { useT } from "../../i18n";

interface Props {
  drive: BackupsOverview["drive"];
  onChange: () => void;
}

/**
 * Google Drive is connected with a device code: Vision is served over http inside the bank's
 * network, where Google does not redirect sign-ins. The secret never comes back from the API.
 */
export const DriveCard: React.FunctionComponent<Props> = ({
  drive,
  onChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t, tx, formatDate } = useT();
  const [clientId, setClientId] = React.useState("");
  const [clientSecret, setClientSecret] = React.useState("");
  const [code, setCode] = React.useState<DriveCode | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // ask the API about the sign-in every few seconds while the code is shown
  React.useEffect(() => {
    if (!code) return;
    let active = true;
    const timer = window.setInterval(
      () => {
        backupsService
          .poll()
          .then((result) => {
            if (!active || result.state === "pending") return;
            setCode(null);
            if (result.state === "failed") {
              setError(result.error);
              return;
            }
            setClientSecret("");
            enqueueSnackbar(
              t("backups.driveConnectedAs", { email: result.email ?? "" }),
              {
                variant: "success",
              },
            );
            onChange();
          })
          .catch((err) => active && setError(`${err}`));
      },
      Math.max(code.interval, 2) * 1000,
    );
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [code, enqueueSnackbar, onChange]);

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(`${err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined" data-testid="driveCard">
      <CardHeader title="Google Drive" />
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {error && (
          <Alert severity="error" data-testid="driveError">
            {error}
          </Alert>
        )}
        {drive.connected ? (
          <>
            <Typography data-testid="driveConnected">
              {tx("backups.connected", {
                email: <b>{drive.email ?? t("backups.unknownAccount")}</b>,
                folder: <b>{drive.folderName}</b>,
              })}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                disabled={busy}
                data-testid="driveTest"
                onClick={() =>
                  act(async () => {
                    const result = await backupsService.test();
                    if (!result.ok) throw result.error;
                    enqueueSnackbar(t("backups.reachable"), {
                      variant: "success",
                    });
                  })
                }
              >
                {t("backups.test")}
              </Button>
              <Button
                color="error"
                disabled={busy}
                data-testid="driveDisconnect"
                onClick={() =>
                  act(async () => {
                    await backupsService.disconnect();
                    onChange();
                  })
                }
              >
                {t("backups.disconnect")}
              </Button>
            </Box>
          </>
        ) : code ? (
          <Box
            data-testid="driveCode"
            sx={{ display: "flex", flexDirection: "column", gap: 1 }}
          >
            <Typography>
              {tx("backups.openUrl", {
                url: (
                  <Link
                    href={code.verificationUrl}
                    target="_blank"
                    rel="noopener"
                  >
                    {code.verificationUrl}
                  </Link>
                ),
              })}
            </Typography>
            <Typography
              variant="h4"
              component="p"
              data-testid="driveUserCode"
              sx={{ fontFamily: "monospace", letterSpacing: 2 }}
            >
              {code.userCode}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {t("backups.waitingCode", {
                time: formatDate(code.expiresAt, {
                  hour: "numeric",
                  minute: "numeric",
                  second: "numeric",
                }),
              })}
            </Typography>
            <Box>
              <Button onClick={() => setCode(null)}>
                {t("backups.cancel")}
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="textSecondary">
              {t("backups.clientHelp")}
            </Typography>
            <TextField
              size="small"
              label={t("backups.clientId")}
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              inputProps={{ "data-testid": "driveClientId" }}
            />
            <TextField
              size="small"
              type="password"
              autoComplete="new-password"
              label={t("backups.clientSecret")}
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              inputProps={{ "data-testid": "driveClientSecret" }}
            />
            <Box>
              <Button
                variant="contained"
                disabled={busy || !clientId.trim() || !clientSecret.trim()}
                data-testid="driveConnect"
                onClick={() =>
                  act(async () =>
                    setCode(
                      await backupsService.connect(
                        clientId.trim(),
                        clientSecret.trim(),
                      ),
                    ),
                  )
                }
              >
                {t(error ? "backups.startAgain" : "backups.connect")}
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};
