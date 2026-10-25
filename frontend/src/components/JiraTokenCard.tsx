import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { setJira, useUserDispatch, useUserState } from "../contexts";

/**
 * The person's own Jira credentials: bugs are filed as them, and Jira is
 * searched with their rights. The Jira URL comes from the project settings.
 */
export const JiraTokenCard: React.FunctionComponent = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useUserState();
  const dispatch = useUserDispatch();
  const [token, setToken] = React.useState("");
  const [email, setEmail] = React.useState(user?.jiraEmail ?? "");
  const [saving, setSaving] = React.useState(false);

  const save = async (values: { jiraToken?: string; jiraEmail?: string }) => {
    setSaving(true);
    try {
      await setJira(dispatch, values);
      setToken("");
      enqueueSnackbar(
        values.jiraToken === "" ? "Jira token removed" : "Jira token saved",
        { variant: "success" },
      );
    } catch (error) {
      enqueueSnackbar(`${error}`, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="outlined" data-testid="jiraTokenCard">
      <CardHeader title="Jira" />
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="body2" color="textSecondary">
          Your own token: accessibility bugs are filed as you, and Jira is
          searched with your rights. Server or Data Center: a personal access
          token. Jira Cloud: an API token and your account email.
        </Typography>
        <TextField
          id="jiraEmail"
          size="small"
          label="Email (Jira Cloud only)"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          id="jiraToken"
          size="small"
          type="password"
          autoComplete="new-password"
          label={user?.jiraTokenSet ? "New token" : "Token"}
          placeholder={user?.jiraTokenSet ? "Saved; type to replace" : ""}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          helperText={
            user?.jiraTokenSet
              ? "A token is saved. It is never shown again."
              : "Not set: Jira works only where the project has a shared token."
          }
        />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            disabled={
              saving || (!token.trim() && email === (user?.jiraEmail ?? ""))
            }
            onClick={() =>
              save({
                ...(token.trim() ? { jiraToken: token.trim() } : {}),
                jiraEmail: email.trim(),
              })
            }
          >
            Save
          </Button>
          {user?.jiraTokenSet && (
            <Button
              color="error"
              disabled={saving}
              onClick={() => save({ jiraToken: "" })}
            >
              Remove token
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
