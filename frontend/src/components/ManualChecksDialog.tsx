import React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { Check, ContentCopy } from "@mui/icons-material";
import { maskKey } from "./ApiKeyCard";
import { API_URL } from "../_config/env.config";
import { useProjectState, useUserState } from "../contexts";
import { BRAND } from "../constants/brand";
import { tokens } from "../theme";
import { useT } from "../i18n";

const quote = (value: string) => `"${value.replace(/(["\\$`])/g, "\\$1")}"`;

/** A command to copy. `shown` hides secrets on screen; the copy is whole. */
const Command: React.FunctionComponent<{ text: string; shown?: string }> = ({
  text,
  shown,
}) => {
  const [copied, setCopied] = React.useState(false);
  const { t } = useT();
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        bgcolor: tokens.subtle,
        border: `1px solid ${tokens.border}`,
        borderRadius: 1,
        px: 1.5,
        py: 1,
      }}
    >
      <Box
        component="code"
        sx={{
          flex: 1,
          font: `500 12.5px ${tokens.mono}`,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {shown ?? text}
      </Box>
      <Tooltip title={t(copied ? "manual.copied" : "manual.copy")}>
        <IconButton
          size="small"
          aria-label={t("manual.copyCommand")}
          sx={{ color: copied ? tokens.brand : undefined }}
          onClick={() =>
            navigator.clipboard
              ?.writeText(text)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          {copied ? (
            <Check fontSize="small" />
          ) : (
            <ContentCopy fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const Step: React.FunctionComponent<{
  number: number;
  children: React.ReactNode;
}> = ({ number, children }) => (
  <Typography
    variant="subtitle2"
    component="h3"
    sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}
  >
    <Box
      component="span"
      sx={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        bgcolor: tokens.brandSoft,
        color: tokens.brand,
      }}
    >
      {number}
    </Box>
    {children}
  </Typography>
);

/**
 * How a manual tester sends the screen in front of them to Vision: the CLI
 * served by this UI, with this user's key and the selected project filled in.
 */
export const ManualChecksDialog: React.FunctionComponent<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { user } = useUserState();
  const { projectList, selectedProjectId } = useProjectState();
  const { t } = useT();
  const project =
    projectList.find((item) => item.id === selectedProjectId) ?? projectList[0];
  const cliUrl = `${window.location.origin}/cli/vision.py`;
  const apiUrl = API_URL || window.location.origin;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("manual.title")}</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
      >
        <Typography variant="body2">
          {t("manual.intro", { brand: BRAND.name })}
        </Typography>
        <Step number={1}>{t("manual.step1")}</Step>
        <Command text={`curl -fsSLO ${cliUrl}`} />
        <Step number={2}>{t("manual.step2")}</Step>
        <Command
          text={`python3 vision.py config --api ${apiUrl} --key ${user?.apiKey ?? "YOUR_API_KEY"} --project ${quote(project?.name ?? "Project name")}`}
          shown={`python3 vision.py config --api ${apiUrl} --key ${user?.apiKey ? maskKey(user.apiKey) : "YOUR_API_KEY"} --project ${quote(project?.name ?? "Project name")}`}
        />
        <Typography variant="body2" color="textSecondary">
          {t("manual.keyHelp")}
        </Typography>
        <Step number={3}>{t("manual.step3")}</Step>
        <Command text={`python3 vision.py check ${quote("Payment")}`} />
        <Typography variant="body2" color="textSecondary">
          {t("manual.sources")}
        </Typography>
        <Typography variant="subtitle2">{t("manual.many")}</Typography>
        <Command
          text={`python3 vision.py start\npython3 vision.py check ${quote("Login")}\npython3 vision.py check ${quote("Payment")}\npython3 vision.py finish`}
        />
        <Typography variant="subtitle2">{t("manual.mcp")}</Typography>
        <Command
          text={`claude mcp add vision -- python3 /path/to/vision.py mcp`}
        />
        <Typography variant="body2" color="textSecondary">
          {t("manual.mcpHelp")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("manual.close")}</Button>
      </DialogActions>
    </Dialog>
  );
};
