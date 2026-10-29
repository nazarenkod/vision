import React from "react";
import {
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
import { setGemini, useUserDispatch, useUserState } from "../contexts";
import { useT } from "../i18n";

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
    <Card variant="outlined" data-testid="geminiKeyCard">
      <CardHeader title="Gemini" />
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="body2" color="textSecondary">
          {t("profile.geminiIntro")}{" "}
          <Link
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
          >
            {t("profile.geminiGetKey")}
          </Link>
        </Typography>
        <TextField
          id="geminiKey"
          size="small"
          type="password"
          autoComplete="new-password"
          label={t(user?.geminiKeySet ? "profile.newKey" : "profile.geminiKey")}
          placeholder={user?.geminiKeySet ? t("profile.tokenReplace") : ""}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          helperText={
            user?.geminiKeySet
              ? t("profile.geminiKeySaved")
              : t("profile.geminiKeyNotSet")
          }
        />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            disabled={saving || !key.trim()}
            onClick={() => save(key.trim())}
          >
            {t("profile.save")}
          </Button>
          {user?.geminiKeySet && (
            <Button color="error" disabled={saving} onClick={() => save("")}>
              {t("profile.removeKey")}
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
