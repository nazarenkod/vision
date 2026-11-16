import React from "react";
import {
  enterKeyframes,
  prefersReducedMotion,
} from "../../_helpers/motion.helper";
import { motion } from "../../theme";

/**
 * Plays the enter of a screen or a tab on the element whenever `key` changes,
 * but not when it first appears (nor when the key first arrives, as a build
 * that has just loaded): lists inside already cascade in (REQ-018-21).
 * Animated in place rather than remounted, so nothing inside loses its state.
 * `direction` is read when the key changes.
 */
export function useEnterOnChange(
  ref: React.RefObject<HTMLElement>,
  key: string | undefined,
  direction: -1 | 0 | 1 = 0,
): void {
  const previous = React.useRef(key);
  React.useLayoutEffect(() => {
    if (previous.current === key) return;
    const first = previous.current === undefined;
    previous.current = key;
    if (first || key === undefined) return;
    const el = ref.current;
    if (!el || typeof el.animate !== "function" || prefersReducedMotion()) {
      return;
    }
    const animation = el.animate(enterKeyframes(direction), {
      duration: motion.nav,
      easing: motion.easing,
    });
    return () => animation.cancel();
    // the direction belongs to the change of key, not a reason to play again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ref]);
}
