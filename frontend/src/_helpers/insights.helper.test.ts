import { barShare, largest } from "./insights.helper";

describe("insights bars", () => {
  it("sizes each bar against the largest value of its table", () => {
    const flips = [6, 4, 2];
    const max = largest(flips);
    expect(flips.map((value) => barShare(value, max))).toEqual([100, 66.7, 33.3]);
    expect(barShare(0, max)).toBe(0);
    expect(barShare(3, 0)).toBe(0);
    expect(barShare(9, 6)).toBe(100);
    expect(largest([])).toBe(0);
  });
});
