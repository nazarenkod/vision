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
import { useT } from "../i18n";

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
  const { t } = useT();

  const save = async (values: { jiraToken?: string; jiraEmail?: string }) => {
    setSaving(true);
    try {
      await setJira(dispatch, values);
      setToken("");
      enqueueSnackbar(
        t(
          values.jiraToken === "" ? "profile.jiraRemoved" : "profile.jiraSaved",
        ),
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
          {t("profile.jiraIntro")}
        </Typography>
        <TextField
          id="jiraEmail"
          size="small"
          label={t("profile.jiraEmail")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          id="jiraToken"
          size="small"
          type="password"
          autoComplete="new-password"
          label={t(user?.jiraTokenSet ? "profile.newToken" : "profile.token")}
          placeholder={user?.jiraTokenSet ? t("profile.tokenReplace") : ""}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          helperText={
            user?.jiraTokenSet
              ? t("profile.tokenSaved")
              : t("profile.tokenNotSet")
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
            {t("profile.save")}
          </Button>
          {user?.jiraTokenSet && (
            <Button
              color="error"
              disabled={saving}
              onClick={() => save({ jiraToken: "" })}
            >
              {t("profile.removeToken")}
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
