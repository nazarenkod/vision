import { Dialog, Typography } from "@mui/material";
import React from "react";
import { useNavigate } from "react-router";
import { useBuildState, useTestRunState } from "../../contexts";
import { buildTestRunLocation } from "../../_helpers/route.helpers";
import { BaseModal } from "../BaseModal";
import TestDetailsModal from "./TestDetailsModal";
import { isTyping } from "../../_helpers/themeMode.helper";
import { runsOfCheck } from "./DeviceStrip";
import { TestRun } from "../../types";
import { makeStyles } from "@mui/styles";
import {
  neighbourImageNames,
  prefetchImages,
} from "../../_helpers/imagePrefetch.helper";
import { useT } from "../../i18n";

const useStyles = makeStyles(() => ({
  modal: {
    margin: "20px 10px 10px 10px",
  },
}));

export const TestDetailsDialog: React.FunctionComponent = () => {
  const classes = useStyles();
  const { t } = useT();
  const {
    selectedTestRun,
    touched,
    testRuns: allTestRuns,
    filteredSortedTestRunIds,
  } = useTestRunState();
  const { selectedBuild } = useBuildState();
  const navigate = useNavigate();
  const [notSavedChangesModal, setNotSavedChangesModal] = React.useState(false);
  const [navigationTargetId, setNavigationTargetId] = React.useState<string>();

  // the published order is read by id, not scanned: a linear search per run —
  // and two more per comparison while sorting — costs seconds on a build of
  // thousands, and this runs on every list change, dialog open or not
  const testRuns = React.useMemo(() => {
    if (!filteredSortedTestRunIds) {
      return allTestRuns;
    }
    const positionById = new Map(
      filteredSortedTestRunIds.map((id, position) => [id, position]),
    );

    return allTestRuns
      .filter((testRun) => positionById.has(testRun.id))
      .sort((a, b) => positionById.get(a.id)! - positionById.get(b.id)!);
  }, [allTestRuns, filteredSortedTestRunIds]);

  const selectedTestRunIndex = React.useMemo(
    () => testRuns.findIndex((t) => t.id === selectedTestRun?.id),
    [testRuns, selectedTestRun?.id],
  );

  // Screenshots are megapixels each, so stepping to the next run used to leave
  // the pane blank under a "Loading..." while the browser fetched and decoded
  // them. Fetch the neighbours' pictures while the reviewer looks at this one.
  const prefetched = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    prefetchImages(
      neighbourImageNames(testRuns, selectedTestRunIndex),
      prefetched.current,
    );
  }, [testRuns, selectedTestRunIndex]);

  const navigateById = React.useCallback(
    (id?: string) => {
      if (touched) {
        setNavigationTargetId(id);
        setNotSavedChangesModal(true);
      } else {
        navigate(buildTestRunLocation(selectedBuild?.id, id));
      }
    },
    [touched, navigate, selectedBuild?.id],
  );

  const navigateByIndex = React.useCallback(
    (index: number) => {
      const testRun: TestRun | undefined = testRuns.at(index);
      if (testRun) {
        navigateById(testRun.id);
      }
    },
    [testRuns, navigateById],
  );

  // within the review: `at` would wrap a step back from the first one round
  // to the last
  const navigateBySteps = React.useCallback(
    (offset: number) => {
      const index = Math.min(
        Math.max(selectedTestRunIndex + offset, 0),
        testRuns.length - 1,
      );
      if (index !== selectedTestRunIndex) {
        navigateByIndex(index);
      }
    },
    [selectedTestRunIndex, testRuns.length, navigateByIndex],
  );

  // A run opened from its address is on screen before its build's list has
  // loaded, and a step asked for in that moment counted from nowhere: → did
  // nothing, or went to whichever run the list starts with. It waits for the
  // list instead.
  const heldSteps = React.useRef(0);
  const stepOrHold = (offset: number, go: () => void) => {
    if (testRuns.length === 0) {
      heldSteps.current += offset;
    } else {
      go();
    }
  };
  React.useEffect(() => {
    if (!selectedTestRun) {
      // a closed review keeps nothing for the next one
      heldSteps.current = 0;
      return;
    }
    if (testRuns.length === 0 || heldSteps.current === 0) return;
    const offset = heldSteps.current;
    heldSteps.current = 0;
    navigateBySteps(offset);
  }, [selectedTestRun, testRuns.length, navigateBySteps]);

  // the same check on the other devices of the build, whatever the list filter
  const deviceRuns = React.useMemo(
    () => (selectedTestRun ? runsOfCheck(allTestRuns, selectedTestRun) : []),
    [allTestRuns, selectedTestRun],
  );

  // which way the review moved: the next pair comes in from that side
  const lastIndex = React.useRef(selectedTestRunIndex);
  const direction: "forward" | "back" | "none" =
    selectedTestRunIndex > lastIndex.current
      ? "forward"
      : selectedTestRunIndex < lastIndex.current
        ? "back"
        : "none";
  React.useEffect(() => {
    lastIndex.current = selectedTestRunIndex;
  }, [selectedTestRunIndex]);
  const stepStatuses = React.useMemo(
    () => testRuns.map((run) => run.status),
    [testRuns],
  );

  // Esc closes the review even when focus has slipped out of the dialog (to
  // the page behind a toast, say): the dialog only hears keys from inside, and
  // when it does hear one it stops it, so this never closes twice.
  React.useEffect(() => {
    if (!selectedTestRun) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (isTyping(event.target)) return;
      navigateById();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTestRun, navigateById]);

  if (!selectedTestRun) {
    return null;
  }

  return (
    <Dialog
      open={true}
      fullScreen
      className={classes.modal}
      // Esc closes the review. A hotkey on the document never heard it: the
      // dialog stops Escape from bubbling and hands it to onClose instead.
      onClose={(_event, reason) => {
        if (reason === "escapeKeyDown") navigateById();
      }}
    >
      <TestDetailsModal
        testRun={selectedTestRun}
        currentRunIndex={selectedTestRunIndex}
        totalTestRunCount={testRuns.length}
        stepStatuses={stepStatuses}
        direction={direction}
        touched={touched}
        handleClose={() => navigateById()}
        handlePrevious={() =>
          stepOrHold(-1, () => navigateByIndex(selectedTestRunIndex - 1))
        }
        handleNext={() =>
          stepOrHold(1, () => navigateByIndex(selectedTestRunIndex + 1))
        }
        handleStep={(offset) =>
          stepOrHold(offset, () => navigateBySteps(offset))
        }
        deviceRuns={deviceRuns}
        handleSelectRun={navigateById}
      />
      <BaseModal
        open={notSavedChangesModal}
        title={t("review.unsavedTitle")}
        submitButtonText={t("review.discard")}
        onCancel={() => setNotSavedChangesModal(false)}
        content={<Typography>{t("review.discardConfirm")}</Typography>}
        onSubmit={() => {
          navigate(buildTestRunLocation(selectedBuild?.id, navigationTargetId));
          setNotSavedChangesModal(false);
        }}
      />
    </Dialog>
  );
};
