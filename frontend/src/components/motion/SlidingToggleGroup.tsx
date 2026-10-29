import React from "react";
import { ToggleButtonGroup, ToggleButtonGroupProps } from "@mui/material";
import { motion } from "../../theme";

type Highlight = { x: number; width: number; radius: string };

// where each remembered switch last stood, so a new instance of it (a view
// that renders the switch in another place) slides on from there
const lastHighlight = new Map<string, Highlight>();

/**
 * MUI's ToggleButtonGroup whose highlight travels to the chosen segment
 * instead of jumping (REQ-018-22). The highlight is the group's `::before`,
 * in the colour MUI gives a selected button, so it looks the same at rest.
 * `rememberAs` names a switch whose change remounts it.
 */
export const SlidingToggleGroup = React.forwardRef<
  HTMLDivElement,
  ToggleButtonGroupProps & { rememberAs?: string }
>(function SlidingToggleGroup({ sx, style, rememberAs, ...props }, ref) {
  const groupRef = React.useRef<HTMLDivElement | null>(null);
  const [highlight, setHighlight] = React.useState<Highlight | null>(null);
  // the first measurement places the highlight; only later ones slide it
  const [placed, setPlaced] = React.useState(false);
  // where the highlight goes once placed at the remembered spot
  const pending = React.useRef<Highlight | null>(null);
  const placedRef = React.useRef(placed);
  placedRef.current = placed;

  const measure = React.useCallback(() => {
    const selected =
      groupRef.current?.querySelector<HTMLElement>(".Mui-selected");
    const next = selected
      ? {
          x: selected.offsetLeft,
          width: selected.offsetWidth,
          radius: getComputedStyle(selected).borderRadius,
        }
      : null;
    if (pending.current) {
      pending.current = next;
      return;
    }
    const before = rememberAs ? lastHighlight.get(rememberAs) : undefined;
    if (rememberAs && next) lastHighlight.set(rememberAs, next);
    if (!placedRef.current && before && next && before.x !== next.x) {
      pending.current = next;
      setHighlight(before);
      return;
    }
    setHighlight(next);
  }, [rememberAs]);
  React.useLayoutEffect(measure, [measure, props.value]);
  React.useEffect(() => {
    if (highlight && !placed) {
      const frame = requestAnimationFrame(() => {
        // the remembered spot has to be styled before the move, or there is
        // nothing to transition from
        if (groupRef.current) {
          void getComputedStyle(groupRef.current, "::before").transform;
        }
        setPlaced(true);
        if (pending.current) {
          setHighlight(pending.current);
          pending.current = null;
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [highlight, placed]);
  // a web font arriving or a label changing moves the segments
  React.useEffect(() => {
    const group = groupRef.current;
    if (!group || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <ToggleButtonGroup
      ref={(node: HTMLDivElement | null) => {
        groupRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      {...props}
      style={
        {
          ...style,
          ...(highlight && {
            "--v-segment-x": `${highlight.x}px`,
            "--v-segment-w": `${highlight.width}px`,
            "--v-segment-r": highlight.radius,
          }),
        } as React.CSSProperties
      }
      sx={[
        (theme) => ({
          position: "relative",
          isolation: "isolate",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: -1,
            pointerEvents: "none",
            width: "var(--v-segment-w, 0px)",
            transform: "translateX(var(--v-segment-x, 0px))",
            borderRadius: "var(--v-segment-r, 0px)",
            backgroundColor: theme.palette.action.selected,
            opacity: highlight ? 1 : 0,
            transition: placed
              ? ["transform", "width", "border-radius"]
                  .map((prop) => `${prop} ${motion.nav}ms ${motion.easing}`)
                  .join(", ")
              : "none",
          },
          "& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover":
            { backgroundColor: "transparent" },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
});
