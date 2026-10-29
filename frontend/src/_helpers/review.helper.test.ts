import { diffMeter, stepStates, REVIEW_KEYS } from "./review.helper";

describe("review", () => {
  it("puts the tolerance mark and the diff on one scale", () => {
    const over = diffMeter(4.87, 1.5);
    expect(over.over).toBe(true);
    expect(over.fill).toBeGreaterThan(over.mark);
    // both are shares of the same bar
    expect(over.fill / over.mark).toBeCloseTo(4.87 / 1.5, 5);

    const under = diffMeter(0.4, 1.5);
    expect(under.over).toBe(false);
    expect(under.mark).toBe(50);
    expect(under.fill).toBeCloseTo((0.4 / 3) * 100, 5);

    // nothing reaches past the end of the bar
    expect(diffMeter(80, 1).fill).toBeLessThanOrEqual(100);
    expect(diffMeter(0, 0)).toEqual({ fill: 0, mark: 0, over: false });
  });

  it("marks each step as current, approved, rejected or waiting", () => {
    expect(
      stepStates(
        ["approved", "failed", "unresolved", "new", "autoApproved"],
        2,
      ),
    ).toEqual(["approved", "rejected", "current", "waiting", "approved"]);
    expect(stepStates(["approved"], 0)).toEqual(["current"]);
  });

  it("shows the keys the review already has", () => {
    expect(REVIEW_KEYS).toEqual({ approve: "A", reject: "X" });
  });
});
