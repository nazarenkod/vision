import React from "react";
import { Box, Button, Link, TextField } from "@mui/material";
import { useSnackbar } from "notistack";
import { setGemini, useUserDispatch, useUserState } from "../contexts";
import { useT } from "../i18n";
import { FormCard } from "./FormCard";
import { FieldLabel } from "./FieldLabel";
import { StatusPill } from "./StatusPill";

/**
 * The person's own Gemini API key (025): bugs from the comparison are drafted
 * on it, so each person decides what AI costs them. Like the Jira token, it is
 * only written: the page knows whether one is set, never the key.
 */
export const GeminiKeyCard: React.FunctionComponent = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useUserState();
  const dispatch = useUserDispatch();
  const [key, setKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { t } = useT();

  const save = async (value: string) => {
    setSaving(true);
    try {
      await setGemini(dispatch, value);
      setKey("");
      enqueueSnackbar(
        t(value ? "profile.geminiSaved" : "profile.geminiRemoved"),
        { variant: "success" },
      );
    } catch (error) {
      enqueueSnackbar(`${error}`, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormCard
      data-testid="geminiKeyCard"
      title="Gemini"
      status={
        <StatusPill
          tone={user?.geminiKeySet ? "passed" : "neutral"}
          label={t(user?.geminiKeySet ? "profile.keySet" : "profile.notSet")}
        />
      }
      description={
        <>
          {t("profile.geminiIntro")}{" "}
          <Link
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
          >
            {t("profile.geminiGetKey")}
          </Link>
        </>
      }
      footer={
        <>
          {user?.geminiKeySet && (
            <Button color="error" disabled={saving} onClick={() => save("")}>
              {t("profile.removeKey")}
            </Button>
          )}
          <Button
            variant="outlined"
            disabled={saving || !key.trim()}
            onClick={() => save(key.trim())}
          >
            {t("profile.save")}
          </Button>
        </>
      }
    >
      <Box sx={{ maxWidth: 356 }}>
        <FieldLabel htmlFor="geminiKey">
          {t(user?.geminiKeySet ? "profile.newKey" : "profile.apiKey")}
        </FieldLabel>
        <TextField
          id="geminiKey"
          size="small"
          fullWidth
          type="password"
          autoComplete="new-password"
          placeholder={user?.geminiKeySet ? t("profile.tokenReplace") : ""}
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
      </Box>
    </FormCard>
  );
};
