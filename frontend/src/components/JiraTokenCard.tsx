import React from "react";
import { Box, Button, TextField } from "@mui/material";
import { useSnackbar } from "notistack";
import { setJira, useUserDispatch, useUserState } from "../contexts";
import { useT } from "../i18n";
import { FormCard } from "./FormCard";
import { FieldLabel } from "./FieldLabel";
import { StatusPill } from "./StatusPill";

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

  const changed = !!token.trim() || email !== (user?.jiraEmail ?? "");
  return (
    <FormCard
      data-testid="jiraTokenCard"
      title="Jira"
      status={
        <StatusPill
          tone={user?.jiraTokenSet ? "passed" : "neutral"}
          label={t(user?.jiraTokenSet ? "profile.tokenSet" : "profile.notSet")}
        />
      }
      description={t("profile.jiraIntro")}
      footer={
        <>
          {user?.jiraTokenSet && (
            <Button
              color="error"
              disabled={saving}
              onClick={() => save({ jiraToken: "" })}
            >
              {t("profile.removeToken")}
            </Button>
          )}
          <Button
            variant="outlined"
            disabled={saving || !changed}
            onClick={() =>
              save({
                ...(token.trim() ? { jiraToken: token.trim() } : {}),
                jiraEmail: email.trim(),
              })
            }
          >
            {t("profile.save")}
          </Button>
        </>
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        <div>
          <FieldLabel htmlFor="jiraEmail" hint={t("profile.jiraCloudOnly")}>
            {t("profile.email")}
          </FieldLabel>
          <TextField
            id="jiraEmail"
            size="small"
            fullWidth
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="jiraToken">
            {t(user?.jiraTokenSet ? "profile.newToken" : "profile.token")}
          </FieldLabel>
          <TextField
            id="jiraToken"
            size="small"
            fullWidth
            type="password"
            autoComplete="new-password"
            placeholder={user?.jiraTokenSet ? t("profile.tokenReplace") : ""}
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </div>
      </Box>
    </FormCard>
  );
};
