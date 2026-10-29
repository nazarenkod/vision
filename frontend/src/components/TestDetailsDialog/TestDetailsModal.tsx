import React, { useEffect, useState } from "react";
import { makeStyles } from "@mui/styles";
import {
  Typography,
  Button,
  Grid,
  Switch,
  IconButton,
  Box,
  LinearProgress,
  Divider,
  FormControlLabel,
  Checkbox,
  ToggleButton,
  Slider,
  Popover,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tooltip as MuiTooltip,
  Chip,
} from "@mui/material";
import { useHotkeys } from "react-hotkeys-hook";
import { TestRun, VisualBug, VisualBugResult } from "../../types";
import { testRunService, staticService } from "../../services";
import { TestStatus } from "../../types/testStatus";
import { IgnoreArea, UpdateIgnoreAreaDto } from "../../types/ignoreArea";
import Konva from "konva";
import {
  Close,
  WarningRounded,
  Compare,
  OpenInNew,
  Visibility,
  VisibilityOff,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  FullscreenExit,
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
import { invertIgnoreArea } from "../../_helpers/ignoreArea.helper";
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
  RuleScope,
  ScreenRule,
} from "../../types/insights";
import {
  elementAt,
  countBySelector,
  Picked,
  ruleFor,
  stepDown,
  stepUp,
  toggleSelection,
} from "../../_helpers/elementPicking.helper";
import { ALLOW_PERCENT, ElementPopover } from "./ElementPopover";
import { AreaKind, AreasMenu } from "./AreasMenu";
import { areaMarkId, ruleMarkId, testAreaMarkId } from "./WhatsCompared";
import { useRuleSnackbar } from "../useRuleSnackbar";
import { motion, tokens } from "../../theme";
import { StepDots } from "./StepDots";
import { prefersReducedMotion } from "../../_helpers/motion.helper";
import { BaseModal } from "../BaseModal";
import { Tooltip } from "../Tooltip";
import ImageDetails, { ImageDetailsProps } from "./ImageDetails";
import { calculateScale, clampScale } from "../../_helpers/scale.helper";
import { canCompareToBaseline } from "../../_helpers/testRunStatus.helper";
import TestStatusChip from "../TestStatusChip";
import { useT } from "../../i18n";

const useStyles = makeStyles(() => ({
  header: {
    position: "relative",
    textAlign: "left",
    background: tokens.surface,
    paddingLeft: 8,
    paddingBottom: 8,
  },
  footer: {
    background: tokens.surface,
    borderTop: `1px solid ${tokens.border}`,
  },
  scaleActions: {
    display: "flex",
    alignItems: "center",
  },
  testRunActions: {
    display: "flex",
    alignItems: "center",
    alignContent: "center",
  },
  centerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  testRunName: {
    fontWeight: 400,
  },
  closeIcon: {
    position: "absolute",
    right: "8px",
  },
  testRunDetails: {
    paddingLeft: 8,
  },
  drawAreaContainer: {
    width: "100%",
    height: "100%",
    background: tokens.lightbox,
  },
  drawAreaItem: {
    padding: "0 4px",
    height: "100%",
  },
  imageToolbar: {
    paddingLeft: 5,
    height: 52,
  },
}));

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
}

// rule marks on the screenshots, on or off per reviewer (REQ-024-21)
const SHOW_RULES_KEY = "vision.review.showRules";
const readShowRules = () => {
  try {
    return localStorage.getItem(SHOW_RULES_KEY) !== "false";
  } catch {
    return true;
  }
};
const writeShowRules = (shown: boolean) => {
  try {
    localStorage.setItem(SHOW_RULES_KEY, String(shown));
  } catch {
    // private windows refuse storage; the choice then lasts the session
  }
};

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
}) => {
  const classes = useStyles();
  const { enqueueSnackbar } = useDialogSnackbar();
  const testRunDispatch = useTestRunDispatch();

  const stageScaleBy = 1.2;
  const [stageScale, setStageScale] = React.useState(1);
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
  const jiraReady =
    jiraSet && (!!user?.jiraTokenSet || !!project?.jiraTokenSet);
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
  // a rule or an area the pointer is over in the panel (REQ-024-24)
  const [previewMark, setPreviewMark] = useState<string>();
  // a test area clicked in the summary or the Areas menu stays lit until clicked again
  const [pinnedMark, setPinnedMark] = useState<string>();
  const pinMark = (id: string) =>
    setPinnedMark((current) => (current === id ? undefined : id));
  const testAreaMarks = (): OverlayRect[] =>
    (JSON.parse(testRun.tempIgnoreAreas ?? "[]") as IgnoreArea[]).flatMap(
      (area, index) => {
        const id = testAreaMarkId(index);
        return id === previewMark || id === pinnedMark
          ? [{ ...area, id, color: canvas.textMuted, hatched: true }]
          : [];
      },
    );
  const [ruleBusy, setRuleBusy] = useState(false);
  const [noTreeAnchor, setNoTreeAnchor] = useState<HTMLElement | null>(null);
  const [showRules, setShowRules] = useState(readShowRules);
  const toggleShowRules = () =>
    setShowRules((shown) => {
      writeShowRules(!shown);
      return !shown;
    });
  const selectButton = React.useRef<HTMLButtonElement>(null);
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
    setNoTreeAnchor(null);
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
      if (!element) return;
      setSelection((current) => {
        const additive = click.shiftKey && current?.side === side;
        const selected = toggleSelection(
          additive ? current.selected : [],
          element,
          additive,
        );
        if (!selected.length) return undefined;
        const last = selected[selected.length - 1];
        return {
          side,
          picked: { element: last, trail: [] },
          selected,
          anchor: { x: click.clientX, y: click.clientY },
        };
      });
    };
  const stepSelection = (move: (picked: Picked) => Picked | null) =>
    setSelection((current) => {
      const next = current && move(current.picked);
      return current && next
        ? { ...current, picked: next, selected: [next.element] }
        : current;
    });

  const showRuleSnack = useRuleSnackbar(enqueueSnackbar);
  const act = async (action: ElementRuleAction, scope: RuleScope) => {
    if (!selection) return;
    const selectors = Array.from(
      new Set(selection.selected.map((element) => element.selector)),
    );
    setRuleBusy(true);
    try {
      const added: ElementRule[] = [];
      // one rule per element, one after another: each compares the run again
      for (const selector of selectors) {
        added.push(
          await insightsService.addElementRule(testRun.id, {
            scope,
            selector,
            action,
            ...(action === "tolerate" ? { maxDiffPercent: ALLOW_PERCENT } : {}),
          }),
        );
      }
      setSelection(undefined);
      loadStructure();
      showRuleSnack(t("select.added", { count: added.length }), () =>
        Promise.all(
          added.map((rule) =>
            insightsService.removeElementRule(testRun.id, scope, rule.id),
          ),
        ).then(loadStructure),
      );
    } catch (error) {
      enqueueSnackbar(String(error), { variant: "error" });
    } finally {
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

  const toggleSelecting = () => {
    if (!withUiTree || structure?.hasUiTree === false) {
      setNoTreeAnchor(selectButton.current);
      return;
    }
    leaveAreasThen(() => {
      setPickMode((on) => !on);
      setSelection(undefined);
      setHovered(undefined);
    });
  };
  useHotkeys("e", () => canEdit && toggleSelecting(), [
    canEdit,
    withUiTree,
    structure,
    areasOpen,
    touched,
  ]);

  // what the rules do, drawn on each screenshot (REQ-024-20)
  const ruleMarks = (side: Side): OverlayRect[] =>
    showRules && structure
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
            (rule.found?.[side] ?? []).map((rect, i) => ({
              id: `${ruleMarkId(rule.id)}:${i}`,
              ...rect,
              color:
                rule.action === "ignore"
                  ? canvas.status.neutral.fg
                  : rule.action === "compare"
                    ? canvas.brand
                    : canvas.status.new.fg,
              hatched: rule.action === "ignore",
              dashed: rule.action === "tolerate",
              label:
                rule.action === "tolerate"
                  ? `±${rule.maxDiffPercent ?? 5}%`
                  : rule.selector,
              labelOnHighlight: rule.action !== "tolerate",
            })),
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
    if (!showRules || !compareOnly?.active) return undefined;
    const rects =
      side === "current"
        ? compareOnly.keep
        : (structure?.rules ?? [])
            .filter((rule) => rule.action === "compare")
            .flatMap((rule) => rule.found?.baseline ?? []);
    return { rects, color: canvas.scrim };
  };
  const label = (element: PickableElement) =>
    element.element.length > 40
      ? `${element.element.slice(0, 39)}…`
      : element.element;
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
      // the same elements on the other screenshot are outlined too
      const selectors = new Set(selection.selected.map((e) => e.selector));
      const elements =
        selection.side === side
          ? selection.selected
          : elementsOf(side).filter((e) => selectors.has(e.selector));
      elements.forEach((element, i) =>
        marks.push({
          id: `picked:${i}`,
          ...element.bounds,
          color: canvas.brand,
        }),
      );
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
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [blendDifference, setBlendDifference] = useState(false);
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

  const fitImageToStage = (image: HTMLImageElement, container: HTMLElement) => {
    // the pane's own padding is not room for the image: counted in, the image
    // came out a pixel wider than its scroll area and its right edge was cut off
    const style = window.getComputedStyle(container);
    const padding = (side: "Left" | "Right" | "Top" | "Bottom") =>
      parseFloat(style[`padding${side}`]) || 0;
    const scale = calculateScale(
      image.width + 20,
      image.height + 20,
      container.clientWidth - padding("Left") - padding("Right"),
      container.clientHeight - padding("Top") - padding("Bottom") - 48,
    );

    if (scale < stageScale) {
      setStageScale(scale);
    }
  };

  const fitImagesToStage = () => {
    if (currentImage && leftItemRef.current) {
      fitImageToStage(currentImage, leftItemRef.current);
    }

    if (baselineImage && rightItemRef.current) {
      fitImageToStage(baselineImage, rightItemRef.current);
    }

    resetPosition();
  };

  // the fade, the blend and the drawing tools belong to the run being looked
  // at, like the diff does: a half-faded image carried onto the next
  // screenshot would hide it, and draw mode carried over turned the reviewer's
  // next click into an ignore area on a screen they never meant to edit —
  // which marked that run touched and then blocked the very navigation that
  // would have cleared the flag. This dialog is not remounted between runs, so
  // whatever belongs to one screen has to be cleared here.
  useEffect(() => {
    setIsDiffShown(!!testRun.diffName);
    setOverlayOpacity(1);
    setBlendDifference(false);
    setIsDrawMode(false);
    setAreasOpen(false);
    setSelectedRectId(undefined);
  }, [testRun.id, testRun.diffName]);

  useEffect(() => {
    setIgnoreAreas(JSON.parse(testRun.ignoreAreas));
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
      payload: testRun.ignoreAreas !== JSON.stringify(ignoreAreas),
    });
  };

  const removeSelection = (event: Konva.KonvaEventObject<MouseEvent>) => {
    // deselect when clicked not on Rect
    const isRectClicked = event.target.className === "Rect";

    if (!isRectClicked) {
      setSelectedRectId(undefined);
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
    handleIgnoreAreaChange(JSON.parse(testRun.ignoreAreas));
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
    setStageScale(1);
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
      if (testRun.diffName) {
        setIsDiffShown((isDiffShown) => !isDiffShown);
      }
    },
    [testRun.diffName],
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
        <Button
          ref={selectButton}
          variant="outlined"
          onClick={toggleSelecting}
          data-testid="selectElements"
          aria-pressed={pickMode}
          // pressed like Draw in the areas menu: a solid green bar shouted over the screenshot
          sx={{
            height: 34,
            px: 1.25,
            gap: 1,
            fontSize: 13.5,
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
          {pickMode ? t("select.selecting") : t("select.button")}
          {/* a child, not endIcon: MUI sizes the first child of an icon slot to 20px */}
          <Box
            component="kbd"
            aria-hidden="true"
            sx={{
              font: `500 11px/16px ${tokens.mono}`,
              minWidth: 18,
              px: 0.5,
              textAlign: "center",
              borderRadius: "4px",
              border: `1px solid ${tokens.border}`,
              borderBottomWidth: 2,
              bgcolor: tokens.subtle,
              color: tokens.textMuted,
            }}
          >
            {pickMode ? "Esc" : "E"}
          </Box>
        </Button>
      )}
      <AreasMenu
        open={areasOpen}
        onToggle={toggleAreas}
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
        testAreas={JSON.parse(testRun.tempIgnoreAreas)}
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
      <Tooltip title={showRules ? t("rules.hide") : t("rules.show")}>
        <IconButton
          size="small"
          onClick={toggleShowRules}
          aria-pressed={showRules}
          aria-label={showRules ? t("rules.hide") : t("rules.show")}
          data-testid="toggleRules"
          sx={{
            width: 34,
            height: 34,
            borderRadius: "8px",
            color: showRules ? tokens.brand : tokens.textSecondary,
            bgcolor: showRules ? tokens.brandSoft : "transparent",
          }}
        >
          {showRules ? (
            <Visibility fontSize="small" />
          ) : (
            <VisibilityOff fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );

  const baselinePanel = () => (
    <Grid
      item
      xs={6}
      ref={leftItemRef}
      className={classes.drawAreaItem}
      alignItems="stretch"
    >
      <Grid
        container
        alignItems="center"
        spacing={1}
        className={classes.imageToolbar}
      >
        <ImageDetails
          type="Baseline"
          branchName={testRun.baselineBranchName}
          imageName={testRun.baselineName}
          image={baselineImage}
          ignoreAreas={[]}
        />
        <Grid item>
          <Button
            color="primary"
            disabled={!testRun.testVariationId}
            onClick={openHistoryTab}
          >
            {t("review.history")} <OpenInNew fontSize="small" />
          </Button>
        </Grid>
      </Grid>
      <Grid
        item
        style={{
          flexGrow: "1",
        }}
      >
        <DrawArea
          imageName={testRun.baselineName}
          imageState={[baselineImage, baselineImageStatus]}
          ignoreAreas={[]}
          tempIgnoreAreas={[]}
          setIgnoreAreas={handleIgnoreAreaChange}
          selectedRectId={selectedRectId}
          setSelectedRectId={setSelectedRectId}
          onStageClick={removeSelection}
          stageScaleState={[stageScale, setStageScale]}
          stagePosState={[stagePos, setStagePos]}
          stageScrollPosState={[stageScrollPos, setStageScrollPos]}
          stageInitPosState={[stageInitPos, setStageInitPos]}
          stageOffsetState={[stageOffset, setStageOffset]}
          drawModeState={[false, setIsDrawMode]}
          overlayRects={[...ruleMarks("baseline"), ...pickMarks("baseline")]}
          highlightedOverlayId={selectingNow ? "picked" : previewMark}
          dimOutside={dimOutside("baseline")}
          pickMode={pickMode}
          onPickHover={(point) => {
            const element = elementAt(point, elementsOf("baseline"));
            setHovered(element ? { side: "baseline", element } : undefined);
          }}
          onPick={pick("baseline")}
        />
      </Grid>
    </Grid>
  );

  const diffPanel = (
    type: ImageDetailsProps["type"],
    branchName: string,
    imageName: string | null,
    imageStatus: ImageStateLoad,
    image: HTMLImageElement | undefined,
  ) => (
    <Grid item xs={6} className={classes.drawAreaItem} ref={rightItemRef}>
      <Grid
        container
        alignItems="center"
        spacing={1}
        className={classes.imageToolbar}
      >
        <ImageDetails
          type={type}
          branchName={branchName}
          imageName={imageName}
          image={image}
          ignoreAreas={JSON.parse(testRun.tempIgnoreAreas)}
        />
        {testRun.diffName && (
          <Grid item>
            <Tooltip title={t("review.toggleDiff")}>
              <Switch
                checked={isDiffShown}
                onChange={() => setIsDiffShown(!isDiffShown)}
                name="Toggle diff"
                inputProps={{ "aria-label": t("review.toggleDiffLabel") }}
              />
            </Tooltip>
          </Grid>
        )}
      </Grid>
      <DrawArea
        imageName={imageName}
        imageState={[image, imageStatus]}
        underlayImage={isDiffShown ? undefined : baselineImage}
        overlayOpacity={overlayOpacity}
        blendDifference={blendDifference && !isDiffShown}
        ignoreAreas={ignoreAreas}
        tempIgnoreAreas={JSON.parse(testRun.tempIgnoreAreas)}
        setIgnoreAreas={handleIgnoreAreaChange}
        selectedRectId={selectedRectId}
        deleteIgnoreArea={deleteIgnoreArea}
        setSelectedRectId={setSelectedRectId}
        onStageClick={removeSelection}
        stageScaleState={[stageScale, setStageScale]}
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
            ? "picked"
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
      />
    </Grid>
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

  const header = () => (
    <Box mt={1} ml={1}>
      <Grid
        container
        alignItems="center"
        className={classes.header}
        spacing={2}
      >
        <Grid item>
          <Typography variant="h6" display="inline">
            {t("review.step", {
              current: currentRunIndex + 1,
              total: totalTestRunCount,
            })}
          </Typography>
          <Typography
            variant="h6"
            display="inline"
            className={classes.testRunName}
          >
            {testRun.name}
          </Typography>
        </Grid>
        <Grid item>
          <TestStatusChip status={testRun.status} />
        </Grid>
        {bugs.slice(0, 3).map((bug) => (
          <Grid item key={bug.id}>
            <Tooltip title={bug.summary}>
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
          </Grid>
        ))}
        <Grid item>
          <StepDots statuses={stepStatuses} currentIndex={currentRunIndex} />
        </Grid>
        <Grid item>
          <RunFlags run={testRun} />
        </Grid>
        {withUiTree && (
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={a11yOverlay}
                  onChange={(event) => setA11yOverlay(event.target.checked)}
                />
              }
              label={
                <Typography variant="body2">{t("review.overlay")}</Typography>
              }
            />
          </Grid>
        )}
        {deviceRuns.length > 1 && handleSelectRun && (
          <Grid item>
            <DeviceStrip
              runs={deviceRuns}
              currentId={testRun.id}
              onSelect={handleSelectRun}
            />
          </Grid>
        )}
        <Grid item className={classes.closeIcon}>
          <IconButton color="inherit" onClick={handleClose} size="large">
            <Close />
          </IconButton>
        </Grid>
      </Grid>
    </Box>
  );

  // Fade and blend read the checkpoint against its baseline. They sit in the
  // top toolbar: next to the side panel the checkpoint's own header is too
  // narrow, and the slider shrank to a dot there.
  const compareControls = () => (
    <>
      {canCompareToBaseline(testRun) && (
        <Box display="flex" alignItems="center" gap={1}>
          <MuiTooltip title={t("review.fadeHelp")}>
            <Box display="flex" alignItems="center" gap={1} minWidth={0}>
              <Typography variant="caption" color="textSecondary" noWrap>
                {t("review.fade")}
              </Typography>
              <Box width={80} display="flex" data-testid="overlayOpacity">
                <Slider
                  size="small"
                  disabled={blendDifference}
                  min={0}
                  max={1}
                  step={0.05}
                  value={overlayOpacity}
                  onChange={(event, value) => {
                    setOverlayOpacity(value as number);
                    setIsDiffShown(false);
                  }}
                  aria-label={t("review.fadeLabel")}
                />
              </Box>
            </Box>
          </MuiTooltip>
          <MuiTooltip title={t("review.blendHelp")}>
            <ToggleButton
              value="blend"
              size="small"
              selected={blendDifference}
              onChange={() => {
                setBlendDifference((blend) => !blend);
                setIsDiffShown(false);
              }}
              data-testid="differenceToggle"
              style={{ padding: 4 }}
            >
              <Compare fontSize="small" />
            </ToggleButton>
          </MuiTooltip>
        </Box>
      )}
    </>
  );

  const testRunDetails = () => (
    <Box ml={1} mr={1} mt={0} mb={0}>
      <Grid
        container
        alignItems="center"
        className={classes.testRunDetails}
        spacing={1}
      >
        <TestRunDetails testRun={testRun} />
        {isImageSizeDiffer && (
          <Grid item>
            <Tooltip title={t("review.sizeDiffers")}>
              <IconButton size="large">
                <WarningRounded color="secondary" />
              </IconButton>
            </Tooltip>
          </Grid>
        )}
        <Grid item style={{ marginLeft: "auto" }}>
          {compareControls()}
        </Grid>
        <Grid item>{comparisonTools()}</Grid>
        <Grid item>
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
        </Grid>
      </Grid>
      <Divider />
    </Box>
  );

  return (
    <>
      {header()}
      <Divider />
      {processing && <LinearProgress />}
      {testRunDetails()}
      <Box
        overflow="hidden"
        position="relative"
        className={classes.drawAreaContainer}
        display="flex"
      >
        {pickMode && (
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
              borderRadius: "10px",
              bgcolor: tokens.text,
              color: tokens.surface,
              boxShadow: tokens.shadowPop,
              fontSize: 13,
            }}
          >
            {t("select.hint")}
            <Button
              size="small"
              onClick={toggleSelecting}
              sx={{
                color: "inherit",
                bgcolor: "rgba(255,255,255,.14)",
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
          height="100%"
          ref={panesRef}
          data-testid="reviewPanes"
        >
          <Grid
            container
            justifyContent="center"
            alignItems="stretch"
            style={{
              height: "100%",
            }}
          >
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
          </Grid>
        </Box>
        <InsightsPanel
          testRun={testRun}
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
        />
      </Box>
      <Grid container className={classes.footer}>
        <Grid item xs={3} className={classes.scaleActions}>
          <Tooltip title={t("review.zoomIn")}>
            <IconButton
              onClick={() =>
                setStageScale(clampScale(stageScale * stageScaleBy))
              }
              size="large"
            >
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("review.zoomOut")}>
            <IconButton
              onClick={() =>
                setStageScale(clampScale(stageScale / stageScaleBy))
              }
              size="large"
            >
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("review.originalSize")}>
            <IconButton onClick={setOriginalSize} size="large">
              <Fullscreen />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("review.fit")}>
            <IconButton onClick={fitImagesToStage} size="large">
              <FullscreenExit />
            </IconButton>
          </Tooltip>
        </Grid>
        <Grid item xs={6} className={classes.centerActions}>
          <Tooltip title={t("review.hotkeyLeft")}>
            <IconButton
              color="secondary"
              style={{
                visibility: currentRunIndex > 0 ? "visible" : "hidden",
              }}
              onClick={goPrevious}
              size="large"
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
          <Tooltip title={t("review.hotkeyRight")}>
            <IconButton
              color="secondary"
              style={{
                visibility:
                  totalTestRunCount > currentRunIndex + 1
                    ? "visible"
                    : "hidden",
              }}
              onClick={goNext}
              size="large"
            >
              <NavigateNext />
            </IconButton>
          </Tooltip>
        </Grid>
        <Grid
          item
          xs={3}
          className={classes.testRunActions}
          justifyContent="flex-end"
        >
          <FormControlLabel
            control={
              <Checkbox
                color="primary"
                size="small"
                checked={goToNextAutomatically}
                onChange={(e) => setGoToNextAutomatically(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" color="textSecondary">
                {t("review.goNext")}
              </Typography>
            }
          />
          {jiraSet && (
            <>
              <Divider
                orientation="vertical"
                flexItem
                sx={{ mx: 1.5, my: 1.5 }}
              />
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
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {t("reportBug.open")}
                    <Box
                      component="kbd"
                      sx={{
                        ml: 1,
                        fontFamily: tokens.mono,
                        fontSize: 10.5,
                        border: "1px solid currentColor",
                        borderRadius: 0.5,
                        px: 0.5,
                        opacity: 0.75,
                      }}
                    >
                      B
                    </Box>
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </Grid>
      </Grid>
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
      {selection && structure && (
        <ElementPopover
          key={`${selection.side}:${selection.picked.element.selector}:${selection.picked.element.bounds.x},${selection.picked.element.bounds.y}`}
          anchor={selection.anchor}
          element={selection.picked.element}
          selectedCount={selection.selected.length}
          sameSelector={countBySelector(
            selection.picked.element.selector,
            elementsOf(selection.side),
          )}
          rule={
            selection.selected.length === 1
              ? ruleFor(
                  selection.picked.element,
                  structure.rules,
                  selection.side,
                )
              : undefined
          }
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
          onRemove={removeRule}
          onClose={() => setSelection(undefined)}
        />
      )}
      <Popover
        open={!!noTreeAnchor}
        anchorEl={noTreeAnchor}
        onClose={() => setNoTreeAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { mt: 1, p: 2, width: 260, borderRadius: "14px" } },
        }}
      >
        <Box
          data-testid="noTree"
          display="flex"
          flexDirection="column"
          gap={1.5}
        >
          <Typography sx={{ fontSize: 14.5, fontWeight: 600 }}>
            {t("select.noTree")}
          </Typography>
          <Box
            display="flex"
            justifyContent="flex-end"
            alignItems="center"
            gap={1}
          >
            <Tooltip title={t("select.whyText")}>
              <Button size="small">{t("select.why")}</Button>
            </Tooltip>
            <Button
              size="small"
              variant="contained"
              data-testid="drawAreaInstead"
              onClick={() => {
                setNoTreeAnchor(null);
                setAreasOpen(true);
                setIsDrawMode(true);
              }}
            >
              {t("select.drawArea")}
            </Button>
          </Box>
        </Box>
      </Popover>
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
