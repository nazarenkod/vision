import React from "react";
import { Box, Button } from "@mui/material";
import {
  OptionsObject,
  SnackbarKey,
  SnackbarMessage,
  useSnackbar,
} from "notistack";
import { Decision, testRunService } from "../services/testRun.service";
import {
  decisionNotice,
  decisionSnackOptions,
  DecisionKind,
} from "../_helpers/undo.helper";
import { useT } from "../i18n";

type Enqueue = (
  message: SnackbarMessage,
  options?: OptionsObject,
) => SnackbarKey;

/**
 * Tells about a decision with Undo for 8 seconds (REQ-018-70). Pass the
 * dialog's own enqueue to keep its placement and its one-at-a-time rule.
 */
export function useDecisionSnackbar(enqueue?: Enqueue) {
  const app = useSnackbar();
  const show = enqueue ?? app.enqueueSnackbar;
  const { t } = useT();
  return React.useCallback(
    (
      kind: DecisionKind,
      count: number,
      decision: Decision | void,
      // another way on from here, such as Report bug after a reject (REQ-025-04),
      // and the message when the decision came with something else
      extra?: {
        message?: string;
        action?: { label: string; testId: string; onClick: () => void };
      },
    ) => {
      const decisionId = decision?.decisionId;
      const more = extra?.action;
      const undo = (snackKey: SnackbarKey) =>
        decisionId ? (
          <Button
            size="small"
            color="inherit"
            data-testid="undoDecision"
            onClick={() => {
              app.closeSnackbar(snackKey);
              testRunService
                .undoDecision(decisionId)
                .then(() =>
                  show(t("undo.undone"), {
                    variant: "info",
                    autoHideDuration: 2000,
                  }),
                )
                .catch((error) =>
                  // the reason is worth reading: someone decided again
                  show(t("undo.failed", { error: String(error) }), {
                    variant: "error",
                  }),
                );
            }}
            sx={{ fontWeight: 700 }}
          >
            {t("undo.undo")}
          </Button>
        ) : null;
      const key = show(extra?.message ?? decisionNotice(kind, count, t), {
        ...decisionSnackOptions(kind),
        action:
          decisionId || more
            ? (snackKey: SnackbarKey) => (
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {more && (
                    <Button
                      size="small"
                      color="inherit"
                      data-testid={more.testId}
                      onClick={() => {
                        app.closeSnackbar(snackKey);
                        more.onClick();
                      }}
                      sx={{ fontWeight: 700 }}
                    >
                      {more.label}
                    </Button>
                  )}
                  {undo(snackKey)}
                </Box>
              )
            : undefined,
      });
      return key;
    },
    [show, app, t],
  );
}
