import { Chip, Button } from "@mui/material";
import { Check } from "@mui/icons-material";
import { motion, tokens } from "../../theme";
import { useDialogSnackbar } from "./useDialogSnackbar";
import { useDecisionSnackbar } from "../useDecisionSnackbar";
import { useHotkeys } from "react-hotkeys-hook";
import React from "react";
import { testRunService } from "../../services";
import { TestRun } from "../../types";
import { Tooltip } from "../Tooltip";
import { makeStyles } from "@mui/styles";
import { useT } from "../../i18n";

// Approve answers with a tick on the button itself (REQ-018-35)
export const APPROVED_TICK_MS = 420;

const useStyles = makeStyles(() => ({
  actionButton: {
    minWidth: 132,
    height: 38,
    marginLeft: 4,
    marginRight: 4,
  },
}));

export const ApproveRejectButtons: React.FunctionComponent<{
  testRun: TestRun;
  /** a decision is on its way to the server */
  onDecide?: () => void;
  afterApprove?: () => void;
  afterReject?: () => void;
  /** the server refused the decision */
  afterFail?: () => void;
  /** offered in the reject notification: a rejected screen is often a bug (REQ-025-04) */
  onReportBug?: () => void;
}> = ({
  testRun,
  onDecide,
  afterApprove,
  afterReject,
  afterFail,
  onReportBug,
}) => {
  const { enqueueSnackbar } = useDialogSnackbar();
  // the dialog's own placement and one-at-a-time rule, with Undo for 8 s
  const announce = useDecisionSnackbar(enqueueSnackbar);
  const classes = useStyles();
  const { t } = useT();

  const [ticked, setTicked] = React.useState(false);
  const untick = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => {
    setTicked(false);
    return () => clearTimeout(untick.current);
  }, [testRun.id]);
  const approve = () => {
    onDecide?.();
    testRunService
      .approveBulk([testRun.id], testRun.merge)
      .then((decision) => {
        announce("approve", 1, decision, { ids: [testRun.id] });
        setTicked(true);
        clearTimeout(untick.current);
        untick.current = setTimeout(() => setTicked(false), APPROVED_TICK_MS);
        // not from the tick's timer: the run's new status unmounts these
        // buttons, and the timer with them, as soon as the server reports it
        afterApprove?.();
      })
      .catch((err) => {
        enqueueSnackbar(err, {
          variant: "error",
        });
        afterFail?.();
      });
  };

  const reject = () => {
    onDecide?.();
    testRunService
      .rejectBulk([testRun.id])
      .then((decision) => {
        announce("reject", 1, decision, {
          ids: [testRun.id],
          action: onReportBug && {
            label: t("reportBug.open"),
            testId: "reportBugAfterReject",
            onClick: onReportBug,
          },
        });
        afterReject?.();
      })
      .catch((err) => {
        enqueueSnackbar(err, {
          variant: "error",
        });
        afterFail?.();
      });
  };

  // the keys are bound once per run, so they read the latest handlers: bound
  // to the first render's, "go to the next" counted from a step list that had
  // not loaded yet and never moved on
  const latest = React.useRef({ approve, reject });
  latest.current = { approve, reject };
  useHotkeys("a", () => latest.current.approve(), []);
  useHotkeys("x", () => latest.current.reject(), []);

  return (
    <>
      {testRun.merge && (
        <Tooltip title={t("review.mergeHelp")}>
          <Chip
            label={t("review.mergeInto", {
              branch: testRun.baselineBranchName,
            })}
            color="secondary"
            size="small"
          />
        </Tooltip>
      )}
      <Button
        onClick={approve}
        variant="contained"
        className={classes.actionButton}
        data-testid="approveButton"
        data-ticked={ticked ? "true" : "false"}
        startIcon={
          ticked ? (
            <Check
              data-testid="approvedTick"
              sx={{
                "@keyframes v-tick": {
                  from: { transform: "scale(.4)", opacity: 0 },
                  to: { transform: "none", opacity: 1 },
                },
                animation: `v-tick ${motion.base}ms ${motion.spring}`,
              }}
            />
          ) : undefined
        }
        sx={{
          "@keyframes v-pulse": {
            "0%": { transform: "scale(.94)" },
            "60%": { transform: "scale(1.04)" },
            "100%": { transform: "none" },
          },
          animation: ticked
            ? `v-pulse ${APPROVED_TICK_MS}ms ${motion.spring}`
            : "none",
        }}
      >
        {t("review.approve")}
      </Button>
      <Button
        color="secondary"
        onClick={reject}
        className={classes.actionButton}
        data-testid="rejectButton"
        sx={{
          "&:hover": {
            backgroundColor: tokens.status.failed.bg,
            color: tokens.status.failed.fg,
          },
        }}
      >
        {t("review.reject")}
      </Button>
    </>
  );
};
