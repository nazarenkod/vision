import React from "react";
import { Button } from "@mui/material";
import {
  OptionsObject,
  SnackbarKey,
  SnackbarMessage,
  useSnackbar,
} from "notistack";
import { UNDO_OFFER_MS } from "../_helpers/undo.helper";
import { useT } from "../i18n";

type Enqueue = (
  message: SnackbarMessage,
  options?: OptionsObject,
) => SnackbarKey;

/**
 * Tells about a rule made on the review screen, with Undo for as long as a
 * decision offers it (REQ-024-07). Undo is whatever takes the rule back:
 * removing it, or putting a replaced area back.
 */
export function useRuleSnackbar(enqueue?: Enqueue) {
  const app = useSnackbar();
  const show = enqueue ?? app.enqueueSnackbar;
  const { t } = useT();
  return React.useCallback(
    (message: string, undo: () => Promise<unknown>) =>
      show(message, {
        variant: "success",
        autoHideDuration: UNDO_OFFER_MS,
        action: (snackKey: SnackbarKey) => (
          <Button
            size="small"
            color="inherit"
            data-testid="undoRule"
            sx={{ fontWeight: 700 }}
            onClick={() => {
              app.closeSnackbar(snackKey);
              undo()
                .then(() =>
                  show(t("undo.undone"), {
                    variant: "info",
                    autoHideDuration: 2000,
                  }),
                )
                .catch((error) =>
                  show(t("undo.failed", { error: String(error) }), {
                    variant: "error",
                  }),
                );
            }}
          >
            {t("undo.undo")}
          </Button>
        ),
      }),
    [show, app, t],
  );
}
