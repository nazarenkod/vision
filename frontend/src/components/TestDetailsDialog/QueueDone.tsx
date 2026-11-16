import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { motion, tokens, type, radius } from "../../theme";
import { useT } from "../../i18n";
import { decisionNotice, DecisionKind } from "../../_helpers/undo.helper";

/**
 * A finished queue (061): what the last decision was, Undo, and the next queue
 * when there is one. Nothing more: the reviewer knows which queue they were
 * in. A click beside the card closes the review, as Esc does.
 */
export const QueueDone: React.FunctionComponent<{
  /** the decision that ended the queue; none when others decided it all */
  status: DecisionKind | null;
  onUndo?: () => void;
  next?: () => void;
  onBack: () => void;
}> = ({ status, onUndo, next, onBack }) => {
  const { t } = useT();
  // the first action takes focus, so Enter and Tab work from the keyboard at once
  const first = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => first.current?.focus(), [next, onUndo]);
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && next) {
        event.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);
  return (
    <Box
      data-testid="queueDone"
      onClick={(event) => {
        if (event.target === event.currentTarget) onBack();
      }}
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        display: "grid",
        placeItems: "center",
        bgcolor: tokens.scrim,
        "@keyframes v-fade": { from: { opacity: 0 }, to: { opacity: 1 } },
        animation: `v-fade ${motion.base}ms ${motion.easing} both`,
      }}
    >
      <Box
        role="dialog"
        aria-label={t("queue.reviewed")}
        sx={{
          width: 260,
          bgcolor: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: radius.card,
          boxShadow: tokens.shadowPop,
          p: 2.5,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography
          data-testid="queueStatus"
          sx={{
            fontSize: type.title,
            fontWeight: 600,
            color:
              status === "approve"
                ? tokens.status.passed.fg
                : status === "reject"
                  ? tokens.status.failed.fg
                  : tokens.text,
          }}
        >
          {status ? decisionNotice(status, 1, t) : t("queue.allDecided")}
        </Typography>
        {(onUndo || next) && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            {onUndo && (
              <Button
                data-testid="queueUndo"
                color="inherit"
                onClick={onUndo}
                ref={next ? undefined : first}
                sx={{ color: tokens.textSecondary }}
              >
                {t("undo.undo")}
              </Button>
            )}
            {next && (
              <Button
                data-testid="queueNext"
                variant="contained"
                onClick={next}
                ref={first}
              >
                {t("queue.next")}
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};
