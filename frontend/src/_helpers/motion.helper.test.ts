import { motion } from "../theme";
import {
  cascadeEndsAt,
  countUp,
  enterDirection,
  enterKeyframes,
  staggerDelay,
} from "./motion.helper";

describe("motion", () => {
  it("staggers rows by 34 ms and ends the cascade by 700 ms", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(34);
    expect(staggerDelay(3)).toBe(102);
    // a long list squeezes the step instead of running late
    for (const visible of [5, 12, 30, 100]) {
      expect(cascadeEndsAt(visible - 1, visible)).toBeLessThanOrEqual(
        motion.cascadeEnd,
      );
      expect(cascadeEndsAt(500, visible)).toBeLessThanOrEqual(
        motion.cascadeEnd,
      );
    }
  });

  it("counts up to the value in 600 ms", () => {
    expect(countUp(47, 0)).toBe(0);
    expect(countUp(47, 300)).toBeGreaterThan(23);
    expect(countUp(47, 300)).toBeLessThan(47);
    expect(countUp(47, 599)).toBeLessThanOrEqual(47);
    expect(countUp(47, 600)).toBe(47);
    expect(countUp(47, 10_000)).toBe(47);
  });

  it("brings a tab's content in from the side the user moved towards", () => {
    const tabs = ["overview", "changes", "all", "a11y"];
    expect(enterDirection(tabs, "overview", "all")).toBe(1);
    expect(enterDirection(tabs, "a11y", "changes")).toBe(-1);
    expect(enterDirection(tabs, "all", "all")).toBe(0);
    expect(enterDirection(tabs, undefined, "all")).toBe(0);
    expect(enterDirection(tabs, "overview", "elsewhere")).toBe(0);
  });

  it("enters by settling into place and leaves nothing behind", () => {
    expect(enterKeyframes(1)[0]).toEqual({
      opacity: 0,
      transform: "translateX(24px)",
    });
    expect(enterKeyframes(-1)[0].transform).toBe("translateX(-24px)");
    expect(enterKeyframes(0)[0].transform).toBe("translateY(8px)");
    for (const direction of [-1, 0, 1] as const) {
      const frames = enterKeyframes(direction);
      expect(frames[frames.length - 1]).toEqual({
        opacity: 1,
        transform: "none",
      });
      expect(JSON.stringify(frames)).not.toMatch(/blur/);
    }
  });
});
