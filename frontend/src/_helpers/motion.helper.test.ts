import { motion } from "../theme";
import { cascadeEndsAt, countUp, staggerDelay } from "./motion.helper";

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
      expect(cascadeEndsAt(500, visible)).toBeLessThanOrEqual(motion.cascadeEnd);
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
});
