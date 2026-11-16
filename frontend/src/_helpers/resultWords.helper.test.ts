import { Outcome } from "../types/buildOverview";
import { outcomeText } from "./resultWords.helper";

const outcome = (over: Partial<Outcome>): Outcome => ({
  total: 0,
  changed: 0,
  new: 0,
  rejected: 0,
  passed: 0,
  ...over,
});

describe("outcomeText", () => {
  it("names only the parts that are there, in the bar's order", () => {
    expect(outcomeText(outcome({ total: 2, new: 1, changed: 1 }))).toBe(
      "1 changed · 1 new",
    );
  });

  it("says passed for screens that did not change", () => {
    expect(outcomeText(outcome({ total: 2, passed: 2 }))).toBe("2 passed");
  });

  it("says nothing for an empty result", () => {
    expect(outcomeText(outcome({}))).toBe("");
  });
});
