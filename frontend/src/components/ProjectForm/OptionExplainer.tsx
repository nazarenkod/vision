import React from "react";
import { Box, IconButton, Popover, Typography } from "@mui/material";
import { HelpOutline } from "@mui/icons-material";
import { MessageKey, useT } from "../../i18n";
import { radius, tokens } from "../../theme";
import { prefersReducedMotion } from "../../_helpers/motion.helper";
import {
  ExplainedOption,
  explainerScene,
  SCENE_SIZE,
  Shape,
  stillFrame,
  Tone,
} from "./explainerScenes";

// one cycle: the "before" frame, the change, the "after" frame with its marks (REQ-049-24)
const CYCLE_MS = 2400;
const VIEW = { width: SCENE_SIZE.width, height: SCENE_SIZE.height + 20 };

const FILL: Record<Tone, string> = {
  frame: tokens.surface,
  bar: tokens.subtle,
  block: tokens.subtle,
  accent: tokens.brand,
  ink: tokens.text,
  soft: tokens.textMuted,
};

const STROKE: Partial<Record<Tone, string>> = {
  frame: tokens.borderStrong,
  block: tokens.border,
  accent: tokens.brand,
};

const KEYFRAMES = {
  "@keyframes v-explain-in": {
    "0%, 30%": { opacity: 0 },
    "55%, 100%": { opacity: 1 },
  },
  "@keyframes v-explain-out": {
    "0%, 30%": { opacity: 1 },
    "55%, 100%": { opacity: 0 },
  },
  "@keyframes v-explain-move": {
    "0%, 30%": { transform: "translateY(0)" },
    "55%, 100%": { transform: "translateY(var(--v-dy))" },
  },
  "@keyframes v-explain-grow": {
    "0%, 30%": { transform: "scaleY(1)" },
    "55%, 100%": { transform: "scaleY(var(--v-grow))" },
  },
  "@keyframes v-explain-mark": {
    "0%, 60%": { opacity: 0 },
    "70%, 100%": { opacity: 1 },
  },
};

const animationOf = (shape: Shape): React.CSSProperties | undefined => {
  const run = (name: string) =>
    `${name} ${CYCLE_MS}ms ease-in-out infinite alternate`;
  if (shape.appears) return { animation: run("v-explain-in") };
  if (shape.vanishes) return { animation: run("v-explain-out") };
  if (shape.dy)
    return {
      animation: run("v-explain-move"),
      ["--v-dy" as string]: `${shape.dy}px`,
    };
  if (shape.dh)
    return {
      animation: run("v-explain-grow"),
      transformBox: "fill-box",
      transformOrigin: "top",
      ["--v-grow" as string]: String((shape.h + shape.dh) / shape.h),
    };
  return undefined;
};

const ShapeView: React.FunctionComponent<{
  shape: Shape;
  animated: boolean;
}> = ({ shape, animated }) => {
  const style = animated ? animationOf(shape) : undefined;
  if (shape.kind === "text") {
    return (
      <text
        x={shape.x}
        y={shape.y + shape.h}
        fontSize={shape.h}
        fontWeight={700}
        fill={FILL[shape.tone]}
        style={style}
      >
        {shape.text}
      </text>
    );
  }
  if (shape.kind === "line") {
    return (
      <line
        x1={shape.x}
        y1={shape.y}
        x2={shape.x + shape.w}
        y2={shape.y + shape.h}
        stroke={FILL[shape.tone]}
        strokeWidth={2}
        style={style}
      />
    );
  }
  return (
    <rect
      x={shape.x}
      y={shape.y}
      width={shape.w}
      height={shape.h}
      rx={shape.tone === "frame" ? 10 : 4}
      fill={FILL[shape.tone]}
      stroke={STROKE[shape.tone]}
      style={style}
    />
  );
};

const Frame: React.FunctionComponent<{
  shapes: Shape[];
  marks: ReturnType<typeof explainerScene>["marks"];
  animated: boolean;
  label: string;
  testId: string;
}> = ({ shapes, marks, animated, label, testId }) => (
  <Box
    component="svg"
    viewBox={`-2 -2 ${VIEW.width + 4} ${VIEW.height + 4}`}
    role="img"
    aria-label={label}
    data-testid={testId}
    data-animated={animated ? "true" : "false"}
    sx={{ width: 132, height: 242, display: "block", ...KEYFRAMES }}
  >
    {shapes.map((shape, index) => (
      <ShapeView key={index} shape={shape} animated={animated} />
    ))}
    {marks.map((mark, index) => (
      <rect
        key={`mark-${index}`}
        data-testid="explainerMark"
        x={mark.x}
        y={mark.y}
        width={mark.w}
        height={mark.h}
        rx={3}
        fill={tokens.diffSoft}
        stroke={tokens.diff}
        strokeWidth={1.5}
        style={
          animated
            ? {
                animation: `v-explain-mark ${CYCLE_MS}ms ease-in-out infinite alternate`,
              }
            : undefined
        }
      />
    ))}
  </Box>
);

/**
 * A "?" beside an option that opens what the option does, as a short
 * before-and-after animation in the switch's current state (REQ-049-20…28).
 */
export const OptionExplainer: React.FunctionComponent<{
  option: ExplainedOption;
  on: boolean;
}> = ({ option, on }) => {
  const { t } = useT();
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const scene = explainerScene(option, on);
  const description = t(
    `explainer.${option}.${on ? "on" : "off"}` as MessageKey,
  );
  const reduced = prefersReducedMotion();

  return (
    <>
      <IconButton
        size="small"
        aria-label={t("explainer.button")}
        aria-expanded={anchor ? "true" : "false"}
        data-testid={`explain-${option}`}
        onClick={(event) =>
          setAnchor(anchor ? null : (event.currentTarget as HTMLElement))
        }
        sx={{ color: tokens.textMuted }}
      >
        <HelpOutline fontSize="small" />
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            "data-testid": `explainer-${option}`,
            sx: { p: 2, borderRadius: radius.card, maxWidth: 340 },
          } as object,
        }}
      >
        {reduced ? (
          <Box sx={{ display: "flex", gap: 1.5 }}>
            {(["before", "after"] as const).map((frame) => (
              <Box key={frame}>
                <Typography variant="caption" color="textSecondary">
                  {t(`explainer.${frame}`)}
                </Typography>
                <Frame
                  shapes={stillFrame(scene, frame)}
                  marks={frame === "after" ? scene.marks : []}
                  animated={false}
                  label={`${t(`explainer.${frame}`)}: ${description}`}
                  testId={`explainerFrame-${frame}`}
                />
              </Box>
            ))}
          </Box>
        ) : (
          <Frame
            shapes={scene.shapes}
            marks={scene.marks}
            animated
            label={description}
            testId="explainerAnimation"
          />
        )}
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          {description}
        </Typography>
      </Popover>
    </>
  );
};

/** An option with its "?" right after it, on one line. */
export const Explained: React.FunctionComponent<{
  option: ExplainedOption;
  on: boolean;
  children: React.ReactNode;
}> = ({ option, on, children }) => (
  <Box sx={{ display: "flex", alignItems: "center" }}>
    {children}
    <OptionExplainer option={option} on={on} />
  </Box>
);
