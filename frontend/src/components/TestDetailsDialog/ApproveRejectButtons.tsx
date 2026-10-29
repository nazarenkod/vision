import { Chip, Button } from "@mui/material";
import { Check } from "@mui/icons-material";
import { motion, tokens } from "../../theme";
import { REVIEW_KEYS } from "../../_helpers/review.helper";
import { useDialogSnackbar } from "./useDialogSnackbar";
import { useDecisionSnackbar } from "../useDecisionSnackbar";
import { useHotkeys } from "react-hotkeys-hook";
import React from "react";
import { testRunService } from "../../services";
import { useProjectState, useTestRunState } from "../../contexts";
import { TestRun } from "../../types";
import { TestStatus } from "../../types/testStatus";
import { Tooltip } from "../Tooltip";
import { makeStyles } from "@mui/styles";
import { MatchingVariationsMode } from "./MatchingVariationsDialog";
import {
  isSibling,
  resolveGroupByAxis,
} from "../../_helpers/testRunGroup.helper";
import { useT } from "../../i18n";

// The key on the button as a small keycap. Generated content, so the button's
// text stays "Approve" for people and for anything that finds it by its text.
const keycap = (key: string) => ({
  "&::after": {
    content: `"${key}"`,
    marginLeft: "10px",
    fontFamily: tokens.mono,
    fontSize: 10.5,
    fontWeight: 500,
    lineHeight: "16px",
    padding: "0 4px",
    border: "1px solid currentColor",
    borderRadius: "4px",
    opacity: 0.7,
  },
});

// Approve answers with a tick on the button itself (REQ-018-35)
export const APPROVED_TICK_MS = 420;

const useStyles = makeStyles(() => ({
  actionButton: {
    minWidth: 132,
    height: 38,
    marginLeft: 4,
    marginRight: 4,
  },
  wideActionButton: {
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
  onOpenVariations: (mode: MatchingVariationsMode) => void;
}> = ({
  testRun,
  onDecide,
  afterApprove,
  afterReject,
  afterFail,
  onOpenVariations,
}) => {
  const { enqueueSnackbar } = useDialogSnackbar();
  // the dialog's own placement and one-at-a-time rule, with Undo for 8 s
  const announce = useDecisionSnackbar(enqueueSnackbar);
  const classes = useStyles();
  const { t } = useT();
  const { selectedProjectId, projectList } = useProjectState();
  const { testRuns } = useTestRunState();
  const project = projectList.find((item) => item.id === selectedProjectId);
  // Only worth showing when there is at least one true sibling still to review —
  // same screen and same on every axis except the group-by one (e.g. locale).
  // A run that merely shares the name but differs on a fixed axis (e.g. another
  // device) is NOT a sibling, so "variations" would be a single approve/reject.
  const groupBy = resolveGroupByAxis(project?.bulkApproveGroupBy);
  const hasSiblingsToReview = testRuns.some(
    (run) =>
      run.id !== testRun.id &&
      isSibling(run, testRun, groupBy) &&
      (run.status === TestStatus.unresolved || run.status === TestStatus.new),
  );
  const variationsEnabled =
    !!project?.bulkApproveVariations &&
    testRun.status === TestStatus.unresolved &&
    hasSiblingsToReview;

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
        announce("approve", 1, decision);
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
        announce("reject", 1, decision);
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
      <Tooltip title={t("review.hotkey", { key: REVIEW_KEYS.approve })}>
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
            ...keycap(REVIEW_KEYS.approve),
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
      </Tooltip>
      {variationsEnabled && (
        <Tooltip title={t("review.approveVariationsHelp")}>
          <Button
            onClick={() => onOpenVariations("approve")}
            variant="outlined"
            className={classes.wideActionButton}
          >
            {t("review.approveVariations")}
          </Button>
        </Tooltip>
      )}
      {variationsEnabled && (
        <Tooltip title={t("review.rejectVariationsHelp")}>
          <Button
            color="secondary"
            onClick={() => onOpenVariations("reject")}
            variant="outlined"
            className={classes.wideActionButton}
          >
            {t("review.rejectVariations")}
          </Button>
        </Tooltip>
      )}
      <Tooltip title={t("review.hotkey", { key: REVIEW_KEYS.reject })}>
        <Button
          color="secondary"
          onClick={reject}
          className={classes.actionButton}
          data-testid="rejectButton"
          sx={{
            ...keycap(REVIEW_KEYS.reject),
            "&:hover": {
              backgroundColor: tokens.status.failed.bg,
              color: tokens.status.failed.fg,
            },
          }}
        >
          {t("review.reject")}
        </Button>
      </Tooltip>
    </>
  );
};
