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
import {
  Check,
  ContentCopy,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { motion, tokens } from "../theme";
import { useT } from "../i18n";

/** All but the last four characters hidden (REQ-018-68). */
export const maskKey = (key: string | undefined): string =>
  key ? `${"•".repeat(Math.max(4, key.length - 4))}${key.slice(-4)}` : "";

/** The API key, hidden until asked for, with a copy button. */
export const ApiKeyCard: React.FunctionComponent<{
  apiKey?: string;
  revealed: boolean;
  onReveal: (revealed: boolean) => void;
}> = ({ apiKey, revealed, onReveal }) => {
  const [copied, setCopied] = React.useState(false);
  const { t } = useT();
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = () => {
    if (!apiKey) return;
    navigator.clipboard
      ?.writeText(apiKey)
      .then(() => setCopied(true))
      .catch(() => onReveal(true));
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
              fontFamily: tokens.mono,
              fontSize: 13,
              overflowWrap: "anywhere",
            }}
          >
            {revealed ? apiKey : maskKey(apiKey)}
          </Typography>
          <Tooltip title={t(revealed ? "profile.hide" : "profile.show")}>
            <IconButton
              size="small"
              aria-label={t(revealed ? "profile.hideKey" : "profile.showKey")}
              onClick={() => onReveal(!revealed)}
            >
              {revealed ? (
                <VisibilityOff fontSize="small" />
              ) : (
                <Visibility fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
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
        </Box>
      </CardContent>
    </Card>
  );
};
