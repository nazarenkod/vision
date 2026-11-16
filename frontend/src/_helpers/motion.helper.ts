import { motion } from "../theme";

export function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

/**
 * Delay of the i-th row of a cascade. Long lists squeeze the step so the last
 * visible row is still in place by `motion.cascadeEnd`.
 */
export function staggerDelay(index: number, visibleRows = 12): number {
  const last = Math.max(1, visibleRows - 1);
  const step = Math.min(
    motion.stagger,
    (motion.cascadeEnd - motion.base) / last,
  );
  return Math.round(Math.min(index, last) * step);
}

/** When the i-th row of a cascade is fully in place. */
export const cascadeEndsAt = (index: number, visibleRows = 12): number =>
  staggerDelay(index, visibleRows) + motion.base;

/** The number a counter shows `elapsed` ms after it started towards `target`. */
export function countUp(target: number, elapsed: number): number {
  if (elapsed >= motion.fill) return target;
  const t = Math.max(0, elapsed) / motion.fill;
  // the same fast start and soft stop as every other move
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.round(target * eased);
}

/**
 * Which way new content enters when the user moves along a row of places
 * (tabs, steps): from the right going forward, from the left going back, and
 * straight up when it is not a move along the row at all.
 */
export function enterDirection<T>(
  order: readonly T[],
  from: T | undefined,
  to: T,
): -1 | 0 | 1 {
  const a = from === undefined ? -1 : order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0 || a === b) return 0;
  return b > a ? 1 : -1;
}

/**
 * How a screen or a tab's content comes in: it fades in while settling a few
 * pixels into place, sideways when it follows a tab, upwards otherwise. No
 * blur and nothing left behind once it ends: screenshots in it hold still
 * (REQ-018-25).
 */
export function enterKeyframes(direction: -1 | 0 | 1): Keyframe[] {
  const from =
    direction === 0 ? "translateY(8px)" : `translateX(${direction * 24}px)`;
  return [
    { opacity: 0, transform: from },
    { opacity: 1, transform: "none" },
  ];
}
