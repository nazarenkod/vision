import {
  diffMeter,
  stepStates,
  REVIEW_KEYS,
  stepProgress,
  panelStartsFolded,
} from "./review.helper";

describe("stepProgress", () => {
  it("counts the decided steps and those left besides the current one", () => {
    expect(
      stepProgress(["approved", "unresolved", "new", "unresolved"], 1),
    ).toEqual({ decided: 1, left: 2 });
    // a decided step on screen is counted as decided, not left
    expect(stepProgress(["approved", "failed", "new"], 1)).toEqual({
      decided: 2,
      left: 1,
    });
    expect(stepProgress(["unresolved"], 0)).toEqual({ decided: 0, left: 0 });
  });
});

describe("panelStartsFolded", () => {
  const empty = { regions: [], changes: [], invisible: [] };
  it("folds the panel only when it has nothing to show", () => {
    expect(panelStartsFolded(empty, { violations: [] })).toBe(true);
    expect(panelStartsFolded(null, null)).toBe(true);
    expect(
      panelStartsFolded(
        {
          ...empty,
          regions: [
            {
              region: { x: 0, y: 0, width: 1, height: 1 },
              key: null,
              element: null,
              resourceId: null,
            },
          ],
        },
        null,
      ),
    ).toBe(false);
    expect(
      panelStartsFolded(empty, {
        violations: [{} as never],
      }),
    ).toBe(false);
  });

  it("waits until both the changes and the findings are known", () => {
    expect(panelStartsFolded(undefined, null)).toBeUndefined();
    expect(panelStartsFolded(empty, undefined)).toBeUndefined();
  });
});

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
