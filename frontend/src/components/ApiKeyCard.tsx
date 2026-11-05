import React from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { Autorenew, Check, ContentCopy } from "@mui/icons-material";
import { motion, tokens } from "../theme";
import { useT } from "../i18n";

/** A key known only by its ending: the server keeps no more of it (044). */
export const endingOnly = (ending: string): string =>
  `${"•".repeat(24)}${ending}`;

/**
 * The API key. The server stores only its hash, so a key is shown in full once, when it is
 * made; afterwards only its ending tells it apart (REQ-044-05).
 */
export const ApiKeyCard: React.FunctionComponent<{
  ending?: string | null;
  newKey?: string;
  onNewKey: () => void;
}> = ({ ending, newKey, onNewKey }) => {
  const [copied, setCopied] = React.useState(false);
  const { t } = useT();
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = () => {
    if (!newKey) return;
    navigator.clipboard
      ?.writeText(newKey)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };
  const makeNew = () => {
    // a key in use stops working: CI and the CLI need the new one
    if ((ending || newKey) && !window.confirm(t("profile.newKeyConfirm")))
      return;
    onNewKey();
  };
  return (
    <Card variant="outlined" data-testid="apiKeyCard">
      <CardHeader
        title={t("profile.apiKey")}
        subheader={t("profile.apiKeyHelp")}
        subheaderTypographyProps={{ variant: "body2" }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            pl: 1.5,
            pr: 0.5,
            py: 0.5,
            borderRadius: 2,
            bgcolor: tokens.subtle,
            border: `1px solid ${tokens.border}`,
          }}
        >
          <Typography
            data-testid="apiKeyValue"
            sx={{
              flex: 1,
              minWidth: 0,
              fontFamily: newKey || ending ? tokens.mono : undefined,
              fontSize: 13,
              overflowWrap: "anywhere",
            }}
          >
            {newKey ?? (ending ? endingOnly(ending) : t("profile.noApiKey"))}
          </Typography>
          {newKey && (
            <Tooltip title={t(copied ? "profile.copied" : "profile.copy")}>
              <IconButton
                size="small"
                aria-label={t("profile.copyKey")}
                data-testid="copyApiKey"
                data-copied={copied ? "true" : "false"}
                onClick={copy}
                sx={{ color: copied ? tokens.brand : undefined }}
              >
                {copied ? (
                  <Check
                    fontSize="small"
                    sx={{
                      "@keyframes v-copied": {
                        from: { transform: "scale(.4)", opacity: 0 },
                        to: { transform: "none", opacity: 1 },
                      },
                      animation: `v-copied ${motion.base}ms ${motion.spring}`,
                    }}
                  />
                ) : (
                  <ContentCopy fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t("profile.newApiKey")}>
            <IconButton
              size="small"
              aria-label={t("profile.newApiKey")}
              data-testid="newApiKey"
              onClick={makeNew}
            >
              <Autorenew fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {newKey && (
          <Typography
            variant="body2"
            color="warning.main"
            sx={{ mt: 1 }}
            data-testid="apiKeyOnce"
          >
            {t("profile.newKeyOnce")}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
