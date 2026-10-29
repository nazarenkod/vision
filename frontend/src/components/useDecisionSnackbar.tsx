import React from "react";
import { Button } from "@mui/material";
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
    (kind: DecisionKind, count: number, decision: Decision | void) => {
      const key = show(decisionNotice(kind, count, t), {
        ...decisionSnackOptions(kind),
        action: decision?.decisionId
          ? (snackKey: SnackbarKey) => (
              <Button
                size="small"
                color="inherit"
                data-testid="undoDecision"
                onClick={() => {
                  app.closeSnackbar(snackKey);
                  testRunService
                    .undoDecision(decision.decisionId)
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
            )
          : undefined,
      });
      return key;
    },
    [show, app, t],
  );
}
