import { Dialog, Typography } from "@mui/material";
import React from "react";
import { useLocation, useNavigate } from "react-router";
import { useBuildState, useTestRunState } from "../../contexts";
import {
  buildTestRunLocation,
  getQueryParams,
} from "../../_helpers/route.helpers";
import {
  isWaiting,
  nextQueue,
  nextWaiting,
  parseQueue,
  QueueChoice,
  queueIds,
  QueueKey,
  queueParam,
  queueSummary,
} from "../../_helpers/reviewQueue.helper";
import { ChangeGroup } from "../../types/insights";
import { QueueDone } from "./QueueDone";
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

export const TestDetailsDialog: React.FunctionComponent<{
  // the build's change groups, for review queues opened from the overview (031)
  groups?: ChangeGroup[] | null;
}> = ({ groups = null }) => {
  const classes = useStyles();
  const { t } = useT();
  const location = useLocation();
  const {
    tab,
    queue: queueValue,
    testId: linkedTestId,
  } = getQueryParams(location.search);
  const queueKey = React.useMemo(() => parseQueue(queueValue), [queueValue]);
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
  // A queue's screenshots are fixed when the review opens: positions and dots
  // stay put as decisions land (031). Groups come later than the runs; a queue
  // that needs them waits for them.
  const [frozen, setFrozen] = React.useState<{
    param: string;
    ids: string[];
  } | null>(null);
  React.useEffect(() => {
    if (!selectedTestRun || !queueKey) {
      setFrozen(null);
      return;
    }
    // while the address moves to another run, the one on screen is the old one
    if (selectedTestRun.id !== linkedTestId) return;
    const param = queueParam(queueKey);
    if (frozen?.param === param) {
      // a run reached from inside the review (another device) joins the queue
      if (!frozen.ids.includes(selectedTestRun.id)) {
        setFrozen({ param, ids: [...frozen.ids, selectedTestRun.id] });
      }
      return;
    }
    if (queueKey.kind !== "run" && !groups) return;
    if (allTestRuns.length === 0) return;
    const ids = queueIds(queueKey, allTestRuns, groups ?? []);
    setFrozen({
      param,
      ids: ids.includes(selectedTestRun.id)
        ? ids
        : [selectedTestRun.id, ...ids],
    });
    // frozen is what this sets; reading it is only to keep it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTestRun, linkedTestId, queueKey, groups, allTestRuns]);

  const testRuns = React.useMemo(() => {
    if (frozen) {
      const byId = new Map(allTestRuns.map((run) => [run.id, run]));
      return frozen.ids
        .map((id) => byId.get(id))
        .filter((run): run is TestRun => !!run);
    }
    if (!filteredSortedTestRunIds) {
      return allTestRuns;
    }
    const positionById = new Map(
      filteredSortedTestRunIds.map((id, position) => [id, position]),
    );

    return allTestRuns
      .filter((testRun) => positionById.has(testRun.id))
      .sort((a, b) => positionById.get(a.id)! - positionById.get(b.id)!);
  }, [allTestRuns, filteredSortedTestRunIds, frozen]);

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
        // the tab stays, so closing returns where the review was opened (REQ-031-28)
        navigate(
          buildTestRunLocation(selectedBuild?.id, id, {
            tab,
            queue: id ? queueValue : undefined,
          }),
        );
      }
    },
    [touched, navigate, selectedBuild?.id, tab, queueValue],
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

  // In a queue, the move after a decision skips screenshots someone else
  // decided meanwhile (REQ-031-27); with none left after, it goes back to one
  // still waiting, and with none at all the queue is done.
  const stepInQueue = React.useCallback(
    (offset: number) => {
      if (!frozen || offset <= 0) {
        navigateBySteps(offset);
        return;
      }
      let index = selectedTestRunIndex;
      for (let i = 0; i < offset; i++) {
        const next = nextWaiting(frozen.ids, index, allTestRuns);
        if (next < 0) break;
        index = next;
      }
      if (index === selectedTestRunIndex) {
        const waiting = new Set(
          allTestRuns.filter(isWaiting).map((run) => run.id),
        );
        const left = frozen.ids.findIndex((id) => waiting.has(id));
        if (left >= 0) index = left;
      }
      if (index !== selectedTestRunIndex) navigateByIndex(index);
    },
    [
      frozen,
      selectedTestRunIndex,
      allTestRuns,
      navigateBySteps,
      navigateByIndex,
    ],
  );

  const queueDone = React.useMemo(() => {
    if (!frozen || !queueKey || queueKey.kind === "run") return false;
    const byId = new Map(allTestRuns.map((run) => [run.id, run]));
    return frozen.ids.every((id) => {
      const run = byId.get(id);
      return !run || !isWaiting(run);
    });
  }, [frozen, queueKey, allTestRuns]);

  const labelOfKey = React.useCallback(
    (key: QueueKey, group?: ChangeGroup | null): string => {
      switch (key.kind) {
        case "all":
          return t("queue.all");
        case "group": {
          const found =
            group ?? groups?.find((g) => g.fingerprint === key.fingerprint);
          if (!found) return t("queue.all");
          return found.kind === "new"
            ? t("groups.newScreenshots")
            : found.title;
        }
        case "device":
          return key.profile.split("|").filter(Boolean).slice(0, 2).join(" ");
        case "feature":
        case "check":
          return key.name;
        case "run":
          return allTestRuns.find((run) => run.id === key.id)?.name ?? "";
      }
    },
    [t, groups, allTestRuns],
  );
  const labelOfChoice = React.useCallback(
    (choice: QueueChoice) => labelOfKey(choice.key, choice.group),
    [labelOfKey],
  );

  const openQueue = React.useCallback(
    (key: QueueKey) => {
      const ids = queueIds(key, allTestRuns, groups ?? []);
      if (!ids.length || !selectedBuild) return;
      setFrozen({ param: queueParam(key), ids });
      navigate(
        buildTestRunLocation(selectedBuild.id, ids[0], {
          tab,
          queue: queueParam(key),
        }),
      );
    },
    [allTestRuns, groups, selectedBuild, navigate, tab],
  );

  // closing returns focus to what opened the review (REQ-031-28)
  const opener = React.useRef<HTMLElement | null>(null);
  const open = !!selectedTestRun;
  React.useEffect(() => {
    if (open) {
      opener.current = document.activeElement as HTMLElement | null;
      return;
    }
    const target = opener.current;
    opener.current = null;
    if (target?.isConnected) setTimeout(() => target.focus(), 0);
  }, [open]);

  if (!selectedTestRun) {
    return null;
  }

  const next =
    queueKey && queueDone
      ? nextQueue(queueKey, allTestRuns, groups ?? [])
      : undefined;

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
        direction={direction}
        touched={touched}
        handleClose={() => navigateById()}
        handlePrevious={() =>
          stepOrHold(-1, () => navigateByIndex(selectedTestRunIndex - 1))
        }
        handleNext={() =>
          stepOrHold(1, () => navigateByIndex(selectedTestRunIndex + 1))
        }
        handleStep={(offset) => stepOrHold(offset, () => stepInQueue(offset))}
        deviceRuns={deviceRuns}
        handleSelectRun={navigateById}
      />
      {queueDone && queueKey && frozen && (
        <QueueDone
          label={labelOfKey(queueKey)}
          summary={queueSummary(frozen.ids, allTestRuns)}
          next={
            next && {
              label: labelOfChoice(next),
              count: next.waiting,
              go: () => openQueue(next.key),
            }
          }
          onBack={() => navigateById()}
        />
      )}
      <BaseModal
        open={notSavedChangesModal}
        title={t("review.unsavedTitle")}
        submitButtonText={t("review.discard")}
        onCancel={() => setNotSavedChangesModal(false)}
        content={<Typography>{t("review.discardConfirm")}</Typography>}
        onSubmit={() => {
          navigate(
            buildTestRunLocation(selectedBuild?.id, navigationTargetId, {
              tab,
              queue: navigationTargetId ? queueValue : undefined,
            }),
          );
          setNotSavedChangesModal(false);
        }}
      />
    </Dialog>
  );
};
