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
            enqueueSnackbar(`Google Drive connected as ${result.email}`, {
              variant: "success",
            });
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
              Connected as <b>{drive.email ?? "unknown account"}</b>. Backups go
              to the folder <b>{drive.folderName}</b> on its My Drive; Vision
              sees only the files it made there.
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
                    enqueueSnackbar("The backup folder is reachable", {
                      variant: "success",
                    });
                  })
                }
              >
                Test connection
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
                Disconnect
              </Button>
            </Box>
          </>
        ) : code ? (
          <Box
            data-testid="driveCode"
            sx={{ display: "flex", flexDirection: "column", gap: 1 }}
          >
            <Typography>
              Open{" "}
              <Link href={code.verificationUrl} target="_blank" rel="noopener">
                {code.verificationUrl}
              </Link>{" "}
              on any device, sign in with your work Google account and enter:
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
              Waiting for the confirmation; the code works until{" "}
              {new Date(code.expiresAt).toLocaleTimeString()}.
            </Typography>
            <Box>
              <Button onClick={() => setCode(null)}>Cancel</Button>
            </Box>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="textSecondary">
              An OAuth client of the type “TVs and Limited Input devices” from
              the bank&apos;s Google Cloud project (DEPLOY.md, backups). The
              secret stays on the server and is never shown again.
            </Typography>
            <TextField
              size="small"
              label="Client ID"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              inputProps={{ "data-testid": "driveClientId" }}
            />
            <TextField
              size="small"
              type="password"
              autoComplete="new-password"
              label="Client secret"
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
                {error ? "Start again" : "Connect"}
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};
