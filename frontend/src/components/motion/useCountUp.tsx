import React from "react";
import { countUp, prefersReducedMotion } from "../../_helpers/motion.helper";

/**
 * A number that runs up to `target` when it first appears or changes
 * (REQ-018-23); with reduced motion it is simply the number.
 */
export function useCountUp(target: number): number {
  const [shown, setShown] = React.useState(() =>
    prefersReducedMotion() ? target : 0,
  );
  React.useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame === "undefined") {
      setShown(target);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const value = countUp(target, now - started);
      setShown(value);
      if (value !== target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

export const CountUp: React.FunctionComponent<{ value: number }> = ({
  value,
}) => <>{useCountUp(value).toLocaleString("en-US")}</>;
