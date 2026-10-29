import React from "react";
import { Grow } from "@mui/material";
import type { TransitionProps } from "@mui/material/transitions";
import { motion } from "../../theme";

// Where the last click or tap landed, and when: a dialog opened by it grows
// out of that point (REQ-018-24). Opened by the keyboard, it grows from the
// middle of the screen.
let lastPointer: { x: number; y: number; at: number } | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (event) => {
      lastPointer = { x: event.clientX, y: event.clientY, at: Date.now() };
    },
    true,
  );
}
const RECENT_MS = 1500;

export const pointerOrigin = (now = Date.now()): string =>
  lastPointer && now - lastPointer.at < RECENT_MS
    ? `${lastPointer.x}px ${lastPointer.y}px`
    : "50% 50%";

/** MUI's Grow, from where the user clicked. */
export const GrowFromPointer = React.forwardRef(function GrowFromPointer(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  const origin = React.useMemo(() => pointerOrigin(), []);
  return (
    <Grow
      ref={ref}
      {...props}
      timeout={motion.slow}
      style={{ transformOrigin: origin, ...props.style }}
    />
  );
});
