import {
  compareOnlyApplied,
  foundOn,
  groupRules,
  summarize,
} from "./whatsCompared.helper";
import { ScreenRule } from "../types/insights";

const box = { x: 0, y: 0, width: 10, height: 10 };
const rule = (
  id: string,
  action: ScreenRule["action"],
  current: number,
  baseline = current,
): ScreenRule => ({
  id,
  selector: `id:${id}`,
  action,
  scope: "screen",
  matches: Math.max(current, baseline),
  found: {
    current: Array(current).fill(box),
    baseline: Array(baseline).fill(box),
  },
});

describe("whatsCompared", () => {
  it("sums up what is compared", () => {
    expect(summarize({ rules: [] }, 0)).toEqual({
      kind: "whole",
      elements: 0,
      areas: 0,
    });
    expect(
      summarize(
        {
          rules: [
            rule("clock", "ignore", 1),
            rule("rows", "ignore", 2),
            rule("avatar", "tolerate", 1),
          ],
        },
        1,
      ),
    ).toEqual({ kind: "except", elements: 3, areas: 1 });
    // a rule that found nothing changes nothing
    expect(summarize({ rules: [rule("typo", "ignore", 0)] }, 0).kind).toBe(
      "whole",
    );
    expect(
      summarize(
        {
          rules: [rule("pay", "compare", 1)],
          compareOnly: { active: true, keep: [box], problems: [] },
        },
        0,
      ),
    ).toEqual({ kind: "only", elements: 1, areas: 0 });
  });

  it("groups rules by what they do", () => {
    const groups = groupRules([
      rule("clock", "ignore", 1),
      rule("avatar", "tolerate", 1),
      rule("pay", "compare", 1),
      rule("banner", "ignore", 1),
    ]);
    expect(groups.map((group) => group.action)).toEqual([
      "compare",
      "ignore",
      "tolerate",
    ]);
    expect(groups[1].rules.map((r) => r.id)).toEqual(["clock", "banner"]);
  });

  it("shows how many elements each rule found on each screenshot", () => {
    expect(foundOn(rule("rows", "compare", 2, 3))).toEqual({
      current: 2,
      baseline: 3,
    });
    // from a server that does not tell the sides apart
    expect(
      foundOn({ ...rule("x", "ignore", 0), found: undefined, matches: 4 }),
    ).toEqual({
      current: 4,
      baseline: 4,
    });
  });
});

describe("compareOnlyApplied", () => {
  const plan = (
    problems: Array<
      | { kind: "no-tree" }
      | { kind: "nothing-found"; ruleId: string; selector: string }
    >,
  ) => ({
    active: true,
    keep: [],
    problems,
  });

  it("says the whole screen is compared when there is no UI tree", () => {
    const compareOnly = plan([{ kind: "no-tree" }]);
    expect(compareOnlyApplied(compareOnly)).toBe(false);
    // not "Only 0 elements": the rule could not apply at all
    expect(summarize({ rules: [], compareOnly }, 7)).toEqual({
      kind: "whole",
      elements: 0,
      areas: 7,
    });
  });

  it("keeps Only 0 elements when the tree is there and nothing matched", () => {
    const compareOnly = plan([
      { kind: "nothing-found", ruleId: "a", selector: "id:a" },
    ]);
    expect(compareOnlyApplied(compareOnly)).toBe(true);
    expect(summarize({ rules: [], compareOnly }, 0).kind).toBe("only");
  });
});
