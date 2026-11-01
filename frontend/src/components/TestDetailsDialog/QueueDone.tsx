import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { CheckRounded } from "@mui/icons-material";
import { motion, tokens } from "../../theme";
import { useT } from "../../i18n";
import { QueueSummary } from "../../_helpers/reviewQueue.helper";

/** A finished queue: what was decided, then the next queue or back (REQ-031-26). */
export const QueueDone: React.FunctionComponent<{
  label: string;
  summary: QueueSummary;
  next?: { label: string; count: number; go: () => void };
  onBack: () => void;
}> = ({ label, summary, next, onBack }) => {
  const { t } = useT();
  // the first action takes focus, so Enter and Tab work from the keyboard at once
  const first = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => first.current?.focus(), []);
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && next) {
        event.preventDefault();
        next.go();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);
  const kbd = (key: string) => (
    <Box
      component="kbd"
      sx={{
        ml: "auto",
        fontFamily: tokens.mono,
        fontSize: 10.5,
        border: "1px solid currentColor",
        borderRadius: 0.5,
        px: 0.5,
        opacity: 0.7,
      }}
    >
      {key}
    </Box>
  );
  return (
    <Box
      data-testid="queueDone"
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        display: "grid",
        placeItems: "center",
        bgcolor: tokens.scrim,
        backdropFilter: "blur(3px)",
        "@keyframes v-fade": { from: { opacity: 0 }, to: { opacity: 1 } },
        animation: `v-fade ${motion.base}ms ${motion.easing} both`,
      }}
    >
      <Box
        role="dialog"
        aria-label={t("queue.done", { name: label })}
        sx={{
          width: 340,
          bgcolor: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: 3.5,
          boxShadow: tokens.shadowPop,
          p: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: tokens.status.passed.bg,
            color: tokens.status.passed.fg,
          }}
        >
          <CheckRounded sx={{ fontSize: 18 }} />
        </Box>
        <Typography sx={{ fontSize: 16, fontWeight: 650 }}>
          {t("queue.done", { name: label })}
        </Typography>
        <Typography sx={{ color: tokens.textSecondary }}>
          {t("overview.personDecisions", { ...summary })}
        </Typography>
        {next && (
          <Button
            data-testid="queueNext"
            variant="contained"
            fullWidth
            onClick={next.go}
            ref={first}
          >
            {t("queue.next", { name: next.label, count: next.count })}
            {kbd("Enter")}
          </Button>
        )}
        <Button
          data-testid="queueBack"
          variant="outlined"
          fullWidth
          onClick={onBack}
          ref={next ? undefined : first}
        >
          {t("queue.back")}
          {kbd("Esc")}
        </Button>
      </Box>
    </Box>
  );
};
