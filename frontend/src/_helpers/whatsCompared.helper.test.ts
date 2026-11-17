import {
  bugStandsOut,
  changeMark,
  compareOnlyApplied,
  CompareRow,
  countChanges,
  foundOn,
  ignoreZoneGroups,
  mostOfScreen,
  overview,
  showVerdict,
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

  it("says nothing changed without a sentence that repeats it", () => {
    expect(verdict(base)).toEqual({
      tone: "passed",
      title: "No changes",
      reason: "",
    });
    expect(verdict({ ...base, only: true }).reason).toBe("");
  });

  it("gives the count alone when there are changes", () => {
    expect(verdict({ ...base, changes: 9 })).toEqual({
      tone: "changed",
      title: "9 changes",
      reason: "",
    });
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
        'Card "Visa" is not on the current screenshot, so there is nothing to compare it with.',
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
        reason: expect.stringMatching(
          /current screenshot came without a UI tree/,
        ),
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

  it("says the whole screenshot is compared when neither side has a tree", () => {
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

describe("variable text (spec 033)", () => {
  const updated = rect(40, 400, 300, 40);
  const dates = [rect(80, 600), rect(80, 700), rect(80, 800)];
  const variable = (
    id: string,
    current: Rect[],
    check?: ScreenRule["check"],
  ) => ({
    ...rule(id, "variable", current),
    parts: [
      { text: "Updated at " },
      { pattern: "\\d+:\\d{2}", sample: "14:07" },
    ],
    ...(check ? { check } : {}),
  });

  it("puts variable-text rules in their own group", () => {
    const result = overview(
      structure({
        rules: [
          variable("updated", [updated]),
          rule("clock", "ignore", [rect(0, 0)]),
          {
            ...variable("taken", [rect(0, 900)]),
            check: { items: [], gone: false, overridden: true },
          },
        ],
      }),
      [],
      [],
    );
    expect(result.variable.map((row) => row.key)).toEqual(["rule:updated"]);
    expect(result.ignored.map((row) => row.key)).toEqual(["rule:clock"]);
    // an ignore rule takes the element: the variable-text rule has no effect (REQ-033-22)
    expect(result.outside).toEqual([
      expect.objectContaining({ key: "rule:taken", effect: "overridden" }),
    ]);
  });

  it("counts each variable-text element as one place", () => {
    const result = overview(
      structure({
        rules: [variable("dates", dates), variable("updated", [updated])],
      }),
      [],
      [],
    );
    expect(result.summary).toEqual({ kind: "except", count: 4 });
  });

  it("maps what a variable-text rule leaves out", () => {
    const button = rect(40, 400, 300, 80);
    const text = rect(120, 410, 180, 40);
    const result = overview(
      structure({
        rules: [
          {
            ...variable("history", [button]),
            leftOut: [
              { side: "current", element: button, areas: [text] },
              { side: "baseline", element: button, areas: [text] },
            ],
          },
        ],
      }),
      [],
      [],
    );
    expect(result.variable[0]).toMatchObject({
      rects: [button],
      leftOut: [text],
    });
    // still one place: the element, not each of its text parts (REQ-066-07)
    expect(result.summary).toEqual({ kind: "except", count: 1 });
  });

  it("maps the found pieces of a merged element", () => {
    const row = rect(40, 400, 1000, 270);
    const sum = rect(880, 420, 100, 40);
    const time = rect(400, 480, 80, 30);
    const result = overview(
      structure({
        rules: [
          {
            ...variable("history", [row]),
            leftOut: [
              {
                side: "current",
                element: row,
                areas: [sum, time],
                located: true,
              },
              {
                side: "baseline",
                element: row,
                areas: [sum, time],
                located: true,
              },
            ],
          },
        ],
      }),
      [],
      [],
    );
    expect(result.variable[0]).toMatchObject({
      rects: [row],
      leftOut: [sum, time],
    });
    expect(result.summary).toEqual({ kind: "except", count: 1 });
  });

  it("says that the variable text changed shape in one line", () => {
    const failed = {
      ruleId: "updated",
      kind: "failed" as const,
      element: "TextView «Updated at undefined»",
      text: "Updated at undefined",
      reason: "pattern" as const,
      bounds: updated,
    };
    const base = { problems: [], changes: 3, hasDiff: true, only: false };
    // first, before the changes, and without the sentence that repeats the row (REQ-074-13)
    expect(verdict({ ...base, variableProblems: [failed] })).toEqual({
      tone: "failed",
      title: "The variable text changed shape",
      reason: "",
    });
    expect(
      verdict({ ...base, variableProblems: [{ ...failed, reason: "text" }] })
        .title,
    ).toBe("The variable text changed shape");
    expect(
      verdict({
        ...base,
        variableProblems: [
          {
            ruleId: "updated",
            kind: "gone",
            element: "id:tv_updated",
            bounds: updated,
          },
        ],
      }),
    ).toEqual({ tone: "failed", title: "The element is gone", reason: "" });
  });
});

describe("what the Changes tab shows (spec 074)", () => {
  const base = { problems: [], changes: 0, hasDiff: false, only: false };

  it("hides the verdict when it only repeats the status", () => {
    expect(showVerdict(verdict(base))).toBe(false);
    expect(showVerdict(verdict({ ...base, changes: 4 }))).toBe(false);
    // a diff without rows, a problem or a missing tree still say something
    expect(showVerdict(verdict({ ...base, hasDiff: true }))).toBe(true);
    expect(
      showVerdict(
        verdict({
          ...base,
          problems: [
            {
              kind: "disappeared",
              ruleId: "card",
              selector: "id:card",
              element: "Card",
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      showVerdict(verdict({ ...base, problems: [{ kind: "no-tree" }] })),
    ).toBe(true);
  });

  it("marks a change by how it was seen", () => {
    const invisible = new Set(["text:b"]);
    expect(changeMark({ key: "text:b", element: "TextView" }, invisible)).toBe(
      "invisible",
    );
    expect(changeMark({ key: "a", element: 'Button "Pay"' }, invisible)).toBe(
      "visible",
    );
    expect(changeMark({ key: "loose", element: null }, invisible)).toBe(
      "loose",
    );
  });

  it("groups ignore zones by where they come from", () => {
    const row = (key: string, source: CompareRow["source"]): CompareRow => ({
      key,
      kind: "area",
      action: "ignore",
      source,
      effect: "applies",
      rects: [],
    });
    const groups = ignoreZoneGroups([
      row("bars", "projectSetting"),
      row("drawn", "drawn"),
      row("sent", "test"),
      row("rule", "screen"),
      row("everywhere", "project"),
      row("setting", "testSetting"),
    ]);
    expect(
      groups.map((item) => [item.group, item.rows.map((r) => r.key)]),
    ).toEqual([
      ["test", ["sent", "setting"]],
      ["project", ["bars", "everywhere"]],
      ["manual", ["drawn", "rule"]],
    ]);
    // a group with nothing in it is not shown
    expect(ignoreZoneGroups([row("sent", "test")])).toHaveLength(1);
  });

  it("calls more than a quarter of the screen most of the screen", () => {
    expect(mostOfScreen(47.2, 38)).toBe(true);
    expect(mostOfScreen(25, 38)).toBe(false);
    expect(mostOfScreen(null, 3)).toBe(false);
    // everything in ignore zones: no list to replace
    expect(mostOfScreen(60, 0)).toBe(false);
  });

  it("makes the bug button stand out when a rule failed or most of the screen changed", () => {
    expect(bugStandsOut({ failed: true, diffPercent: 0, changes: 0 })).toBe(
      true,
    );
    expect(bugStandsOut({ failed: false, diffPercent: 40, changes: 5 })).toBe(
      true,
    );
    expect(bugStandsOut({ failed: false, diffPercent: 3, changes: 5 })).toBe(
      false,
    );
  });
});
