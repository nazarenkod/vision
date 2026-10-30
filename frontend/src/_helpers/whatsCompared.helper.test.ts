import {
  compareOnlyApplied,
  countChanges,
  foundOn,
  overview,
  verdict,
} from "./whatsCompared.helper";
import {
  CompareOnlyProblem,
  ComparedElement,
  Rect,
  ScreenRule,
  StructureInfo,
} from "../types/insights";
import { IgnoreArea } from "../types/ignoreArea";

const rect = (x: number, y: number, width = 100, height = 50): Rect => ({
  x,
  y,
  width,
  height,
});
const rule = (
  id: string,
  action: ScreenRule["action"],
  current: Rect[],
  baseline = current,
  scope: ScreenRule["scope"] = "screen",
): ScreenRule => ({
  id,
  selector: `id:${id}`,
  action,
  scope,
  matches: Math.max(current.length, baseline.length),
  found: { current, baseline },
  ...(action === "tolerate" ? { maxDiffPercent: 5 } : {}),
});
const area = (id: string, r: Rect): IgnoreArea => ({ id, ...r });

type Input = Parameters<typeof overview>[0];
const structure = (fields: Partial<Input> = {}): Input => ({
  rules: [],
  systemBars: [],
  systemBarsFrom: null,
  regions: [],
  ...fields,
});
const pay = rect(40, 2200, 1000, 120);
const plan = (
  problems: CompareOnlyProblem[] = [],
  compared: ComparedElement[] = [
    { ruleId: "pay", element: 'Button "Pay"', bounds: pay },
  ],
): StructureInfo["compareOnly"] => ({
  active: true,
  keep: compared.map((element) => element.bounds),
  problems,
  compared,
});

describe("what came out", () => {
  const base = { problems: [], changes: 0, hasDiff: false, only: false };

  it("says what came out and why", () => {
    const result = verdict(base);
    expect(result.title).toBeTruthy();
    expect(result.reason).toBeTruthy();
    expect(result.reason).not.toBe(result.title);
  });

  it("says nothing changed when the compared part matches", () => {
    expect(verdict(base)).toEqual({
      tone: "passed",
      title: "No changes",
      reason: "Everything that is compared matches the baseline.",
    });
    expect(verdict({ ...base, only: true }).reason).toBe(
      "The chosen elements are the same as on the baseline.",
    );
  });

  it("counts the changes the list shows", () => {
    const changed = structure({
      regions: [
        // two spots in one element are one row
        {
          region: rect(0, 0),
          key: "a",
          element: 'Button "Next"',
          resourceId: null,
        },
        {
          region: rect(0, 60),
          key: "a",
          element: 'Button "Next"',
          resourceId: null,
        },
        { region: rect(0, 900), key: null, element: null, resourceId: null },
      ],
    });
    const changes = countChanges({
      regions: changed.regions,
      changes: [
        {
          kind: "text",
          key: "b",
          element: "TextView",
          before: "1",
          after: "2",
        },
        { kind: "moved", key: "c", element: "Card" },
      ] as never,
    });
    expect(changes).toBe(3);
    expect(verdict({ ...base, changes }).title).toBe("3 changes");
    // a diff without rows still is not "No changes"
    expect(verdict({ ...base, hasDiff: true }).title).toBe("Changed");
  });

  it("puts a compare-only problem in the heading", () => {
    const gone: CompareOnlyProblem = {
      kind: "disappeared",
      ruleId: "card",
      selector: "id:card",
      element: 'Card "Visa"',
    };
    expect(verdict({ ...base, problems: [gone], changes: 2 })).toEqual({
      tone: "failed",
      title: "One of the chosen elements is gone",
      reason:
        'Card "Visa" is not on the screenshot, so there is nothing to compare it with.',
    });
    // a rule that found nothing outranks the rest
    expect(
      verdict({
        ...base,
        problems: [
          gone,
          { kind: "nothing-found", ruleId: "t", selector: "id:typo" },
        ],
      }).title,
    ).toBe("Nothing is compared");
    expect(verdict({ ...base, problems: [{ kind: "no-tree" }] }).title).toBe(
      "Compare only did not apply",
    );
  });

  it("explains which side has no tree and what accepting does", () => {
    const noBaseline = verdict({
      ...base,
      only: true,
      problems: [{ kind: "one-tree", missing: "baseline" }],
    });
    expect(noBaseline.title).toBe(
      "No changes found, but it needs your decision",
    );
    expect(noBaseline.reason).toMatch(/baseline has no UI tree/);
    expect(
      verdict({
        ...base,
        changes: 1,
        problems: [{ kind: "one-tree", missing: "current" }],
      }),
    ).toEqual(
      expect.objectContaining({
        title: "1 change",
        reason: expect.stringMatching(/screenshot came without a UI tree/),
      }),
    );
  });
});

describe("what is compared", () => {
  it("sums up what is compared in places", () => {
    expect(overview(structure(), [], []).summary).toEqual({
      kind: "whole",
      count: 0,
    });
    const except = overview(
      structure({
        rules: [
          rule("clock", "ignore", [rect(0, 100)]),
          rule("rows", "ignore", [rect(0, 300), rect(0, 400)]),
          rule("map", "tolerate", [rect(0, 600)]),
        ],
        systemBars: [rect(0, 0, 1080, 60)],
        systemBarsFrom: "project",
      }),
      [area("a1", rect(0, 900))],
      [],
    );
    // two rows of one rule, the clock, one area and the system bars
    expect(except.summary).toEqual({ kind: "except", count: 5 });
    expect(
      overview(structure({ compareOnly: plan() }), [], []).summary,
    ).toEqual({ kind: "only", count: 1 });
    expect(
      overview(
        structure({
          compareOnly: plan(
            [{ kind: "nothing-found", ruleId: "pay", selector: "id:pay" }],
            [],
          ),
        }),
        [],
        [],
      ).summary,
    ).toEqual({ kind: "none", count: 0 });
  });

  it("groups rows by what they do", () => {
    const result = overview(
      structure({
        rules: [
          rule("clock", "ignore", [rect(0, 100)]),
          rule("map", "tolerate", [rect(0, 600)]),
        ],
      }),
      [area("a1", rect(0, 900))],
      [area("t", rect(0, 1200))],
    );
    expect(result.ignored.map((row) => row.key)).toEqual([
      "rule:clock",
      "area:a1",
      "testArea:0",
    ]);
    expect(result.tolerated.map((row) => row.key)).toEqual(["rule:map"]);
    expect(result.compared).toEqual([]);
    expect(result.outside).toEqual([]);
  });

  it("names where each row comes from", () => {
    const result = overview(
      structure({
        rules: [
          rule("banner", "ignore", [rect(0, 100)]),
          rule("clock", "ignore", [rect(0, 200)], undefined, "project"),
        ],
        systemBars: [rect(0, 0, 1080, 60)],
        systemBarsFrom: "test",
      }),
      [area("a1", rect(0, 900))],
      [area("t", rect(0, 1200))],
    );
    expect(result.ignored.map((row) => row.source)).toEqual([
      "screen",
      "project",
      "drawn",
      "test",
      "testSetting",
    ]);
  });

  it("lists the system bars as an ignored row", () => {
    const result = overview(
      structure({
        systemBars: [rect(0, 0, 1080, 60), rect(0, 2300, 1080, 100)],
        systemBarsFrom: "project",
      }),
      [],
      [],
    );
    expect(result.ignored).toEqual([
      expect.objectContaining({
        kind: "systemBars",
        source: "projectSetting",
        rects: [rect(0, 0, 1080, 60), rect(0, 2300, 1080, 100)],
      }),
    ]);
    // one place, however many bars
    expect(result.summary).toEqual({ kind: "except", count: 1 });
  });

  it("puts what applies inside a compared element under it", () => {
    const result = overview(
      structure({
        compareOnly: plan(),
        rules: [
          rule("pay", "compare", [pay]),
          rule("timer", "ignore", [rect(900, 2230, 80, 40)]),
        ],
      }),
      // half over the button: it still applies there
      [area("a1", rect(0, 2150, 300, 100))],
      [],
    );
    expect(result.compared).toHaveLength(1);
    expect(result.compared[0].inside.map((row) => row.key)).toEqual([
      "rule:timer",
      "area:a1",
    ]);
    expect(result.ignored).toEqual([]);
    expect(result.outside).toEqual([]);
  });

  it("folds away what lies outside the compared elements", () => {
    const result = overview(
      structure({
        compareOnly: plan(),
        rules: [
          rule("pay", "compare", [pay]),
          rule("banner", "ignore", [rect(0, 100, 1080, 300)]),
          rule("map", "tolerate", [rect(0, 600)]),
        ],
        systemBars: [rect(0, 0, 1080, 60)],
        systemBarsFrom: "project",
      }),
      [area("a1", rect(0, 0, 1440, 2000))],
      [area("t", rect(0, 2400, 1080, 91))],
    );
    expect(result.outside.map((row) => [row.key, row.effect])).toEqual([
      ["rule:banner", "outside"],
      ["rule:map", "outside"],
      ["area:a1", "outside"],
      ["testArea:0", "outside"],
      ["systemBars", "outside"],
    ]);
    expect(result.summary).toEqual({ kind: "only", count: 1 });
    expect(result.compared[0].inside).toEqual([]);
  });

  it("folds away rules that found nothing", () => {
    const result = overview(
      structure({ rules: [rule("typo", "ignore", [], [], "project")] }),
      [],
      [],
    );
    expect(result.outside).toEqual([
      expect.objectContaining({ key: "rule:typo", effect: "nothing-found" }),
    ]);
    expect(result.summary.kind).toBe("whole");
  });

  it("tells which compared elements are gone, new or unchanged", () => {
    const card = rect(40, 600, 1000, 300);
    const result = overview(
      structure({
        compareOnly: plan(
          [
            {
              kind: "disappeared",
              ruleId: "card",
              selector: "id:card",
              element: 'Card "Visa"',
            },
            { kind: "nothing-found", ruleId: "typo", selector: "id:typo" },
          ],
          [
            { ruleId: "card", element: 'Card "Visa"', bounds: card },
            {
              ruleId: "pay",
              element: 'Button "Pay"',
              bounds: pay,
              shiftDp: { dx: 0, dy: 24 },
            },
            {
              ruleId: "next",
              element: 'Button "Next"',
              bounds: rect(40, 1800),
            },
          ],
        ),
        regions: [
          {
            region: rect(60, 1810, 20, 20),
            key: null,
            element: null,
            resourceId: null,
          },
        ],
      }),
      [],
      [],
    );
    expect(result.compared.map((row) => [row.element, row.state])).toEqual([
      ['Card "Visa"', "disappeared"],
      ['Button "Pay"', "same"],
      ['Button "Next"', "changed"],
      ["id:typo", "nothing-found"],
    ]);
    expect(result.compared[1].shiftDp).toEqual({ dx: 0, dy: 24 });
  });

  it("shows how many elements each rule found on each screenshot", () => {
    expect(
      foundOn(
        rule(
          "rows",
          "compare",
          [rect(0, 0), rect(0, 60)],
          [rect(0, 0), rect(0, 60), rect(0, 120)],
        ),
      ),
    ).toEqual({ current: 2, baseline: 3 });
  });

  it("says the whole screen is compared when neither side has a tree", () => {
    const compareOnly = plan([{ kind: "no-tree" }], []);
    expect(compareOnlyApplied(compareOnly)).toBe(false);
    const result = overview(
      structure({ compareOnly, rules: [rule("pay", "compare", [])] }),
      [area("a1", rect(0, 0))],
      [],
    );
    expect(result.summary).toEqual({ kind: "except", count: 1 });
    expect(result.outside).toEqual([
      expect.objectContaining({ key: "rule:pay", effect: "no-tree" }),
    ]);
    // with one tree the rule applies at the element's place
    expect(
      compareOnlyApplied(plan([{ kind: "one-tree", missing: "baseline" }])),
    ).toBe(true);
  });
});
