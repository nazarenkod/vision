import React from "react";
import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import { Autorenew, Check, ContentCopy } from "@mui/icons-material";
import { motion, tokens, radius, type } from "../theme";
import { FormCard } from "./FormCard";
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
  // the SDK settings that use the key, and their actions (041)
  children?: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ ending, newKey, onNewKey, children, footer }) => {
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
    <FormCard
      data-testid="apiKeyCard"
      title={t("profile.apiKey")}
      description={t("profile.apiKeyHelp")}
      footer={footer}
    >
      <div>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            minHeight: 40,
            boxSizing: "border-box",
            pl: 1.5,
            pr: 0.5,
            py: 0.5,
            borderRadius: radius.control,
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
              fontSize: type.small,
              color: tokens.textSecondary,
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
          <Button
            size="small"
            startIcon={<Autorenew fontSize="small" />}
            data-testid="newApiKey"
            onClick={makeNew}
          >
            {t("profile.newKey")}
          </Button>
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
      </div>
      {children}
    </FormCard>
  );
};
