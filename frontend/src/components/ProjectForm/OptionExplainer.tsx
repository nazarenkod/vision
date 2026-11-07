import React from "react";
import { Box, IconButton, Popover, Typography } from "@mui/material";
import { HelpOutline } from "@mui/icons-material";
import { MessageKey, Text, useT } from "../../i18n";
import { radius, tokens, type } from "../../theme";
import { prefersReducedMotion } from "../../_helpers/motion.helper";
import {
  ExplainedOption,
  explainerScene,
  Mark,
  SCENE_SIZE,
  sceneHeight,
  Shape,
  stillFrame,
  Tone,
  Verdict,
} from "./explainerScenes";

// the baseline turns into the current screen, holds, and turns back (REQ-049-24)
const CYCLE_MS = 2400;
const FRAME_WIDTH = 96;

const FILL: Record<Tone, string> = {
  frame: tokens.surface,
  bar: tokens.subtle,
  block: tokens.subtle,
  accent: tokens.brand,
  onAccent: tokens.brandInk,
  ink: tokens.text,
  line: tokens.textMuted,
  soft: tokens.textMuted,
  softer: tokens.borderStrong,
};

const STROKE: Partial<Record<Tone, string>> = {
  frame: tokens.borderStrong,
  block: tokens.border,
};

const KEYFRAMES = {
  "@keyframes v-explain-in": {
    "0%, 25%": { opacity: 0 },
    "50%, 100%": { opacity: 1 },
  },
  "@keyframes v-explain-out": {
    "0%, 25%": { opacity: 1 },
    "50%, 100%": { opacity: 0 },
  },
  "@keyframes v-explain-move": {
    "0%, 25%": { transform: "translateY(0)" },
    "50%, 100%": { transform: "translateY(var(--v-dy))" },
  },
  "@keyframes v-explain-grow": {
    "0%, 25%": { transform: "scaleY(1)" },
    "50%, 100%": { transform: "scaleY(var(--v-grow))" },
  },
  "@keyframes v-explain-tone": {
    "0%, 25%": { fill: "var(--v-from)" },
    "50%, 100%": { fill: "var(--v-to)" },
  },
};

const run = (name: string) =>
  `${name} ${CYCLE_MS}ms ease-in-out infinite alternate`;

const animationOf = (shape: Shape): React.CSSProperties | undefined => {
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
  if (shape.toneAfter)
    return {
      animation: run("v-explain-tone"),
      ["--v-from" as string]: FILL[shape.tone],
      ["--v-to" as string]: FILL[shape.toneAfter],
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
        y={shape.y + shape.h * 0.85}
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
      rx={
        shape.tone === "frame"
          ? 10
          : shape.tone === "block" || shape.tone === "accent"
            ? 4
            : 1
      }
      fill={FILL[shape.tone]}
      stroke={STROKE[shape.tone]}
      style={style}
    />
  );
};

const Frame: React.FunctionComponent<{
  shapes: Shape[];
  marks?: Mark[];
  animated?: boolean;
  height: number;
  label: string;
  testId: string;
}> = ({ shapes, marks = [], animated = false, height, label, testId }) => (
  <Box
    component="svg"
    viewBox={`-2 -2 ${SCENE_SIZE.width + 4} ${height + 4}`}
    role="img"
    aria-label={label}
    data-testid={testId}
    data-animated={animated ? "true" : "false"}
    sx={{
      width: FRAME_WIDTH,
      height: (FRAME_WIDTH * (height + 4)) / (SCENE_SIZE.width + 4),
      display: "block",
      ...KEYFRAMES,
    }}
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
        strokeWidth={2}
      />
    ))}
  </Box>
);

const verdictText = (verdict: Verdict, t: Text): string =>
  verdict.kind === "none"
    ? t("explainer.verdict.none")
    : verdict.kind === "fails"
      ? t("explainer.verdict.fails")
      : t("explainer.verdict.changes", { count: verdict.count });

const VERDICT_COLOR: Record<Verdict["kind"], string> = {
  none: tokens.status.passed.fg,
  changes: tokens.status.changed.fg,
  fails: tokens.status.failed.fg,
};

const Caption: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Typography
    variant="caption"
    color="textSecondary"
    sx={{ display: "block", mb: 0.5, fontWeight: 600 }}
  >
    {children}
  </Typography>
);

/**
 * A "?" beside an option that opens what the option does: a baseline, the
 * current screen, and what Vision makes of them with the option off and on,
 * the project's own state marked (REQ-049-20…28).
 */
export const OptionExplainer: React.FunctionComponent<{
  option: ExplainedOption;
  on: boolean;
}> = ({ option, on }) => {
  const { t } = useT();
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const scene = explainerScene(option);
  const height = sceneHeight(scene);
  const story = t(`explainer.${option}` as MessageKey);
  const animated = !prefersReducedMotion();
  const after = stillFrame(scene, "after");

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
            sx: { p: 2, borderRadius: radius.card, width: 288 },
          } as object,
        }}
      >
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          {story}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <Box>
            <Caption>{t("explainer.reference")}</Caption>
            <Frame
              shapes={stillFrame(scene, "before")}
              height={height}
              label={`${t("explainer.reference")}: ${story}`}
              testId="explainerReference"
            />
          </Box>
          <Box>
            <Caption>{t("explainer.current")}</Caption>
            {/* the change plays out here; with reduced motion it is the still picture (REQ-049-25) */}
            <Frame
              shapes={animated ? scene.shapes : after}
              animated={animated}
              height={height}
              label={`${t("explainer.current")}: ${story}`}
              testId="explainerCurrent"
            />
          </Box>
        </Box>
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{ display: "block", mt: 2, mb: 1 }}
        >
          {t("explainer.whatVisionShows")}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          {(["off", "on"] as const).map((state) => {
            const outcome = scene.outcome[state];
            const now = (state === "on") === on;
            const verdict = verdictText(outcome.verdict, t);
            const title = t(
              state === "on" ? "explainer.optionOn" : "explainer.optionOff",
            );
            return (
              <Box
                key={state}
                data-testid={`explainerResult-${state}`}
                data-now={now ? "true" : "false"}
                sx={{
                  width: 118,
                  p: 0.75,
                  borderRadius: radius.control,
                  border: `1.5px solid ${now ? tokens.brand : "transparent"}`,
                  bgcolor: now ? tokens.brandSoft : "transparent",
                }}
              >
                <Caption>{title}</Caption>
                <Frame
                  shapes={after}
                  marks={outcome.marks}
                  height={height}
                  label={`${title}: ${verdict}`}
                  testId={`explainerResultFrame-${state}`}
                />
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mt: 0.5,
                    fontWeight: 600,
                    color: VERDICT_COLOR[outcome.verdict.kind],
                  }}
                >
                  {verdict}
                </Typography>
                {now && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      color: tokens.brand,
                      fontSize: type.caption,
                    }}
                  >
                    {t("explainer.now")}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
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
