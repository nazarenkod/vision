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
