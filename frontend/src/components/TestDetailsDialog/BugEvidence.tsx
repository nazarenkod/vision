import React from "react";
import { Box, IconButton, ToggleButton, Typography } from "@mui/material";
import { Close, CropFree, AdsClick } from "@mui/icons-material";
import { Circle, Group, Image, Layer, Rect, Stage, Text } from "react-konva";
import useImage from "use-image";
import { staticService } from "../../services";
import { PickableElement, TestRun } from "../../types";
import { tokens } from "../../theme";
import { useTokens } from "../../contexts/themeMode.context";
import { addMark, BugMark, removeMark } from "../../_helpers/bugReport.helper";
import { elementAt, elementLabel } from "../../_helpers/elementPicking.helper";
import { SlidingToggleGroup } from "../motion/SlidingToggleGroup";
import { useT } from "../../i18n";

type Tool = "mark" | "pick";

/**
 * The screenshot a bug is about: the checkpoint with the person's numbered
 * marks, drawn as a frame or picked from the UI tree, and the baseline in the
 * same place to compare (REQ-025-10, REQ-025-11).
 */
export const BugEvidence: React.FunctionComponent<{
  testRun: TestRun;
  marks: BugMark[];
  onChange: (marks: BugMark[]) => void;
  elements: PickableElement[];
  disabled?: boolean;
  width: number;
  height: number;
}> = ({ testRun, marks, onChange, elements, disabled, width, height }) => {
  const { t } = useT();
  const colors = useTokens();
  const markColor = colors.status.new.fg;
  const [side, setSide] = React.useState<"checkpoint" | "baseline">(
    "checkpoint",
  );
  const [tool, setTool] = React.useState<Tool>(
    elements.length ? "pick" : "mark",
  );
  const [drawing, setDrawing] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [hovered, setHovered] = React.useState<PickableElement>();
  const [checkpoint] = useImage(staticService.getImage(testRun.imageName));
  const [baseline] = useImage(
    testRun.baselineName ? staticService.getImage(testRun.baselineName) : "",
  );
  const image = side === "checkpoint" ? checkpoint : baseline;
  const natural = checkpoint ?? baseline;
  const scale = natural
    ? Math.min(width / natural.width, height / natural.height)
    : 1;
  const offsetX = natural ? (width - natural.width * scale) / 2 : 0;
  const editing = side === "checkpoint" && !disabled;

  // pointer position in screenshot pixels
  const toImage = (stageX: number, stageY: number) => ({
    x: (stageX - offsetX) / scale,
    y: stageY / scale,
  });
  const pointer = (event: { target: { getStage: () => unknown } }) => {
    const stage = event.target.getStage() as {
      getPointerPosition: () => { x: number; y: number } | null;
    };
    const position = stage.getPointerPosition();
    return position ? toImage(position.x, position.y) : null;
  };

  const frame = (
    area: { x: number; y: number; width: number; height: number },
    key: string,
    dashed = false,
  ) => (
    <Rect
      key={key}
      x={offsetX + area.x * scale}
      y={area.y * scale}
      width={area.width * scale}
      height={area.height * scale}
      stroke={markColor}
      strokeWidth={2}
      dash={dashed ? [5, 4] : undefined}
      fill={dashed ? undefined : colors.status.new.bg}
      opacity={dashed ? 0.9 : 1}
      listening={false}
    />
  );

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 1.5, minHeight: 0 }}
      data-testid="bugEvidence"
    >
      {/* short labels that never wrap: the column is narrow, and "Mark area"
          broke into two lines; the hint under the screenshot says what to do */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          "& .MuiToggleButton-root": { whiteSpace: "nowrap" },
        }}
      >
        <SlidingToggleGroup
          size="small"
          exclusive
          value={side}
          onChange={(_, value) => value && setSide(value)}
        >
          <ToggleButton value="checkpoint">
            {t("reportBug.checkpoint")}
          </ToggleButton>
          <ToggleButton value="baseline" disabled={!testRun.baselineName}>
            {t("reportBug.baseline")}
          </ToggleButton>
        </SlidingToggleGroup>
        <Box sx={{ flex: 1 }} />
        <SlidingToggleGroup
          size="small"
          exclusive
          value={tool}
          onChange={(_, value) => value && setTool(value)}
          disabled={!editing}
        >
          <ToggleButton value="mark" data-testid="markArea">
            <CropFree fontSize="small" sx={{ mr: 0.5 }} />
            {t("reportBug.markArea")}
          </ToggleButton>
          <ToggleButton
            value="pick"
            disabled={!elements.length}
            data-testid="pickElement"
          >
            <AdsClick fontSize="small" sx={{ mr: 0.5 }} />
            {t("reportBug.pickElement")}
          </ToggleButton>
        </SlidingToggleGroup>
      </Box>
      <Box
        sx={{
          width,
          height,
          alignSelf: "center",
          cursor: editing ? "crosshair" : "default",
        }}
      >
        <Stage
          width={width}
          height={height}
          onMouseDown={(event) => {
            if (!editing || tool !== "mark") return;
            const at = pointer(event);
            if (at) setDrawing({ ...at, width: 0, height: 0 });
          }}
          onMouseMove={(event) => {
            const at = pointer(event);
            if (!at || !editing) return;
            if (tool === "pick") setHovered(elementAt(at, elements));
            else if (drawing)
              setDrawing({
                ...drawing,
                width: at.x - drawing.x,
                height: at.y - drawing.y,
              });
          }}
          onMouseUp={() => {
            if (drawing) onChange(addMark(marks, drawing));
            setDrawing(null);
          }}
          onMouseLeave={() => setHovered(undefined)}
          onClick={(event) => {
            if (!editing || tool !== "pick") return;
            const picked = elementAt(pointer(event), elements);
            if (picked)
              onChange(
                addMark(marks, {
                  ...picked.bounds,
                  element: picked.selector,
                  label: elementLabel(picked, t),
                }),
              );
          }}
        >
          <Layer>
            {image && (
              <Image
                image={image}
                x={offsetX}
                width={image.width * scale}
                height={image.height * scale}
                listening={false}
              />
            )}
            {side === "checkpoint" &&
              marks.map((mark) => (
                <Group key={mark.n} listening={false}>
                  {frame(mark, `frame-${mark.n}`)}
                  <Circle
                    x={offsetX + mark.x * scale}
                    y={mark.y * scale}
                    radius={10}
                    fill={markColor}
                    stroke={colors.surface}
                    strokeWidth={2}
                  />
                  <Text
                    text={String(mark.n)}
                    x={offsetX + mark.x * scale - 10}
                    y={mark.y * scale - 6}
                    width={20}
                    align="center"
                    fontSize={11}
                    fontStyle="bold"
                    fill={colors.surface}
                  />
                </Group>
              ))}
            {drawing && frame(drawing, "drawing", true)}
            {tool === "pick" && hovered && frame(hovered.bounds, "hover", true)}
          </Layer>
        </Stage>
      </Box>
      {marks.map((mark) => (
        <Box
          key={mark.n}
          data-testid="bugMark"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            bgcolor: tokens.surface,
            border: `1px solid ${tokens.border}`,
            borderRadius: 2,
            pl: 1,
            fontSize: 12,
          }}
        >
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              bgcolor: tokens.status.new.fg,
              color: tokens.surface,
              display: "grid",
              placeItems: "center",
              fontSize: 10.5,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {mark.n}
          </Box>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {mark.label ??
              t("reportBug.areaAt", {
                x: mark.x,
                y: mark.y,
                width: mark.width,
                height: mark.height,
              })}
            {mark.element && (
              <Box
                component="span"
                sx={{
                  fontFamily: tokens.mono,
                  fontSize: 11,
                  color: tokens.textMuted,
                  ml: 1,
                }}
              >
                {mark.element}
              </Box>
            )}
          </Typography>
          <IconButton
            size="small"
            aria-label={t("reportBug.removeMark")}
            onClick={() => onChange(removeMark(marks, mark.n))}
            disabled={disabled}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      ))}
      {!marks.length && (
        <Typography variant="caption" color="textSecondary" textAlign="center">
          {editing ? t("reportBug.markHint") : t("reportBug.marksOnCheckpoint")}
        </Typography>
      )}
    </Box>
  );
};
