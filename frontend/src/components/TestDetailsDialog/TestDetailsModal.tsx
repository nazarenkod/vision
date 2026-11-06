import React, { useEffect, useState } from "react";
import {
  Typography,
  Button,
  Switch,
  IconButton,
  Box,
  LinearProgress,
  FormControlLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Chip,
  Tooltip as MuiTooltip,
  useMediaQuery,
} from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { useHotkeys } from "react-hotkeys-hook";
import { TestRun, VisualBug, VisualBugResult } from "../../types";
import { testRunService, staticService } from "../../services";
import { TestStatus } from "../../types/testStatus";
import { IgnoreArea, UpdateIgnoreAreaDto } from "../../types/ignoreArea";
import Konva from "konva";
import {
  AdsClickOutlined,
  Close,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  NavigateNext,
  NavigateBefore,
  BugReport,
} from "@mui/icons-material";
import { TestRunDetails } from "./TestRunDetails";
import useImage from "use-image";
import { routes, GO_TO_NEXT_KEY } from "../../constants";
import {
  useProjectState,
  useTestRunDispatch,
  useTokens,
  useUserState,
} from "../../contexts";
import { ReportBugDialog } from "./ReportBugDialog";
import { BugMark } from "../../_helpers/bugReport.helper";
import { useDecisionSnackbar } from "../useDecisionSnackbar";
import { DrawArea, ImageStateLoad } from "./DrawArea";
import { CommentsPopper } from "../CommentsPopper";
import { useDialogSnackbar } from "./useDialogSnackbar";
import { APPROVED_TICK_MS, ApproveRejectButtons } from "./ApproveRejectButtons";
import { invertIgnoreArea, readAreas } from "../../_helpers/ignoreArea.helper";
import { compareOnlyApplied } from "../../_helpers/whatsCompared.helper";
import { InsightsPanel } from "./InsightsPanel";
import { DeviceStrip } from "./DeviceStrip";
import { RunFlags, useAiStatus } from "../ChangeGroups";
import { insightsService } from "../../services";
import {
  A11yReport,
  A11yViolation,
  PickableElement,
  StructureInfo,
  hasUiTree,
} from "../../types";
import { OverlayRect } from "./DrawArea";
import {
  ElementRule,
  ElementRuleAction,
  Rect,
  RuleScope,
  ScreenRule,
  TextPart,
  SelectorVariant,
} from "../../types/insights";
import {
  chosenVariant,
  elementAt,
  elementLabel,
  countBySelector,
  Picked,
  ruleFor,
  stepDown,
  stepUp,
  addToSelection,
  MAX_SELECTED,
  panelSide,
  sortSelected,
} from "../../_helpers/elementPicking.helper";
import { ElementPopover } from "./ElementPopover";
import { ALLOW_PERCENT } from "./ElementActions";
import { SelectionPanel } from "./SelectionPanel";
import { AreaKind, AreasMenu } from "./AreasMenu";
import { areaMarkId, ruleMarkId, testAreaMarkId } from "./WhatsCompared";
import { useRuleSnackbar } from "../useRuleSnackbar";
import { motion, tokens, type, radius } from "../../theme";
import { StepProgress } from "./StepProgress";
import { CheckTrend } from "./CheckTrend";
import {
  COMPACT_TOOLS_QUERY,
  ROOM_FOR_DEVICES_QUERY,
  CompareToolbar,
  CompareView,
} from "./CompareToolbar";
import { DiffMeter } from "./DiffMeter";
import { DeviceTags } from "../DeviceTags";
import { prefersReducedMotion } from "../../_helpers/motion.helper";
import { BaseModal } from "../BaseModal";
import { Tooltip } from "../Tooltip";
import ImageDetails, { ImageDetailsProps } from "./ImageDetails";
import { clampScale } from "../../_helpers/scale.helper";
import { fitScale } from "../../_helpers/fit.helper";
import { panelStartsFolded } from "../../_helpers/review.helper";
import { canCompareToBaseline } from "../../_helpers/testRunStatus.helper";
import TestStatusChip from "../TestStatusChip";
import { useT } from "../../i18n";

// the height the selection panel takes at the bottom of the screenshots, with its margin
const PANEL_ROOM = 190;
// room kept round a fitted screen, so rounding never brings up a scrollbar
const FIT_MARGIN = 4;
// how long the screens wait for the side panel to be settled (REQ-046-07)
const FOLD_WAIT_MS = 1000;
// the keycap after a footer action, as on Select elements
const keycap = {
  font: `500 ${type.caption}px/16px ${tokens.mono}`,
  minWidth: 18,
  px: 0.5,
  textAlign: "center",
  borderRadius: radius.control,
  border: `1px solid ${tokens.border}`,
  color: tokens.textMuted,
} as const;

const defaultStagePos = {
  x: 0,
  y: 0,
};

type Side = "baseline" | "current";

// what is selected on a screenshot, and where the click was
interface Selection {
  side: Side;
  picked: Picked;
  selected: PickableElement[];
  anchor: { x: number; y: number };
  // after Add more elements, a plain click adds (REQ-028-03)
  adding?: boolean;
  // the last click tried to add one past the limit (REQ-028-05)
  refused?: boolean;
}

interface TestDetailsModalProps {
  testRun: TestRun;
  currentRunIndex: number;
  /** statuses of every step of this review, in order */
  stepStatuses?: string[];
  direction?: "forward" | "back" | "none";
  totalTestRunCount: number;
  touched: boolean;
  handleClose: () => void;
  handlePrevious: () => void;
  handleNext: () => void;
  /** moves this many steps from the current one, within the review */
  handleStep: (offset: number) => void;
  // the same check on every device of the build
  deviceRuns?: TestRun[];
  handleSelectRun?: (id: string) => void;
  // the queue this review steps through, opened from the overview (REQ-031-24)
  queueHeader?: React.ReactNode;
}

const TestDetailsModal: React.FunctionComponent<TestDetailsModalProps> = ({
  testRun,
  currentRunIndex,
  stepStatuses = [],
  direction = "none",
  totalTestRunCount,
  touched,
  handlePrevious,
  handleNext,
  handleStep,
  handleClose,
  deviceRuns = [],
  handleSelectRun,
  queueHeader,
}) => {
  const { enqueueSnackbar } = useDialogSnackbar();
  const testRunDispatch = useTestRunDispatch();

  const stageScaleBy = 1.2;
  const [stageScale, setStageScale] = React.useState(1);
  // the screens are fitted to their area until the reviewer zooms by hand
  // (REQ-046-01); fitting again happens only when a step opens or the area
  // changes size, never on a re-render, so they hold still (REQ-018-25)
  const fitting = React.useRef(true);
  const [fitted, setFitted] = React.useState(true);
  const setScaleByHand: React.Dispatch<React.SetStateAction<number>> =
    React.useCallback((value) => {
      fitting.current = false;
      setFitted(false);
      setStageScale(value);
    }, []);
  const [stagePos, setStagePos] = React.useState(defaultStagePos);
  const [stageScrollPos, setStageScrollPos] = React.useState(defaultStagePos);
  const [stageInitPos, setStageInitPos] = React.useState(defaultStagePos);
  const [stageOffset, setStageOffset] = React.useState(defaultStagePos);
  const [processing, setProcessing] = React.useState(false);
  const { t } = useT();
  const [isDrawMode, setIsDrawMode] = useState(false);

  // pixel areas: what the next one drawn is, and whether their menu is open (REQ-024-30)
  const [areaKind, setAreaKind] = useState<AreaKind>("ignore");
  const [areasOpen, setAreasOpen] = useState(false);
  // what to do once unsaved areas are saved or dropped (REQ-024-34)
  const [pendingLeave, setPendingLeave] = useState<() => void>();

  const [isDiffShown, setIsDiffShown] = useState(false);

  // accessibility report of this run, shared by the side panel and the overlay
  const aiStatus = useAiStatus();
  // bugs filed from the comparison for this check, on any device (025)
  const { user } = useUserState();
  const { projectList, selectedProjectId } = useProjectState();
  const project = projectList.find((item) => item.id === selectedProjectId);
  const jiraSet = !!project?.jiraUrl;
  // only the person's own token reaches Jira (035)
  const jiraReady = jiraSet && !!user?.jiraTokenSet;
  const [bugDialog, setBugDialog] = useState<{ marks?: BugMark[] } | null>(
    null,
  );
  const [bugs, setBugs] = useState<VisualBug[]>([]);
  const [showBugMarks, setShowBugMarks] = useState(true);
  const announce = useDecisionSnackbar(enqueueSnackbar);
  const [a11yReport, setA11yReport] = useState<A11yReport | null | undefined>();
  const [a11yOverlay, setA11yOverlay] = useState(true);
  const [highlightedViolation, setHighlightedViolation] = useState<string>();
  // what the pointer is over in the side panel (REQ-018-36)
  const [previewViolation, setPreviewViolation] = useState<string>();
  const [previewRegion, setPreviewRegion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>();
  // a new step slides in from the side the review moved to; the canvases stay
  // mounted, and after the slide the screenshots do not move (REQ-018-25, 34)
  const panesRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const panes = panesRef.current;
    if (!panes || direction === "none" || prefersReducedMotion()) return;
    const from = direction === "forward" ? 28 : -28;
    panes.animate?.(
      [
        { opacity: 0, transform: `translateX(${from}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: motion.base, easing: motion.easing },
    );
    // only a change of step slides; direction alone does not
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testRun.id]);
  // the canvas needs real colours, not CSS variables
  const canvas = useTokens();
  const withUiTree = hasUiTree(testRun);
  const loadA11yReport = React.useCallback(() => {
    if (!withUiTree) {
      setA11yReport(null);
      return;
    }
    insightsService
      .getA11y(testRun.id)
      .then(setA11yReport)
      .catch(() => setA11yReport(null));
  }, [testRun.id, withUiTree]);
  useEffect(() => {
    setA11yReport(undefined);
    setHighlightedViolation(undefined);
    loadA11yReport();
    // counts change when someone files a bug or marks a false positive
  }, [loadA11yReport, testRun.a11yNewCount, testRun.a11yTotalCount]);
  // element rules, system bars and changes, for the panel and the overlay
  const [structure, setStructure] = useState<
    StructureInfo | null | undefined
  >();
  const loadStructure = React.useCallback(() => {
    insightsService
      .getStructure(testRun.id)
      .then(setStructure)
      .catch(() => setStructure(null));
  }, [testRun.id]);
  useEffect(() => {
    loadStructure();
    // a re-comparison (new rule, ignore area) changes the diff and what it explains
  }, [loadStructure, testRun.diffName, testRun.diffPercent, testRun.status]);
  useEffect(() => setStructure(undefined), [testRun.id]);

  // selecting elements on the screenshots to make rules for them (spec 024)
  const canEdit = user?.role === "admin" || user?.role === "editor";
  const [pickMode, setPickMode] = useState(false);
  const [hovered, setHovered] = useState<{
    side: Side;
    element: PickableElement;
  }>();
  const [selection, setSelection] = useState<Selection>();
  // opens the full rule form in the panel (REQ-024-10)
  const [pickedElement, setPickedElement] = useState<PickableElement>();
  // chosen in the rule dialog's list, outlined while the dialog is open
  const [previewElement, setPreviewElement] = useState<PickableElement>();

  // a screen with nothing for the side panel opens with it folded, and the
  // screens take its width (REQ-046-07); decided once per step, when both the
  // changes and the findings are in, so a reviewer's own choice then stays
  const [panelFolded, setPanelFolded] = useState(false);
  // the step whose panel is settled: until then its screens are not shown, so
  // folding the panel never moves them once they are (REQ-018-25)
  const [foldSettled, setFoldSettled] = useState<string>();
  const foldFor = React.useRef<{ seen?: string; decided?: string }>({});
  useEffect(() => {
    const fold = foldFor.current;
    // on the render a step changes, the changes and findings are still the
    // last step's: they are cleared on the way
    if (fold.seen !== testRun.id) {
      fold.seen = testRun.id;
      return;
    }
    if (fold.decided === testRun.id) return;
    const folded = panelStartsFolded(structure, a11yReport);
    if (folded === undefined) return;
    fold.decided = testRun.id;
    setPanelFolded(folded);
    setFoldSettled(testRun.id);
  }, [testRun.id, structure, a11yReport]);
  // a slow server does not keep the screens hidden: past a moment the panel
  // stays open, ready for what comes
  useEffect(() => {
    const id = testRun.id;
    const timer = setTimeout(() => {
      const fold = foldFor.current;
      if (fold.decided === id) return;
      fold.decided = id;
      setPanelFolded(false);
      setFoldSettled(id);
    }, FOLD_WAIT_MS);
    return () => clearTimeout(timer);
  }, [testRun.id]);
  const panesShown = foldSettled === testRun.id;
  // the full rule form lives in the panel (REQ-024-10)
  useEffect(() => {
    if (pickedElement) setPanelFolded(false);
  }, [pickedElement]);
  // a rule or an area the pointer is over in the panel (REQ-024-24)
  const [previewMark, setPreviewMark] = useState<string>();
  // a test area clicked in the summary or the Areas menu stays lit until clicked again
  const [pinnedMark, setPinnedMark] = useState<string>();
  const pinMark = (id: string) =>
    setPinnedMark((current) => (current === id ? undefined : id));
  const testAreaMarks = (): OverlayRect[] =>
    readAreas(testRun.tempIgnoreAreas).flatMap((area, index) => {
      const id = testAreaMarkId(index);
      return id === previewMark || id === pinnedMark
        ? [{ ...area, id, color: canvas.textMuted, hatched: true }]
        : [];
    });
  const [ruleBusy, setRuleBusy] = useState(false);
  const elementsOf = (side: Side) =>
    (side === "baseline" ? structure?.baselineElements : structure?.elements) ??
    [];
  const loadBugs = React.useCallback(() => {
    if (!jiraSet) return;
    insightsService
      .visualBugs(testRun.id)
      .then(setBugs)
      .catch(() => setBugs([]));
  }, [testRun.id, jiraSet]);
  useEffect(() => {
    setBugs([]);
    loadBugs();
  }, [loadBugs]);

  const reportBugFrom = (region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => setBugDialog(region ? { marks: [{ n: 1, ...region }] } : {});

  const onBugFiled = (result: VisualBugResult, rejected: boolean) => {
    const open = result.jiraUrl
      ? {
          label: t("reportBug.openInJira"),
          testId: "openFiledBug",
          onClick: () => window.open(result.jiraUrl ?? "", "_blank"),
        }
      : undefined;
    result.warnings.forEach((warning) =>
      enqueueSnackbar(`${result.jiraKey}: ${warning}`, { variant: "warning" }),
    );
    loadBugs();
    if (!rejected) {
      announce("reject", 1, undefined, {
        message: t("reportBug.filed", { key: result.jiraKey }),
        action: open,
      });
      return;
    }
    // the same reject as the button, so its journal and Undo work (REQ-025-30)
    handleDecide();
    testRunService
      .rejectBulk([testRun.id])
      .then((decision) => {
        announce("reject", 1, decision, {
          message: t("reportBug.filedRejected", { key: result.jiraKey }),
          action: open,
        });
        settleDecision(true);
      })
      .catch((error) => {
        enqueueSnackbar(
          t("reportBug.rejectFailed", {
            key: result.jiraKey,
            error: String(error),
          }),
          { variant: "warning" },
        );
        settleDecision(false);
      });
  };

  useEffect(() => {
    setPickMode(false);
    setHovered(undefined);
    setSelection(undefined);
    setPickedElement(undefined);
    setPreviewElement(undefined);
    setPreviewMark(undefined);
    setPinnedMark(undefined);
    setPreviewViolation(undefined);
    setPreviewRegion(undefined);
  }, [testRun.id]);
  const selectionRef = React.useRef(selection);
  selectionRef.current = selection;
  useEffect(() => {
    if (!pickMode) return;
    // Esc closes what is open next to an element, then leaves selecting,
    // instead of closing the review (REQ-024-08)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (selectionRef.current) {
        setSelection(undefined);
        return;
      }
      setPickMode(false);
      setHovered(undefined);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pickMode]);

  const pick =
    (side: Side) =>
    (
      point: { x: number; y: number },
      click: { shiftKey: boolean; clientX: number; clientY: number },
    ) => {
      const element = elementAt(point, elementsOf(side));
      // a click beside every element puts the actions away, and with none
      // open ends selecting, as Esc does (REQ-024-11)
      if (!element) {
        if (selectionRef.current) setSelection(undefined);
        else {
          setPickMode(false);
          setHovered(undefined);
        }
        return;
      }
      setSelection((current) => {
        // Shift, Add more elements or an open selection panel add, on the
        // same screenshot only; elsewhere selecting starts over (REQ-028-04, 06)
        const additive =
          !!current &&
          current.side === side &&
          (click.shiftKey || !!current.adding || current.selected.length > 1);
        const { selected, refused } = addToSelection(
          additive ? current.selected : [],
          element,
          additive,
        );
        if (!selected.length) return undefined;
        const last = selected[selected.length - 1];
        const one = selected.length === 1;
        return {
          side,
          picked: { element: last, trail: [] },
          selected,
          // with one left, its actions open next to it (REQ-028-13)
          anchor:
            one && additive
              ? (anchorOf(side, last) ?? { x: click.clientX, y: click.clientY })
              : { x: click.clientX, y: click.clientY },
          adding: !!current?.adding && additive && one,
          refused,
        };
      });
    };
  // where an element is in the window: the stage is scaled by CSS
  const onScreen = (side: Side, bounds: Rect) => {
    const pane = (side === "baseline" ? leftItemRef : rightItemRef).current;
    const stage = pane?.querySelector("canvas");
    if (!stage || !stage.offsetWidth) return undefined;
    const box = stage.getBoundingClientRect();
    const ratio = box.width / stage.offsetWidth;
    return {
      x: box.left + bounds.x * ratio,
      y: box.top + bounds.y * ratio,
      width: bounds.width * ratio,
      height: bounds.height * ratio,
    };
  };
  const anchorOf = (side: Side, element: PickableElement) => {
    const rect = onScreen(side, element.bounds);
    return rect && { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  };
  const unselect = (element: PickableElement) =>
    setSelection((current) => {
      if (!current) return current;
      const selected = current.selected.filter((item) => item !== element);
      if (!selected.length) return undefined;
      const last = selected[selected.length - 1];
      return {
        ...current,
        picked: { element: last, trail: [] },
        selected,
        anchor: anchorOf(current.side, last) ?? current.anchor,
        refused: false,
      };
    });
  const stepSelection = (move: (picked: Picked) => Picked | null) =>
    setSelection((current) => {
      const next = current && move(current.picked);
      return current && next
        ? { ...current, picked: next, selected: [next.element] }
        : current;
    });

  // the chosen way to find a nameless element is the selector its rule gets (REQ-027-16)
  const chooseVariant = (variant: SelectorVariant) =>
    setSelection((current) => {
      if (!current) return current;
      const element = { ...current.picked.element, selector: variant.selector };
      return {
        ...current,
        picked: { ...current.picked, element },
        selected: current.selected.map((item) =>
          item === current.picked.element ? element : item,
        ),
      };
    });

  const showRuleSnack = useRuleSnackbar(enqueueSnackbar);
  const act = async (action: ElementRuleAction, scope: RuleScope) => {
    // Variable text is marked in the popover first, for one element (spec 033)
    if (!selection || action === "variable") return;
    // those under a rule already keep it (REQ-028-30)
    const { free } = sortSelected(
      selection.selected,
      structure?.rules ?? [],
      selection.side,
    );
    const targets = free.filter(
      (element, i) =>
        free.findIndex((item) => item.selector === element.selector) === i,
    );
    setRuleBusy(true);
    const added: ElementRule[] = [];
    let failed: { element: PickableElement; error: unknown } | undefined;
    // one rule per element, one after another: each compares the run again
    for (const element of targets) {
      try {
        added.push(
          await insightsService.addElementRule(testRun.id, {
            scope,
            selector: element.selector,
            action,
            ...(action === "tolerate" ? { maxDiffPercent: ALLOW_PERCENT } : {}),
          }),
        );
      } catch (error) {
        failed = { element, error };
        break;
      }
    }
    if (failed) {
      const { element, error } = failed;
      enqueueSnackbar(
        targets.length > 1
          ? t("selection.failed", {
              element: elementLabel(element, t),
              error: String(error),
            })
          : String(error),
        { variant: "error" },
      );
      // the one that failed stays selected, to try again (REQ-028-22)
      setSelection((current) =>
        current && targets.length > 1
          ? {
              side: current.side,
              picked: { element, trail: [] },
              selected: [element],
              anchor: anchorOf(current.side, element) ?? current.anchor,
            }
          : current,
      );
    } else setSelection(undefined);
    if (added.length) {
      loadStructure();
      showRuleSnack(t("select.added", { count: added.length }), () =>
        Promise.all(
          added.map((rule) =>
            insightsService.removeElementRule(testRun.id, scope, rule.id),
          ),
        ).then(loadStructure),
      );
    }
    setRuleBusy(false);
  };
  // a variable-text rule, in place of the rule it replaces if any (REQ-033-11, 14)
  const actVariable = async ({
    parts,
    scope,
    selector,
    replaces,
  }: {
    parts: TextPart[];
    scope: RuleScope;
    selector: string;
    replaces?: ScreenRule;
  }) => {
    setRuleBusy(true);
    try {
      const rule = await insightsService.addElementRule(testRun.id, {
        scope,
        selector,
        action: "variable",
        parts,
        ...(replaces ? { replacesRuleId: replaces.id } : {}),
      });
      setSelection(undefined);
      loadStructure();
      showRuleSnack(t("select.added", { count: 1 }), async () => {
        await insightsService.removeElementRule(testRun.id, scope, rule.id);
        // the rule it took the place of comes back as it was
        if (replaces)
          await insightsService.addElementRule(testRun.id, {
            scope: replaces.scope,
            selector: replaces.selector,
            action: replaces.action,
            ...(replaces.maxDiffPercent !== undefined
              ? { maxDiffPercent: replaces.maxDiffPercent }
              : {}),
            ...(replaces.parts ? { parts: replaces.parts } : {}),
          });
        loadStructure();
      });
    } catch (error) {
      enqueueSnackbar(String(error), { variant: "error" });
    } finally {
      setRuleBusy(false);
    }
  };
  // what a variable-text rule would find here: by id or by its text pattern; a path is the server's to follow
  const countFor = (side: Side) => (selector: string) => {
    const regex = /^text:\/(.+)\/u$/.exec(selector);
    if (regex) {
      try {
        const pattern = new RegExp(regex[1], "u");
        return elementsOf(side).filter(
          (element) => element.text && pattern.test(element.text.trim()),
        ).length;
      } catch {
        return null;
      }
    }
    return selector.startsWith("id:")
      ? countBySelector(selector, elementsOf(side))
      : null;
  };
  // the same element on the other screenshot, by the selector it was picked with
  const otherText = (side: Side, element: PickableElement) => {
    const otherSide: Side = side === "current" ? "baseline" : "current";
    const twin = elementsOf(otherSide).find(
      (item) => item.selector === element.selector,
    );
    return twin?.text ? { side: otherSide, text: twin.text } : undefined;
  };
  // the rules of every selected element come off together (REQ-028-31)
  const removeRules = async (rules: ScreenRule[]) => {
    setRuleBusy(true);
    try {
      for (const rule of rules)
        await insightsService.removeElementRule(
          testRun.id,
          rule.scope,
          rule.id,
        );
      setSelection(undefined);
      enqueueSnackbar(t("selection.rulesRemoved", { count: rules.length }), {
        variant: "success",
      });
    } catch (error) {
      enqueueSnackbar(String(error), { variant: "error" });
    } finally {
      loadStructure();
      setRuleBusy(false);
    }
  };
  const removeRule = async (rule: ScreenRule) => {
    setRuleBusy(true);
    try {
      await insightsService.removeElementRule(testRun.id, rule.scope, rule.id);
      setSelection(undefined);
      loadStructure();
      enqueueSnackbar(t("select.removed"), { variant: "success" });
    } catch (error) {
      enqueueSnackbar(String(error), { variant: "error" });
    } finally {
      setRuleBusy(false);
    }
  };
  // a saved area that stands for one element becomes a rule for it (REQ-024-51)
  const useElementForArea = async (areaId: string) => {
    const suggestion = structure?.areaSuggestions?.find(
      (item) => item.areaId === areaId,
    );
    if (!suggestion) return;
    setRuleBusy(true);
    try {
      const { rule, area } = await insightsService.replaceAreaWithElement(
        testRun.id,
        areaId,
        suggestion.selector,
      );
      loadStructure();
      showRuleSnack(
        t("areas.replaced", { element: suggestion.element }),
        async () => {
          await insightsService.removeElementRule(
            testRun.id,
            "screen",
            rule.id,
          );
          await testRunService.addIgnoreAreas({
            ids: [testRun.id],
            ignoreAreas: [area],
          });
          loadStructure();
        },
      );
    } catch (error) {
      enqueueSnackbar(String(error), { variant: "error" });
    } finally {
      setRuleBusy(false);
    }
  };

  // without a tree there are no elements: the button stays off (REQ-024-33)
  const canSelect = withUiTree && structure?.hasUiTree !== false;
  // a narrow window keeps the toolbar in one row: the tools as icons, named on hover
  const narrow = useMediaQuery(COMPACT_TOOLS_QUERY, { noSsr: true });
  // every device of the check is the toolbar's first group; at full size it
  // takes a third of a 1440 px toolbar, so below a wide window the devices go
  // by their model and the tools by their icons, keeping the toolbar one row
  const severalDevices = deviceRuns.length > 1 && !!handleSelectRun;
  const roomForDevices = useMediaQuery(ROOM_FOR_DEVICES_QUERY, {
    noSsr: true,
  });
  const compactTools = narrow || (severalDevices && !roomForDevices);
  const toggleSelecting = () => {
    if (!canSelect) return;
    leaveAreasThen(() => {
      setPickMode((on) => !on);
      setSelection(undefined);
      setHovered(undefined);
    });
  };
  useHotkeys("e", () => canEdit && toggleSelecting(), [
    canEdit,
    canSelect,
    areasOpen,
    touched,
  ]);

  // what the rules do, drawn on each screenshot (REQ-024-20)
  const ruleMarks = (side: Side): OverlayRect[] =>
    structure
      ? [
          ...(side === "current"
            ? structure.systemBars.map((rect, i) => ({
                id: `bar-${i}`,
                ...rect,
                color: canvas.a11yExisting,
                dashed: true,
              }))
            : []),
          ...structure.rules.flatMap((rule) =>
            (rule.found?.[side] ?? []).map((rect, i) => {
              // a text that does not hold is drawn like a gone element: red, dashed (REQ-033-30)
              const failed =
                rule.action === "variable" &&
                side === "current" &&
                !!rule.check?.items.some(
                  (item) =>
                    !item.ok &&
                    item.bounds.x === rect.x &&
                    item.bounds.y === rect.y,
                );
              return {
                id: `${ruleMarkId(rule.id)}:${i}`,
                ...rect,
                color: failed
                  ? canvas.status.failed.fg
                  : rule.action === "ignore"
                    ? canvas.status.neutral.fg
                    : rule.action === "compare"
                      ? canvas.brand
                      : rule.action === "variable"
                        ? canvas.variable
                        : canvas.status.new.fg,
                hatched:
                  rule.action === "ignore" ||
                  (rule.action === "variable" && !failed),
                dashed: rule.action === "tolerate" || failed,
                label:
                  rule.action === "tolerate"
                    ? `±${rule.maxDiffPercent ?? 5}%`
                    : rule.action === "variable"
                      ? t("select.ruleVariable")
                      : rule.selector,
                labelOnHighlight: rule.action !== "tolerate",
              };
            }),
          ),
          ...(side === "current" && previewMark?.startsWith("area:")
            ? ignoreAreas
                .filter((area) => areaMarkId(area.id) === previewMark)
                .map((area) => ({
                  ...area,
                  id: previewMark,
                  color: canvas.textMuted,
                }))
            : []),
        ]
      : [];
  // a check that names its elements dims the rest (REQ-015-30)
  const dimOutside = (side: Side) => {
    const compareOnly = structure?.compareOnly;
    // without a UI tree nothing is singled out: dimming would hide the whole screen
    if (!compareOnly || !compareOnlyApplied(compareOnly)) return undefined;
    const rects =
      side === "current"
        ? compareOnly.keep
        : (structure?.rules ?? [])
            .filter((rule) => rule.action === "compare")
            .flatMap((rule) => rule.found?.baseline ?? []);
    return { rects, color: canvas.scrim };
  };
  const label = (element: PickableElement) => {
    const name = elementLabel(element, t);
    return name.length > 40 ? `${name.slice(0, 39)}…` : name;
  };
  const pickMarks = (side: Side): OverlayRect[] => {
    const marks: OverlayRect[] = [];
    if (hovered?.side === side) {
      marks.push({
        id: "hover",
        ...hovered.element.bounds,
        color: canvas.brand,
        dashed: true,
        label: label(hovered.element),
      });
    }
    if (selection) {
      // the same elements on the other screenshot are outlined too, under the
      // same number as in the selection panel (REQ-028-11)
      const several = selection.selected.length > 1;
      selection.selected.forEach((element, i) => {
        const found =
          selection.side === side
            ? [element]
            : elementsOf(side).filter((e) => e.selector === element.selector);
        found.forEach((item, k) =>
          marks.push({
            id: `picked:${i}${selection.side === side ? "" : `:${k}`}`,
            ...item.bounds,
            color: canvas.brand,
            badge: several ? String(i + 1) : undefined,
          }),
        );
      });
    }
    if (side === "current" && previewElement) {
      marks.push({
        id: "picked:preview",
        ...previewElement.bounds,
        color: canvas.brand,
        label: label(previewElement),
      });
    }
    return marks;
  };
  const selectingNow = pickMode || !!selection || !!previewElement;
  // an element the pointer is over in the selection panel, or all selected
  const [litPicked, setLitPicked] = useState<number | null>(null);
  const pickedLit = litPicked === null ? "picked" : `picked:${litPicked}`;
  const several = !!selection && selection.selected.length > 1;
  useEffect(() => setLitPicked(null), [selection]);
  // two or three selected act together from a panel (REQ-028-10)
  const selectionPanel = () => {
    if (!selection || !several || !structure) return null;
    const { side } = selection;
    const sorted = sortSelected(selection.selected, structure.rules, side);
    const area = panesRef.current?.getBoundingClientRect();
    // screenshots do not shrink for it, so it keeps off the selected elements (SC-028-03)
    const rects = area
      ? selection.selected.flatMap((element) => {
          const rect = onScreen(side, element.bounds);
          return rect ? [{ y: rect.y - area.top, height: rect.height }] : [];
        })
      : [];
    return (
      <SelectionPanel
        side={area ? panelSide(rects, PANEL_ROOM, area.height) : "bottom"}
        selected={selection.selected.map((element) => ({
          element,
          count:
            chosenVariant(element)?.count ??
            countBySelector(element.selector, elementsOf(side)),
          rule: ruleFor(element, structure.rules, side),
        }))}
        offer={sorted.offer}
        limit={selection.refused ? MAX_SELECTED : undefined}
        busy={ruleBusy}
        onAct={act}
        onRemoveRules={() =>
          removeRules(
            sorted.ruled
              .map(({ rule }) => rule)
              .filter(
                (rule, i, all) =>
                  all.findIndex((item) => item.id === rule.id) === i,
              ),
          )
        }
        onUnselect={unselect}
        onHover={setLitPicked}
        onClear={() => setSelection(undefined)}
      />
    );
  };

  const overlayRects: OverlayRect[] = React.useMemo(
    () =>
      a11yOverlay && a11yReport
        ? a11yReport.violations.map((violation, index) => {
            const tracked =
              violation.status === "existing" || !!violation.issue;
            return {
              id: violation.id,
              ...violation.bounds,
              color: tracked ? canvas.a11yExisting : canvas.a11y,
              dashed: tracked,
              label: String(index + 1),
            };
          })
        : [],
    [a11yOverlay, a11yReport, canvas],
  );
  // how Current lies against the baseline; the fade only in Fade (REQ-046-02)
  const [view, setView] = useState<CompareView>("side");
  const [fade, setFade] = useState(0.5);
  // the diff image hides what Overlay and Fade show, so one turns the other off
  const chooseView = (next: CompareView) => {
    setView(next);
    if (next !== "side") setIsDiffShown(false);
  };
  const showDiff = (shown: boolean) => {
    setIsDiffShown(shown);
    if (shown) setView("side");
  };
  const [selectedRectId, setSelectedRectId] = React.useState<string>();
  const [ignoreAreas, setIgnoreAreas] = React.useState<IgnoreArea[]>([]);

  const [applyIgnoreDialogOpen, setApplyIgnoreDialogOpen] =
    React.useState(false);

  const [goToNextAutomatically, setGoToNextAutomatically] = React.useState(
    () => {
      const json = localStorage.getItem(GO_TO_NEXT_KEY);

      if (json) {
        return JSON.parse(json);
      }

      return false;
    },
  );

  useEffect(() => {
    localStorage.setItem(GO_TO_NEXT_KEY, JSON.stringify(goToNextAutomatically));
  }, [goToNextAutomatically]);

  // "Go to the next" moves the review a moment after the key: once the server
  // answers, and on Approve once the tick is seen too. Steps asked for in that
  // moment used to act on the step the decision was about to leave, so where
  // A then → landed depended on timing. They wait, and count from where the
  // decision moves the review.
  const decision = React.useRef<{ runId: string; steps: number }>();
  const advance = React.useRef<ReturnType<typeof setTimeout>>();
  const latest = React.useRef({ testRunId: testRun.id, handleStep });
  latest.current = { testRunId: testRun.id, handleStep };
  // closing the review drops the step it was about to take
  useEffect(() => () => clearTimeout(advance.current), []);

  const handleDecide = () => {
    if (goToNextAutomatically && decision.current?.runId !== testRun.id) {
      decision.current = { runId: testRun.id, steps: 0 };
    }
  };

  // steps keep waiting through the tick: it is part of the decision's move
  const settleDecision = (moved: boolean, delay = 0) => {
    if (!decision.current) return;
    clearTimeout(advance.current);
    advance.current = setTimeout(() => {
      const pending = decision.current;
      decision.current = undefined;
      if (!pending) return;
      const offset = (moved ? 1 : 0) + pending.steps;
      // a reviewer who went elsewhere meanwhile stays where they went
      if (offset && latest.current.testRunId === pending.runId) {
        latest.current.handleStep(offset);
      }
    }, delay);
  };

  const step = (offset: number, go: () => void) => {
    if (decision.current?.runId === testRun.id) {
      decision.current.steps += offset;
    } else {
      go();
    }
  };
  const goNext = () => step(1, handleNext);
  const goPrevious = () => step(-1, handlePrevious);

  const leftItemRef = React.useRef<HTMLDivElement>(null);
  const rightItemRef = React.useRef<HTMLDivElement>(null);

  const toggleApplyIgnoreDialogOpen = () => {
    setApplyIgnoreDialogOpen(!applyIgnoreDialogOpen);
  };

  const [currentImage, currentImageStatus] = useImage(
    staticService.getImage(testRun.imageName),
  );

  const [baselineImage, baselineImageStatus] = useImage(
    staticService.getImage(testRun.baselineName),
  );

  const [diffImage, diffImageStatus] = useImage(
    staticService.getImage(testRun.diffName),
  );

  const applyIgnoreAreaText = t("review.applyIgnoreArea");

  // the areas the two screens are fitted into, under their headers
  const leftAreaRef = React.useRef<HTMLDivElement>(null);
  const rightAreaRef = React.useRef<HTMLDivElement>(null);
  const fitImagesToStage = () => {
    // both screens share one scale, so the one that fits worse decides it
    const scales = (
      [
        [baselineImage, leftAreaRef.current],
        [currentImage ?? diffImage, rightAreaRef.current],
      ] as const
    ).flatMap(([image, area]) =>
      image && area && area.clientWidth > 0 && area.clientHeight > 0
        ? [
            fitScale(
              { width: image.width, height: image.height },
              {
                width: area.clientWidth - FIT_MARGIN,
                height: area.clientHeight - FIT_MARGIN,
              },
            ),
          ]
        : [],
    );
    fitting.current = true;
    setFitted(true);
    resetPosition();
    if (scales.length) setStageScale(clampScale(Math.min(...scales)));
  };
  const fitLatest = React.useRef(fitImagesToStage);
  fitLatest.current = fitImagesToStage;
  // a window made smaller or bigger, or the side panel folded, gives the
  // screens another area: fitted, they are fitted to it again
  useEffect(() => {
    const panes = panesRef.current;
    if (!panes || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (fitting.current) fitLatest.current();
    });
    observer.observe(panes);
    return () => observer.disconnect();
  }, []);

  // the fade, the blend and the drawing tools belong to the run being looked
  // at, like the diff does: a half-faded image carried onto the next
  // screenshot would hide it, and draw mode carried over turned the reviewer's
  // next click into an ignore area on a screen they never meant to edit —
  // which marked that run touched and then blocked the very navigation that
  // would have cleared the flag. This dialog is not remounted between runs, so
  // whatever belongs to one screen has to be cleared here.
  useEffect(() => {
    setIsDiffShown(!!testRun.diffName);
    setView("side");
    setFade(0.5);
    setIsDrawMode(false);
    setAreasOpen(false);
    setSelectedRectId(undefined);
  }, [testRun.id, testRun.diffName]);

  useEffect(() => {
    setIgnoreAreas(readAreas(testRun.ignoreAreas));
  }, [testRun]);

  useEffect(() => {
    fitImagesToStage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineImage, currentImage]);

  useHotkeys("right", goNext, [currentRunIndex, handleNext]);
  useHotkeys(
    "b",
    () => {
      if (jiraReady && !bugDialog) setBugDialog({});
    },
    [jiraReady, bugDialog],
  );
  useHotkeys("left", goPrevious, [currentRunIndex, handlePrevious]);

  const isImageSizeDiffer = React.useMemo(
    () =>
      testRun.baselineName &&
      testRun.imageName &&
      (currentImage?.height !== baselineImage?.height ||
        currentImage?.width !== baselineImage?.width),
    [currentImage, baselineImage, testRun.baselineName, testRun.imageName],
  );

  const handleIgnoreAreaChange = (ignoreAreas: IgnoreArea[]) => {
    setIgnoreAreas(ignoreAreas);
    testRunDispatch({
      type: "touched",
      // against what is shown: empty areas once saved are not an edit
      payload:
        JSON.stringify(readAreas(testRun.ignoreAreas)) !==
        JSON.stringify(ignoreAreas),
    });
  };

  const removeSelection = (event: Konva.KonvaEventObject<MouseEvent>) => {
    // deselect when clicked not on Rect
    const isRectClicked = event.target.className === "Rect";

    if (!isRectClicked) {
      setSelectedRectId(undefined);
      // a press on the bare screenshot puts the Areas menu away, never while
      // drawing: that press starts an area (REQ-024-35)
      if (areasOpen && !isDrawMode) leaveAreasThen(() => undefined);
    }
  };

  const deleteIgnoreArea = (id: string) => {
    handleIgnoreAreaChange(ignoreAreas.filter((area) => area.id !== id));
    setSelectedRectId(undefined);
  };

  const saveTestRun = (ignoreAreas: IgnoreArea[], successMessage: string) => {
    testRunService
      .updateIgnoreAreas({
        ids: [testRun.id],
        ignoreAreas,
      })
      .then(() => {
        enqueueSnackbar(successMessage, {
          variant: "success",
        });
      })
      .catch((err) =>
        enqueueSnackbar(err, {
          variant: "error",
        }),
      );
  };

  const saveIgnoreAreasOrCompareArea = () => {
    if (areaKind === "ignore") {
      saveTestRun(ignoreAreas, t("review.ignoreSaved"));
    } else if (currentImage) {
      const invertedIgnoreAreas = invertIgnoreArea(
        currentImage.width,
        currentImage.height,
        ignoreAreas[0],
      );

      handleIgnoreAreaChange(invertedIgnoreAreas);
      saveTestRun(invertedIgnoreAreas, t("review.compareSaved"));
    }

    testRunDispatch({
      type: "touched",
      payload: false,
    });
  };

  // leaving areas with unsaved changes asks first (REQ-024-34)
  const leaveAreasThen = (next: () => void) => {
    if (areasOpen && touched) {
      setPendingLeave(() => next);
      return;
    }
    setAreasOpen(false);
    setIsDrawMode(false);
    next();
  };
  const discardAreas = () => {
    handleIgnoreAreaChange(readAreas(testRun.ignoreAreas));
    setSelectedRectId(undefined);
  };
  const toggleAreas = () => {
    if (areasOpen) {
      leaveAreasThen(() => undefined);
      return;
    }
    setPickMode(false);
    setSelection(undefined);
    setAreasOpen(true);
  };

  const setOriginalSize = () => {
    setScaleByHand(1);
    resetPosition();
  };

  const resetPosition = () => {
    setStagePos(defaultStagePos);
    setStageOffset(defaultStagePos);
  };

  const applyIgnoreArea = () => {
    const newIgnoreArea = ignoreAreas.find(
      (area) => selectedRectId === area.id,
    );

    if (newIgnoreArea) {
      setProcessing(true);
      testRunService
        .getList(testRun.buildId)
        .then((testRuns: TestRun[]) => {
          const allIds = testRuns.map((item) => item.id);
          const data: UpdateIgnoreAreaDto = {
            ids: allIds,
            ignoreAreas: [newIgnoreArea],
          };

          testRunService.addIgnoreAreas(data).then(() => {
            setProcessing(false);
            setSelectedRectId(undefined);
            enqueueSnackbar(t("review.ignoreAppliedAll"), {
              variant: "success",
            });
          });
        })
        .catch((error) => {
          enqueueSnackbar(t("review.error", { error: String(error) }), {
            variant: "error",
          });
          setProcessing(false);
        });
    } else {
      enqueueSnackbar(t("review.ignoreUnknown"), {
        variant: "error",
      });
    }
  };

  useHotkeys(
    "d",
    () => {
      if (testRun.diffName) showDiff(!isDiffShown);
    },
    [testRun.diffName, isDiffShown],
  );

  const openHistoryTab = () => {
    window.open(
      `${routes.VARIATION_DETAILS_PAGE}/${testRun.testVariationId}`,
      "_blank",
    );
  };

  // elements first, areas behind one button, rule marks on or off (REQ-024-01, 30, 21)
  const comparisonTools = () => (
    <Box display="flex" alignItems="center" gap={1}>
      {canEdit && (
        <Tooltip
          title={
            canSelect
              ? compactTools
                ? t("select.button")
                : ""
              : t("select.noTree")
          }
        >
          {/* a disabled button takes no pointer, so the tooltip listens on its wrapper */}
          <span data-testid="selectElementsWrap">
            <Button
              variant="outlined"
              onClick={toggleSelecting}
              disabled={!canSelect}
              data-testid="selectElements"
              aria-pressed={pickMode}
              // pressed like Draw in the areas menu: a solid green bar shouted over the screenshot
              sx={{
                height: 32,
                px: 1.25,
                gap: 1,
                fontSize: type.small,
                fontWeight: 600,
                color: pickMode ? tokens.brandDark : tokens.text,
                borderColor: pickMode ? tokens.brand : tokens.border,
                bgcolor: pickMode ? tokens.brandSoft : tokens.surface,
                "&:hover": {
                  borderColor: tokens.brand,
                  bgcolor: pickMode ? tokens.brandSoft : tokens.subtle,
                },
              }}
            >
              {compactTools && (
                <AdsClickOutlined
                  aria-hidden
                  sx={{ fontSize: type.title, ml: -0.25 }}
                />
              )}
              {/* the same label while selecting, so the bar keeps its width (REQ-024-12);
                  a narrow window hides it from sight, not from screen readers */}
              <Box
                component="span"
                sx={compactTools ? visuallyHidden : undefined}
              >
                {t("select.button")}
              </Box>
              {/* a child, not endIcon: MUI sizes the first child of an icon slot to 20px */}
              <Box
                component="kbd"
                aria-hidden="true"
                sx={{
                  font: `500 ${type.caption}px/16px ${tokens.mono}`,
                  minWidth: 18,
                  px: 0.5,
                  textAlign: "center",
                  borderRadius: radius.control,
                  border: `1px solid ${tokens.border}`,
                  borderBottomWidth: 2,
                  bgcolor: tokens.subtle,
                  color: tokens.textMuted,
                }}
              >
                {pickMode ? "Esc" : "E"}
              </Box>
            </Button>
          </span>
        </Tooltip>
      )}
      <AreasMenu
        compact={compactTools}
        open={areasOpen}
        onToggle={toggleAreas}
        onClickAway={() => !isDrawMode && leaveAreasThen(() => undefined)}
        canEdit={canEdit}
        kind={areaKind}
        onKind={setAreaKind}
        drawing={isDrawMode}
        onDraw={() => setIsDrawMode(!isDrawMode)}
        selectedId={selectedRectId}
        onSelect={setSelectedRectId}
        onDelete={() => selectedRectId && deleteIgnoreArea(selectedRectId)}
        onClear={() => handleIgnoreAreaChange([])}
        onApplyToBuild={toggleApplyIgnoreDialogOpen}
        areas={ignoreAreas}
        testAreas={readAreas(testRun.tempIgnoreAreas)}
        pinnedMark={pinnedMark}
        onPinMark={pinMark}
        suggestions={Object.fromEntries(
          (structure?.areaSuggestions ?? []).map((item) => [item.areaId, item]),
        )}
        onUseElement={useElementForArea}
        dirty={touched}
        onSave={saveIgnoreAreasOrCompareArea}
        onDiscard={discardAreas}
      />
    </Box>
  );

  // one column of the comparison: its head, then the screen fitted under it
  const column = (
    itemRef: React.RefObject<HTMLDivElement>,
    areaRef: React.RefObject<HTMLDivElement>,
    head: React.ReactNode,
    drawArea: React.ReactNode,
  ) => (
    <Box
      ref={itemRef}
      sx={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      {head}
      <Box ref={areaRef} sx={{ flex: 1, minHeight: 0, position: "relative" }}>
        {drawArea}
      </Box>
    </Box>
  );

  const baselinePanel = () =>
    column(
      leftItemRef,
      leftAreaRef,
      <ImageDetails
        type="Baseline"
        branchName={testRun.baselineBranchName}
        imageName={testRun.baselineName}
        image={baselineImage}
        ignoreAreas={[]}
        onHistory={testRun.testVariationId ? openHistoryTab : undefined}
      />,
      <DrawArea
        imageName={testRun.baselineName}
        imageState={[baselineImage, baselineImageStatus]}
        ignoreAreas={[]}
        tempIgnoreAreas={[]}
        setIgnoreAreas={handleIgnoreAreaChange}
        selectedRectId={selectedRectId}
        setSelectedRectId={setSelectedRectId}
        onStageClick={removeSelection}
        stageScaleState={[stageScale, setScaleByHand]}
        stagePosState={[stagePos, setStagePos]}
        stageScrollPosState={[stageScrollPos, setStageScrollPos]}
        stageInitPosState={[stageInitPos, setStageInitPos]}
        stageOffsetState={[stageOffset, setStageOffset]}
        drawModeState={[false, setIsDrawMode]}
        overlayRects={[...ruleMarks("baseline"), ...pickMarks("baseline")]}
        highlightedOverlayId={selectingNow ? pickedLit : previewMark}
        dimOutside={dimOutside("baseline")}
        pickMode={pickMode}
        onPickHover={(point) => {
          const element = elementAt(point, elementsOf("baseline"));
          setHovered(element ? { side: "baseline", element } : undefined);
        }}
        onPick={pick("baseline")}
      />,
    );

  const diffPanel = (
    type: ImageDetailsProps["type"],
    branchName: string,
    imageName: string | null,
    imageStatus: ImageStateLoad,
    image: HTMLImageElement | undefined,
  ) =>
    column(
      rightItemRef,
      rightAreaRef,
      <ImageDetails
        type={type}
        branchName={branchName}
        imageName={imageName}
        image={image}
        ignoreAreas={readAreas(testRun.tempIgnoreAreas)}
        sizeDiffers={!!isImageSizeDiffer}
      />,
      <DrawArea
        imageName={imageName}
        imageState={[image, imageStatus]}
        underlayImage={isDiffShown ? undefined : baselineImage}
        overlayOpacity={view === "fade" ? fade : 1}
        blendDifference={view === "overlay" && !isDiffShown}
        ignoreAreas={ignoreAreas}
        tempIgnoreAreas={readAreas(testRun.tempIgnoreAreas)}
        setIgnoreAreas={handleIgnoreAreaChange}
        selectedRectId={selectedRectId}
        deleteIgnoreArea={deleteIgnoreArea}
        setSelectedRectId={setSelectedRectId}
        onStageClick={removeSelection}
        stageScaleState={[stageScale, setScaleByHand]}
        stagePosState={[stagePos, setStagePos]}
        stageScrollPosState={[stageScrollPos, setStageScrollPos]}
        stageInitPosState={[stageInitPos, setStageInitPos]}
        stageOffsetState={[stageOffset, setStageOffset]}
        drawModeState={[isDrawMode, setIsDrawMode]}
        overlayRects={[
          ...ruleMarks("current"),
          ...testAreaMarks(),
          ...(selectingNow ? pickMarks("current") : overlayRects),
          ...(previewRegion
            ? [{ id: "changedArea", ...previewRegion, color: canvas.diff }]
            : []),
          // a bug's marks are in its device's pixels: shown on that device only
          ...(showBugMarks
            ? bugs
                .filter((bug) => bug.sameDevice)
                .flatMap((bug) =>
                  bug.marks.map((mark) => ({
                    id: `bug-${bug.id}-${mark.n}`,
                    x: mark.x,
                    y: mark.y,
                    width: mark.width,
                    height: mark.height,
                    color: canvas.status.new.fg,
                    dashed: true,
                    label: bug.jiraKey,
                  })),
                )
            : []),
        ]}
        highlightedOverlayId={
          selectingNow
            ? pickedLit
            : (previewMark ??
              pinnedMark ??
              (previewRegion
                ? "changedArea"
                : (previewViolation ?? highlightedViolation)))
        }
        dimOutside={dimOutside("current")}
        pickMode={pickMode}
        onPickHover={(point) => {
          const element = elementAt(point, elementsOf("current"));
          setHovered(element ? { side: "current", element } : undefined);
        }}
        onPick={pick("current")}
      />,
    );

  // brings an issue's box into view on the checkpoint pane
  const highlightViolation = (violation: A11yViolation) => {
    setHighlightedViolation(violation.id);
    setA11yOverlay(true);
    setStageScrollPos({
      x: violation.bounds.x * stageScale - 48 + stagePos.x,
      y: violation.bounds.y * stageScale - 48 + stagePos.y,
    });
  };

  // what is on screen, where the review is and how the check went before (REQ-046-08, REQ-046-19)
  const header = () => (
    <Box
      data-testid="compareHeader"
      sx={{
        minHeight: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 2,
        pl: 3,
        pr: 2,
        borderBottom: `1px solid ${tokens.border}`,
        bgcolor: tokens.surface,
        minWidth: 0,
      }}
    >
      <Typography
        component="h1"
        noWrap
        data-testid="screenName"
        title={testRun.name}
        // the name gives way last: the steps and the trend shrink before it does
        sx={{
          fontSize: type.title,
          fontWeight: 600,
          minWidth: 0,
          flexShrink: 0,
          maxWidth: "30%",
        }}
      >
        {testRun.name}
      </Typography>
      <TestStatusChip status={testRun.status} />
      <Box sx={{ ml: 1, minWidth: 0 }}>
        <StepProgress
          statuses={stepStatuses}
          currentIndex={currentRunIndex}
          queue={queueHeader}
        />
      </Box>
      <CheckTrend
        testRunId={testRun.id}
        current={{ status: testRun.status, diffPercent: testRun.diffPercent }}
      />
      {bugs.slice(0, 3).map((bug) => (
        <Tooltip key={bug.id} title={bug.summary}>
          <Chip
            size="small"
            variant="outlined"
            icon={<BugReport sx={{ fontSize: 16 }} />}
            label={bug.jiraKey}
            component="a"
            href={bug.jiraUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            clickable
            data-testid="visualBugChip"
            sx={{
              fontFamily: tokens.mono,
              "& .MuiChip-icon": { color: tokens.status.failed.fg },
            }}
          />
        </Tooltip>
      ))}
      <RunFlags run={testRun} />
      <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5 }}>
        <CommentsPopper
          text={testRun.comment}
          onSave={(comment) =>
            testRunService
              .update(testRun.id, {
                comment,
              })
              .then(() =>
                enqueueSnackbar(t("review.commentUpdated"), {
                  variant: "success",
                }),
              )
              .catch((err) =>
                enqueueSnackbar(err, {
                  variant: "error",
                }),
              )
          }
        />
        <IconButton
          onClick={handleClose}
          aria-label={t("compare.close")}
          data-testid="closeReview"
          sx={{ color: tokens.textSecondary }}
        >
          <Close />
        </IconButton>
      </Box>
    </Box>
  );

  // the device, as in the table; every device of the check when it ran on more.
  // The strip stays the toolbar's first group, where the owner looks for it;
  // its compact form keeps the toolbar to one row
  const devices = () => (
    <>
      {severalDevices && handleSelectRun ? (
        <DeviceStrip
          runs={deviceRuns}
          currentId={testRun.id}
          onSelect={handleSelectRun}
          compact={compactTools}
        />
      ) : (
        <DeviceTags parts={testRun} testId="compareDevice" />
      )}
      {testRun.customTags && (
        <Tooltip title={t("review.attr.customTags")}>
          <Chip size="small" label={testRun.customTags} />
        </Tooltip>
      )}
    </>
  );

  const toolbar = () => (
    <CompareToolbar
      devices={devices()}
      meter={
        <DiffMeter
          diffPercent={testRun.diffPercent}
          tolerancePercent={testRun.diffTollerancePercent}
        />
      }
      canCompare={canCompareToBaseline(testRun)}
      view={view}
      onView={chooseView}
      fade={fade}
      onFade={setFade}
      hasDiff={!!testRun.diffName}
      diffShown={isDiffShown}
      onDiffShown={showDiff}
      tools={comparisonTools()}
      // two devices at 1280 px: Highlight diff by its icon too
      dense={severalDevices && narrow}
    />
  );

  const zoomBy = (factor: number) =>
    setScaleByHand(clampScale(stageScale * factor));

  // one line: zoom; the decision between the arrows; Auto-next and the bug
  const footer = () => (
    <Box
      data-testid="compareFooter"
      sx={{
        minHeight: 64,
        flexShrink: 0,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        columnGap: 2,
        pl: 3,
        pr: 2,
        borderTop: `1px solid ${tokens.border}`,
        bgcolor: tokens.surface,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        data-testid="zoomGroup"
        sx={{ display: "flex", alignItems: "center", gap: 0.25 }}
      >
        <Tooltip title={t("review.zoomOut")}>
          <IconButton
            onClick={() => zoomBy(1 / stageScaleBy)}
            aria-label={t("review.zoomOut")}
          >
            <ZoomOut fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("review.fit")}>
          <Button
            onClick={fitImagesToStage}
            data-testid="zoomFit"
            color="inherit"
            size="small"
            sx={{
              minWidth: 52,
              fontSize: type.small,
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
              color: tokens.textSecondary,
            }}
          >
            {fitted ? t("compare.fit") : `${Math.round(stageScale * 100)}%`}
          </Button>
        </Tooltip>
        <Tooltip title={t("review.zoomIn")}>
          <IconButton
            onClick={() => zoomBy(stageScaleBy)}
            aria-label={t("review.zoomIn")}
          >
            <ZoomIn fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("review.originalSize")}>
          <IconButton
            onClick={setOriginalSize}
            aria-label={t("review.originalSize")}
          >
            <Fullscreen fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        data-testid="decisionGroup"
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        <Tooltip title={t("compare.previous")}>
          <IconButton
            aria-label={t("compare.previous")}
            style={{
              visibility: currentRunIndex > 0 ? "visible" : "hidden",
            }}
            onClick={goPrevious}
          >
            <NavigateBefore />
          </IconButton>
        </Tooltip>
        {(testRun.status === TestStatus.unresolved ||
          testRun.status === TestStatus.new) && (
          <ApproveRejectButtons
            testRun={testRun}
            onDecide={handleDecide}
            // the tick is seen before the review moves on
            afterApprove={() => settleDecision(true, APPROVED_TICK_MS)}
            afterReject={() => settleDecision(true)}
            afterFail={() => settleDecision(false)}
            onReportBug={jiraReady ? () => reportBugFrom() : undefined}
          />
        )}
        <Tooltip title={t("compare.next")}>
          <IconButton
            aria-label={t("compare.next")}
            style={{
              visibility:
                totalTestRunCount > currentRunIndex + 1 ? "visible" : "hidden",
            }}
            onClick={goNext}
          >
            <NavigateNext />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        data-testid="afterGroup"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 2,
          minWidth: 0,
        }}
      >
        <MuiTooltip
          title={t("compare.autoNextHelp")}
          describeChild
          arrow
          disableInteractive
        >
          <FormControlLabel
            data-testid="autoNext"
            sx={{ m: 0, gap: 1 }}
            control={
              <Switch
                size="small"
                checked={goToNextAutomatically}
                onChange={(e) => setGoToNextAutomatically(e.target.checked)}
              />
            }
            label={
              <Box
                component="span"
                sx={{ fontSize: type.small, color: tokens.textSecondary }}
              >
                {t("compare.autoNext")}
              </Box>
            }
          />
        </MuiTooltip>
        {jiraSet && (
          <Tooltip
            title={
              jiraReady ? t("reportBug.openHelp") : t("reportBug.needToken")
            }
          >
            <span>
              <Button
                variant="outlined"
                startIcon={<BugReport />}
                onClick={() => reportBugFrom()}
                disabled={!jiraReady}
                data-testid="reportBug"
                sx={{ whiteSpace: "nowrap", gap: 0.5 }}
              >
                {t("reportBug.open")}
                <Box
                  component="kbd"
                  aria-hidden="true"
                  sx={{ ...keycap, ml: 1 }}
                >
                  B
                </Box>
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      {header()}
      {processing && <LinearProgress />}
      {toolbar()}
      <TestRunDetails testRun={testRun} />
      <Box
        overflow="hidden"
        position="relative"
        display="flex"
        sx={{ flex: 1, minHeight: 0, bgcolor: tokens.lightbox }}
      >
        {pickMode && !several && (
          <Box
            role="status"
            data-testid="selectingBar"
            sx={{
              position: "absolute",
              top: 8,
              left: "calc(50% - 190px)",
              transform: "translateX(-50%)",
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              pl: 1.75,
              pr: 1,
              py: 0.75,
              borderRadius: radius.control,
              bgcolor: tokens.text,
              color: tokens.surface,
              boxShadow: tokens.shadowPop,
              fontSize: type.small,
            }}
          >
            {selection?.adding ? t("select.adding") : t("select.hint")}
            <Button
              size="small"
              onClick={toggleSelecting}
              sx={{
                color: "inherit",
                // tinted by its own text: the bar is inverted, dark on light and light on dark
                bgcolor: "color-mix(in srgb, currentColor 16%, transparent)",
                "&:hover": {
                  bgcolor: "color-mix(in srgb, currentColor 26%, transparent)",
                },
                minWidth: 0,
                px: 1.25,
                fontWeight: 600,
              }}
            >
              {t("select.done")}
            </Button>
          </Box>
        )}
        <Box
          flex={1}
          minWidth={0}
          ref={panesRef}
          data-testid="reviewPanes"
          position="relative"
          // Shift + click on a trackpad would select the page's text instead
          sx={{
            display: "flex",
            gap: 3,
            px: 2,
            pt: 2.5,
            pb: 2,
            ...(pickMode ? { userSelect: "none" } : {}),
            visibility: panesShown ? "visible" : "hidden",
          }}
        >
          {selectionPanel()}
          {baselinePanel()}
          {isDiffShown
            ? diffPanel(
                "Diff",
                testRun.branchName,
                testRun.diffName,
                diffImageStatus,
                diffImage,
              )
            : diffPanel(
                "Image",
                testRun.branchName,
                testRun.imageName,
                currentImageStatus,
                currentImage,
              )}
        </Box>
        <InsightsPanel
          testRun={testRun}
          onSelectElements={canEdit ? toggleSelecting : undefined}
          report={a11yReport}
          onReportChanged={loadA11yReport}
          highlightedId={highlightedViolation}
          onHighlight={highlightViolation}
          aiEnabled={!!aiStatus?.enabled}
          structure={structure}
          onStructureChanged={loadStructure}
          pickedElement={pickedElement}
          onPreviewMark={setPreviewMark}
          onUseElement={useElementForArea}
          onOpenArea={(areaId) => {
            if (!areasOpen) toggleAreas();
            setSelectedRectId(areaId);
          }}
          pinnedMark={pinnedMark}
          onPinMark={pinMark}
          ruleBusy={ruleBusy}
          onPickedDone={() => setPickedElement(undefined)}
          onPreviewElement={setPreviewElement}
          onPreviewViolation={setPreviewViolation}
          onPreviewRegion={setPreviewRegion}
          onReportBug={jiraReady ? reportBugFrom : undefined}
          bugs={bugs}
          bugMarks={showBugMarks}
          onBugMarksChange={setShowBugMarks}
          a11yMarks={a11yOverlay}
          onA11yMarksChange={setA11yOverlay}
          folded={panelFolded}
          onFoldedChange={setPanelFolded}
        />
      </Box>
      {footer()}
      {bugDialog && (
        <ReportBugDialog
          testRun={testRun}
          structure={structure ?? null}
          initialMarks={bugDialog.marks}
          onClose={() => setBugDialog(null)}
          onFiled={onBugFiled}
        />
      )}
      <BaseModal
        open={applyIgnoreDialogOpen}
        title={applyIgnoreAreaText}
        submitButtonText={t("review.yes")}
        onCancel={toggleApplyIgnoreDialogOpen}
        content={<Typography>{t("review.applyIgnoreConfirm")}</Typography>}
        onSubmit={() => {
          toggleApplyIgnoreDialogOpen();
          applyIgnoreArea();
        }}
      />
      {selection && structure && !several && !selection.adding && (
        <ElementPopover
          // the element, not its selector: choosing another way to find it keeps the popover
          key={`${selection.side}:${selection.picked.element.index ?? selection.picked.element.selector}:${selection.picked.element.bounds.x},${selection.picked.element.bounds.y}`}
          anchor={selection.anchor}
          element={selection.picked.element}
          sameSelector={
            chosenVariant(selection.picked.element)?.count ??
            countBySelector(
              selection.picked.element.selector,
              elementsOf(selection.side),
            )
          }
          rule={ruleFor(
            selection.picked.element,
            structure.rules,
            selection.side,
          )}
          canGoUp={!!stepUp(selection.picked, elementsOf(selection.side))}
          canGoDown={!!stepDown(selection.picked)}
          busy={ruleBusy}
          onUp={() =>
            stepSelection((picked) =>
              stepUp(picked, elementsOf(selection.side)),
            )
          }
          onDown={() => stepSelection(stepDown)}
          onMore={() => {
            setPickedElement(selection.picked.element);
            setSelection(undefined);
          }}
          onAct={act}
          onChooseVariant={chooseVariant}
          onRemove={removeRule}
          onClose={() => setSelection(undefined)}
          onAddMore={() =>
            setSelection((current) => current && { ...current, adding: true })
          }
          onVariable={actVariable}
          other={otherText(selection.side, selection.picked.element)}
          countFor={countFor(selection.side)}
          onDrawArea={toggleAreas}
        />
      )}
      <Dialog
        open={!!pendingLeave}
        onClose={() => setPendingLeave(undefined)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("areas.unsavedTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{t("areas.unsavedText")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            data-testid="areasDiscard"
            onClick={() => {
              const next = pendingLeave;
              setPendingLeave(undefined);
              discardAreas();
              setAreasOpen(false);
              setIsDrawMode(false);
              next?.();
            }}
          >
            {t("areas.discard")}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const next = pendingLeave;
              setPendingLeave(undefined);
              saveIgnoreAreasOrCompareArea();
              setAreasOpen(false);
              setIsDrawMode(false);
              next?.();
            }}
          >
            {t("areas.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TestDetailsModal;
