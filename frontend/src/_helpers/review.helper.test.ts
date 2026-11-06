import { REVIEW_KEYS, panelStartsFolded } from "./review.helper";

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
  it("shows the keys the review already has", () => {
    expect(REVIEW_KEYS).toEqual({ approve: "A", reject: "X" });
  });
});
