import React, { useEffect, useState } from "react";
import { makeStyles } from "@mui/styles";
import {
  Typography,
  Button,
  Grid,
  Switch,
  IconButton,
  Box,
  Select,
  MenuItem,
  LinearProgress,
  Divider,
  FormControlLabel,
  Checkbox,
  ToggleButton,
  SelectChangeEvent,
  Slider,
  Tooltip as MuiTooltip,
} from "@mui/material";
import { useHotkeys } from "react-hotkeys-hook";
import { TestRun } from "../../types";
import { testRunService, staticService } from "../../services";
import { TestStatus } from "../../types/testStatus";
import { IgnoreArea, UpdateIgnoreAreaDto } from "../../types/ignoreArea";
import Konva from "konva";
import {
  Close,
  Add,
  Delete,
  Save,
  WarningRounded,
  LayersClear,
  Compare,
  Collections,
  OpenInNew,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  FullscreenExit,
  NavigateNext,
  NavigateBefore,
} from "@mui/icons-material";
import { TestRunDetails } from "./TestRunDetails";
import useImage from "use-image";
import { routes, GO_TO_NEXT_KEY } from "../../constants";
import { useTestRunDispatch, useProjectState } from "../../contexts";
import { DrawArea, ImageStateLoad } from "./DrawArea";
import { CommentsPopper } from "../CommentsPopper";
import { useDialogSnackbar } from "./useDialogSnackbar";
import { ApproveRejectButtons } from "./ApproveRejectButtons";
import {
  MatchingVariationsDialog,
  MatchingVariationsMode,
} from "./MatchingVariationsDialog";
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
import { tokens } from "../../theme";
import { BaseModal } from "../BaseModal";
import { Tooltip } from "../Tooltip";
import ImageDetails, { ImageDetailsProps } from "./ImageDetails";
import { calculateScale, clampScale } from "../../_helpers/scale.helper";
import { canCompareToBaseline } from "../../_helpers/testRunStatus.helper";
import TestStatusChip from "../TestStatusChip";

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
    fontWeight: 300,
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

interface TestDetailsModalProps {
  testRun: TestRun;
  currentRunIndex: number;
  totalTestRunCount: number;
  touched: boolean;
  handleClose: () => void;
  handlePrevious: () => void;
  handleNext: () => void;
  // the same check on every device of the build
  deviceRuns?: TestRun[];
  handleSelectRun?: (id: string) => void;
}

const TestDetailsModal: React.FunctionComponent<TestDetailsModalProps> = ({
  testRun,
  currentRunIndex,
  totalTestRunCount,
  touched,
  handlePrevious,
  handleNext,
  handleClose,
  deviceRuns = [],
  handleSelectRun,
}) => {
  const classes = useStyles();
  const { enqueueSnackbar } = useDialogSnackbar();
  const testRunDispatch = useTestRunDispatch();
  const { selectedProjectId, projectList } = useProjectState();
  const project = projectList.find((item) => item.id === selectedProjectId);
  const [variationsMode, setVariationsMode] =
    useState<MatchingVariationsMode | null>(null);

  const stageScaleBy = 1.2;
  const [stageScale, setStageScale] = React.useState(1);
  const [stagePos, setStagePos] = React.useState(defaultStagePos);
  const [stageScrollPos, setStageScrollPos] = React.useState(defaultStagePos);
  const [stageInitPos, setStageInitPos] = React.useState(defaultStagePos);
  const [stageOffset, setStageOffset] = React.useState(defaultStagePos);
  const [processing, setProcessing] = React.useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);

  const [valueOfIgnoreOrCompare, setValueOfIgnoreOrCompare] =
    useState("Ignore Areas");

  const [isDiffShown, setIsDiffShown] = useState(false);

  // accessibility report of this run, shared by the side panel and the overlay
  const aiStatus = useAiStatus();
  const [a11yReport, setA11yReport] = useState<A11yReport | null | undefined>();
  const [a11yOverlay, setA11yOverlay] = useState(true);
  const [highlightedViolation, setHighlightedViolation] = useState<string>();
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

  // picking an element on the screenshot to make a rule for it
  const [pickMode, setPickMode] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<PickableElement>();
  const [pickedElement, setPickedElement] = useState<PickableElement>();
  // chosen in the rule dialog's list, outlined while the dialog is open
  const [previewElement, setPreviewElement] = useState<PickableElement>();
  const elementAt = (point: { x: number; y: number } | null) =>
    point
      ? (structure?.elements ?? [])
          .filter(
            ({ bounds: b }) =>
              point.x >= b.x &&
              point.x < b.x + b.width &&
              point.y >= b.y &&
              point.y < b.y + b.height,
          )
          // the smallest element under the pointer is the one meant
          .sort(
            (a, b) =>
              a.bounds.width * a.bounds.height -
              b.bounds.width * b.bounds.height,
          )[0]
      : undefined;
  useEffect(() => {
    setPickMode(false);
    setHoveredElement(undefined);
    setPickedElement(undefined);
    setPreviewElement(undefined);
  }, [testRun.id]);
  useEffect(() => {
    if (!pickMode) return;
    // Esc leaves picking instead of closing the review
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setPickMode(false);
      setHoveredElement(undefined);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pickMode]);
  const pickRects: OverlayRect[] = [
    hoveredElement,
    previewElement,
    pickedElement,
  ]
    .filter((element): element is PickableElement => !!element)
    .slice(0, 1)
    .map((element) => ({
      id: "picked",
      ...element.bounds,
      color: tokens.brand,
      label:
        element.element.length > 40
          ? `${element.element.slice(0, 39)}…`
          : element.element,
    }));

  const ruleRects: OverlayRect[] = React.useMemo(
    () =>
      a11yOverlay && structure
        ? [
            ...structure.systemBars.map((rect, i) => ({
              id: `bar-${i}`,
              ...rect,
              color: "#98A2B3",
              dashed: true,
            })),
            ...structure.ignoredAreas.map((rect, i) => ({
              id: `ignored-${i}`,
              ...rect,
              color: "#667085",
              dashed: true,
              label: "ignored",
            })),
            ...structure.toleratedAreas.map((rect, i) => ({
              id: `tolerated-${i}`,
              ...rect,
              color: "#175CD3",
              dashed: true,
              label: `±${rect.maxDiffPercent}%`,
            })),
          ]
        : [],
    [a11yOverlay, structure],
  );

  const overlayRects: OverlayRect[] = React.useMemo(
    () =>
      a11yOverlay && a11yReport
        ? a11yReport.violations.map((violation, index) => {
            const tracked =
              violation.status === "existing" || !!violation.issue;
            return {
              id: violation.id,
              ...violation.bounds,
              color: tracked ? tokens.a11yExisting : tokens.a11y,
              dashed: tracked,
              label: String(index + 1),
            };
          })
        : [],
    [a11yOverlay, a11yReport],
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

  const handleGoToNextAutomatically = () => {
    if (goToNextAutomatically) {
      handleNext();
    }
  };

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

  const applyIgnoreAreaText =
    "Apply selected ignore area to all images in this build.";

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
    setSelectedRectId(undefined);
  }, [testRun.id, testRun.diffName]);

  useEffect(() => {
    setIgnoreAreas(JSON.parse(testRun.ignoreAreas));
  }, [testRun]);

  useEffect(() => {
    fitImagesToStage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineImage, currentImage]);

  useHotkeys("right", handleNext, [currentRunIndex, handleNext]);
  useHotkeys("left", handlePrevious, [currentRunIndex, handlePrevious]);

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
    if (valueOfIgnoreOrCompare.includes("Ignore")) {
      saveTestRun(ignoreAreas, "Ignore areas are updated.");
    } else if (currentImage) {
      const invertedIgnoreAreas = invertIgnoreArea(
        currentImage.width,
        currentImage.height,
        ignoreAreas[0],
      );

      handleIgnoreAreaChange(invertedIgnoreAreas);
      saveTestRun(
        invertedIgnoreAreas,
        "Selected area has been inverted to ignore areas and saved.",
      );
    }

    testRunDispatch({
      type: "touched",
      payload: false,
    });
  };

  const onIgnoreOrCompareSelectChange = (value: string) => {
    if (value.includes("Compare")) {
      setValueOfIgnoreOrCompare("Compare Area");
    } else {
      setValueOfIgnoreOrCompare("Ignore Areas");
    }
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
            enqueueSnackbar(
              "Ignore areas are updated in all images in this build.",
              {
                variant: "success",
              },
            );
          });
        })
        .catch((error) => {
          enqueueSnackbar(`There was an error : ${error}`, {
            variant: "error",
          });
          setProcessing(false);
        });
    } else {
      enqueueSnackbar(
        "There was an error determining which ignore area to apply.",
        {
          variant: "error",
        },
      );
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
  useHotkeys("ESC", handleClose, [handleClose]);

  const openHistoryTab = () => {
    window.open(
      `${routes.VARIATION_DETAILS_PAGE}/${testRun.testVariationId}`,
      "_blank",
    );
  };

  const ignoreAreasToolbar = () => (
    <React.Fragment>
      <Grid container alignItems="center" spacing={2}>
        <Grid item>
          <Select
            variant="standard"
            id="area-select"
            labelId="areaSelect"
            // a standard select underlines itself, which reads as a text field
            // among the buttons it now sits with
            sx={{
              "&:before, &:after, &:hover:not(.Mui-disabled):before": {
                borderBottom: "none",
              },
            }}
            value={valueOfIgnoreOrCompare}
            onChange={(event: SelectChangeEvent<HTMLInputElement>) =>
              onIgnoreOrCompareSelectChange(event.target.value as string)
            }
          >
            {["Ignore Areas", "Compare Area"].map((eachItem) => (
              <MenuItem key={eachItem} value={eachItem}>
                {eachItem}
              </MenuItem>
            ))}
          </Select>
        </Grid>
        <Grid item>
          <ToggleButton
            value={"drawMode"}
            selected={isDrawMode}
            size="small"
            onClick={() => {
              setIsDrawMode(!isDrawMode);
            }}
            style={{
              padding: 4,
            }}
          >
            <Add />
          </ToggleButton>
        </Grid>
        <Grid item>
          <IconButton
            size="small"
            disabled={!selectedRectId || ignoreAreas.length === 0}
            onClick={() => selectedRectId && deleteIgnoreArea(selectedRectId)}
          >
            <Delete />
          </IconButton>
        </Grid>
        <Tooltip title="Clears all ignore areas." aria-label="reject">
          <Grid item>
            <IconButton
              size="small"
              disabled={ignoreAreas.length === 0}
              onClick={() => {
                handleIgnoreAreaChange([]);
              }}
            >
              <LayersClear />
            </IconButton>
          </Grid>
        </Tooltip>
        <Tooltip title={applyIgnoreAreaText} aria-label="apply ignore area">
          <Grid item>
            <IconButton
              size="small"
              disabled={!selectedRectId || ignoreAreas.length === 0}
              onClick={() => toggleApplyIgnoreDialogOpen()}
            >
              <Collections />
            </IconButton>
          </Grid>
        </Tooltip>
        <Grid item>
          <IconButton
            size="small"
            disabled={!touched}
            onClick={() => saveIgnoreAreasOrCompareArea()}
          >
            <Save />
          </IconButton>
        </Grid>
      </Grid>
    </React.Fragment>
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
            History <OpenInNew fontSize="small" />
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
            <Tooltip title={"Toggle diff. Hotkey: D"}>
              <Switch
                checked={isDiffShown}
                onChange={() => setIsDiffShown(!isDiffShown)}
                name="Toggle diff"
                inputProps={{ "aria-label": "Toggle diff" }}
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
          ...ruleRects,
          ...(pickMode || pickedElement || previewElement
            ? pickRects
            : overlayRects),
        ]}
        highlightedOverlayId={
          pickMode || pickedElement || previewElement
            ? "picked"
            : highlightedViolation
        }
        pickMode={pickMode}
        onPickHover={(point) => setHoveredElement(elementAt(point))}
        onPick={(point) => {
          const element = elementAt(point);
          if (!element) return;
          setPickMode(false);
          setHoveredElement(undefined);
          setPickedElement(element);
        }}
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
          <Typography variant="h6" display="inline">{`Step ${
            currentRunIndex + 1
          }/${totalTestRunCount}: `}</Typography>
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
              label={<Typography variant="body2">Overlay</Typography>}
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
          <MuiTooltip title="Fade the checkpoint out to see the baseline through it">
            <Box display="flex" alignItems="center" gap={1} minWidth={0}>
              <Typography variant="caption" color="textSecondary" noWrap>
                Fade
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
                  aria-label="Fade to the baseline"
                />
              </Box>
            </Box>
          </MuiTooltip>
          <MuiTooltip title="Blend the two as a difference: what matches goes black, and a shift shows as an offset ghost">
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
            <Tooltip
              title={
                "Image height/width differ from baseline! Cannot calculate diff!"
              }
            >
              <IconButton size="large">
                <WarningRounded color="secondary" />
              </IconButton>
            </Tooltip>
          </Grid>
        )}
        <Grid item style={{ marginLeft: "auto" }}>
          {compareControls()}
        </Grid>
        <Grid item>{ignoreAreasToolbar()}</Grid>
        <Grid item>
          <CommentsPopper
            text={testRun.comment}
            onSave={(comment) =>
              testRunService
                .update(testRun.id, {
                  comment,
                })
                .then(() =>
                  enqueueSnackbar("Comment updated", {
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
        <Box flex={1} minWidth={0} height="100%">
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
          pickMode={pickMode}
          onPickModeChange={(on) => {
            setPickMode(on);
            setHoveredElement(undefined);
          }}
          pickedElement={pickedElement}
          onPickedDone={() => setPickedElement(undefined)}
          onPreviewElement={setPreviewElement}
        />
      </Box>
      <Grid container className={classes.footer}>
        <Grid item xs={3} className={classes.scaleActions}>
          <Tooltip title={"Zoom In"}>
            <IconButton
              onClick={() =>
                setStageScale(clampScale(stageScale * stageScaleBy))
              }
              size="large"
            >
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title={"Zoom Out"}>
            <IconButton
              onClick={() =>
                setStageScale(clampScale(stageScale / stageScaleBy))
              }
              size="large"
            >
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title={"Original size"}>
            <IconButton onClick={setOriginalSize} size="large">
              <Fullscreen />
            </IconButton>
          </Tooltip>
          <Tooltip title={"Fit into screen"}>
            <IconButton onClick={fitImagesToStage} size="large">
              <FullscreenExit />
            </IconButton>
          </Tooltip>
        </Grid>
        <Grid item xs={6} className={classes.centerActions}>
          <Tooltip title={"Hotkey: ArrowLeft"}>
            <IconButton
              color="secondary"
              style={{
                visibility: currentRunIndex > 0 ? "visible" : "hidden",
              }}
              onClick={handlePrevious}
              size="large"
            >
              <NavigateBefore />
            </IconButton>
          </Tooltip>
          {(testRun.status === TestStatus.unresolved ||
            testRun.status === TestStatus.new) && (
            <ApproveRejectButtons
              testRun={testRun}
              afterApprove={handleGoToNextAutomatically}
              afterReject={handleGoToNextAutomatically}
              onOpenVariations={setVariationsMode}
            />
          )}
          <Tooltip title={"Hotkey: ArrowRight"}>
            <IconButton
              color="secondary"
              style={{
                visibility:
                  totalTestRunCount > currentRunIndex + 1
                    ? "visible"
                    : "hidden",
              }}
              onClick={handleNext}
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
                Go to the next after Approve/Reject
              </Typography>
            }
          />
        </Grid>
      </Grid>
      <BaseModal
        open={applyIgnoreDialogOpen}
        title={applyIgnoreAreaText}
        submitButtonText={"Yes"}
        onCancel={toggleApplyIgnoreDialogOpen}
        content={
          <Typography>
            {`All images in the current build will be re-compared with new ignore area taken into account. Are you sure?`}
          </Typography>
        }
        onSubmit={() => {
          toggleApplyIgnoreDialogOpen();
          applyIgnoreArea();
        }}
      />
      <MatchingVariationsDialog
        key={testRun.id}
        mode={variationsMode}
        testRun={testRun}
        groupBy={project?.bulkApproveGroupBy}
        onClose={() => setVariationsMode(null)}
      />
    </>
  );
};

export default TestDetailsModal;
