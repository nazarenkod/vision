import {
  CompareOnlyProblem,
  ComparedElement,
  ElementRuleAction,
  Rect,
  ScreenRule,
  StructureInfo,
} from "../types/insights";
import { IgnoreArea } from "../types/ignoreArea";
import { english, Text } from "../i18n";
import { groupAreas } from "../components/TestDetailsDialog/changedAreas";

/**
 * Whether compare-only rules shape this comparison. Without a UI tree on
 * either side they cannot (REQ-030-33): the whole screen is compared, so
 * nothing is "only". With one tree they do, at the elements' place (REQ-030-30).
 */
export function compareOnlyApplied(
  compareOnly: StructureInfo["compareOnly"] | null | undefined,
): boolean {
  return (
    !!compareOnly?.active &&
    !compareOnly.problems.some((problem) => problem.kind === "no-tree")
  );
}

/** How many elements a rule found on each screenshot (REQ-015-31). */
export function foundOn(rule: ScreenRule): {
  current: number;
  baseline: number;
} {
  return rule.found
    ? {
        current: rule.found.current.length,
        baseline: rule.found.baseline.length,
      }
    : { current: rule.matches, baseline: rule.matches };
}

// --- what is compared (REQ-030-10…24) ---

/** Where a row of "What's compared" comes from (REQ-030-13). */
export type RowSource =
  "screen" | "project" | "drawn" | "test" | "testSetting" | "projectSetting";

/**
 * Whether a row changes the comparison: it applies, it lies outside the
 * compared elements, it found nothing, or (a compare-only rule without any
 * UI tree) it could not apply.
 */
export type RowEffect = "applies" | "outside" | "nothing-found" | "no-tree";

export interface CompareRow {
  // the mark it lights on the screenshots (REQ-024-24)
  key: string;
  kind: "rule" | "area" | "testArea" | "systemBars";
  action: ElementRuleAction;
  source: RowSource;
  effect: RowEffect;
  // on the checkpoint, for the screen map and for what lies where
  rects: Rect[];
  rule?: ScreenRule;
  area?: IgnoreArea;
  index?: number;
}

export type ComparedState =
  "same" | "changed" | "disappeared" | "appeared" | "resized" | "nothing-found";

/** One element a compare-only rule names, and what applies inside it. */
export interface ComparedRow {
  key: string;
  ruleId: string;
  rule?: ScreenRule;
  element: string;
  bounds?: Rect;
  shiftDp?: ComparedElement["shiftDp"];
  state: ComparedState;
  inside: CompareRow[];
}

export interface Overview {
  // compare-only rules shape what is compared
  only: boolean;
  summary: { kind: "whole" | "except" | "only" | "none"; count: number };
  compared: ComparedRow[];
  ignored: CompareRow[];
  tolerated: CompareRow[];
  // outside the compared elements, rules that found nothing, compare-only without a tree
  outside: CompareRow[];
  keep: Rect[];
}

export const ruleMarkId = (ruleId: string) => `rule:${ruleId}`;
export const areaMarkId = (areaId: string) => `area:${areaId}`;
// the test's areas come without ids: their place in the list names them
export const testAreaMarkId = (index: number) => `testArea:${index}`;
export const SYSTEM_BARS_MARK = "systemBars";

/** Two rects share some area: touching edges do not count. */
export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const hasArea = (rect: Rect) => rect.width > 0 && rect.height > 0;

function ruleRow(rule: ScreenRule): CompareRow {
  const found = rule.found;
  const rects = found
    ? found.current.length
      ? found.current
      : found.baseline
    : [];
  const nothing = found
    ? !found.current.length && !found.baseline.length
    : !rule.matches;
  return {
    key: ruleMarkId(rule.id),
    kind: "rule",
    action: rule.action,
    source: rule.scope,
    effect: nothing ? "nothing-found" : "applies",
    rects,
    rule,
  };
}

/** Which compared element a compare-only problem is about, if any. */
function stateOf(
  element: ComparedElement,
  problems: CompareOnlyProblem[],
  changed: Rect[],
): ComparedState {
  for (const problem of problems) {
    if (
      (problem.kind === "disappeared" ||
        problem.kind === "appeared" ||
        problem.kind === "resized") &&
      problem.ruleId === element.ruleId &&
      problem.element === element.element
    ) {
      return problem.kind;
    }
  }
  return changed.some((rect) => overlaps(rect, element.bounds))
    ? "changed"
    : "same";
}

/**
 * Everything the "What's compared" block shows, from what the server worked
 * out and the areas of the screenshot: the one-line summary, rows by what
 * they do, and which rows change nothing. What lies outside the compared
 * elements is judged by the same rects the comparison left out, so the panel
 * cannot tell a different story from the pixels.
 */
export function overview(
  structure: Pick<
    StructureInfo,
    "rules" | "compareOnly" | "systemBars" | "systemBarsFrom" | "regions"
  >,
  areas: IgnoreArea[],
  testAreas: IgnoreArea[],
): Overview {
  const plan = structure.compareOnly;
  const only = compareOnlyApplied(plan);
  const keep = only ? (plan?.keep ?? []) : [];
  const problems = plan?.problems ?? [];
  const changed = structure.regions.map((item) => item.region);
  const rulesById = new Map(structure.rules.map((rule) => [rule.id, rule]));

  const rows: CompareRow[] = [
    ...structure.rules.filter((rule) => rule.action !== "compare").map(ruleRow),
    ...areas.filter(hasArea).map((area): CompareRow => ({
      key: areaMarkId(area.id),
      kind: "area",
      action: "ignore",
      source: "drawn",
      effect: "applies",
      rects: [area],
      area,
    })),
    ...testAreas.flatMap((area, index): CompareRow[] =>
      hasArea(area)
        ? [
            {
              key: testAreaMarkId(index),
              kind: "testArea",
              action: "ignore",
              source: "test",
              effect: "applies",
              rects: [area],
              area,
              index,
            },
          ]
        : [],
    ),
    ...(structure.systemBars.length
      ? [
          {
            key: SYSTEM_BARS_MARK,
            kind: "systemBars" as const,
            action: "ignore" as const,
            source:
              structure.systemBarsFrom === "test"
                ? ("testSetting" as const)
                : ("projectSetting" as const),
            effect: "applies" as const,
            rects: structure.systemBars,
          },
        ]
      : []),
  ];

  const compared: ComparedRow[] = [];
  if (only) {
    (plan?.compared ?? []).forEach((element, index) =>
      compared.push({
        key: `compared:${index}`,
        ruleId: element.ruleId,
        rule: rulesById.get(element.ruleId),
        element: element.element,
        bounds: element.bounds,
        shiftDp: element.shiftDp,
        state: stateOf(element, problems, changed),
        inside: [],
      }),
    );
    for (const problem of problems) {
      if (problem.kind !== "nothing-found") continue;
      compared.push({
        key: `compared:${problem.ruleId}`,
        ruleId: problem.ruleId,
        rule: rulesById.get(problem.ruleId),
        element: problem.selector,
        state: "nothing-found",
        inside: [],
      });
    }
    // a server that does not name the elements yet: one row per rule
    if (!plan?.compared) {
      for (const rule of structure.rules) {
        if (
          rule.action !== "compare" ||
          compared.some((row) => row.ruleId === rule.id)
        )
          continue;
        compared.push({
          key: ruleMarkId(rule.id),
          ruleId: rule.id,
          rule,
          element: rule.selector,
          state: "same",
          inside: [],
        });
      }
    }
  }

  const ignored: CompareRow[] = [];
  const tolerated: CompareRow[] = [];
  const outside: CompareRow[] = [];
  for (const row of rows) {
    if (row.effect === "nothing-found") {
      outside.push(row);
      continue;
    }
    if (only) {
      const within = compared.find(
        (item) =>
          item.bounds &&
          row.rects.some((rect) => overlaps(rect, item.bounds as Rect)),
      );
      if (within) {
        within.inside.push(row);
      } else if (
        row.rects.some((rect) => keep.some((k) => overlaps(rect, k)))
      ) {
        (row.action === "tolerate" ? tolerated : ignored).push(row);
      } else {
        outside.push({ ...row, effect: "outside" });
      }
      continue;
    }
    (row.action === "tolerate" ? tolerated : ignored).push(row);
  }
  // without any UI tree a compare-only rule names nothing (REQ-030-33)
  if (plan?.active && !only) {
    for (const rule of structure.rules) {
      if (rule.action === "compare")
        outside.push({ ...ruleRow(rule), effect: "no-tree" });
    }
  }

  const elements = compared.filter((row) => row.state !== "nothing-found");
  const places = ignored.reduce(
    (sum, row) => sum + (row.kind === "rule" ? row.rects.length || 1 : 1),
    0,
  );
  const summary: Overview["summary"] = only
    ? elements.length
      ? { kind: "only", count: elements.length }
      : { kind: "none", count: 0 }
    : places
      ? { kind: "except", count: places }
      : { kind: "whole", count: 0 };

  return { only, summary, compared, ignored, tolerated, outside, keep };
}

/** Rows of "What changed": changed spots by element, then changes the UI tree shows (REQ-030-50). */
export function countChanges(
  structure: Pick<StructureInfo, "regions" | "changes">,
): number {
  return (
    groupAreas(structure.regions).length +
    structure.changes.filter((change) => change.kind !== "moved").length
  );
}

// --- what came out (REQ-030-01…04, 32, 33) ---

export interface Verdict {
  tone: "passed" | "changed" | "failed";
  title: string;
  reason: string;
}

/** A problem with the compared elements the pixels cannot settle, worst first. */
const PROBLEM_ORDER: CompareOnlyProblem["kind"][] = [
  "nothing-found",
  "disappeared",
  "appeared",
  "count",
  "resized",
];

/**
 * The heading of the Changes tab: what came out of the comparison and, in one
 * sentence, why. A compare-only problem outranks the count of changes, since
 * it is why the screenshot waits for a person.
 */
export function verdict(
  input: {
    problems: CompareOnlyProblem[];
    changes: number;
    // the comparison produced a diff the panel has no rows for
    hasDiff: boolean;
    only: boolean;
  },
  text: Text = english,
): Verdict {
  const { problems, changes } = input;
  const problem = PROBLEM_ORDER.map((kind) =>
    problems.find((item) => item.kind === kind),
  ).find(Boolean);
  if (problem) {
    switch (problem.kind) {
      case "nothing-found":
        return {
          tone: "failed",
          title: text("verdict.nothingFound"),
          reason: text("verdict.nothingFoundWhy", {
            selector: problem.selector,
          }),
        };
      case "disappeared":
        return {
          tone: "failed",
          title: text("verdict.disappeared"),
          reason: text("verdict.disappearedWhy", { element: problem.element }),
        };
      case "appeared":
        return {
          tone: "failed",
          title: text("verdict.appeared"),
          reason: text("verdict.appearedWhy", { element: problem.element }),
        };
      case "count":
        return {
          tone: "failed",
          title: text("verdict.count"),
          reason: text("compared.problem.count", {
            selector: problem.selector,
            baseline: problem.baseline,
            current: problem.current,
          }),
        };
      case "resized":
        return {
          tone: "failed",
          title: text("verdict.resized"),
          reason: text("verdict.resizedWhy", { element: problem.element }),
        };
    }
  }
  if (problems.some((item) => item.kind === "no-tree")) {
    return {
      tone: "changed",
      title: text("verdict.notApplied"),
      reason: text("verdict.notAppliedWhy"),
    };
  }
  const oneTree = problems.find((item) => item.kind === "one-tree");
  if (oneTree?.kind === "one-tree") {
    const reason = text(
      oneTree.missing === "baseline"
        ? "verdict.noBaselineTree"
        : "verdict.noCurrentTree",
    );
    return changes
      ? {
          tone: "changed",
          title: text("verdict.changes", { count: changes }),
          reason,
        }
      : { tone: "changed", title: text("verdict.decide"), reason };
  }
  if (changes) {
    return {
      tone: "changed",
      title: text("verdict.changes", { count: changes }),
      reason: text("verdict.changesWhy"),
    };
  }
  if (input.hasDiff) {
    return {
      tone: "changed",
      title: text("verdict.changed"),
      reason: text("panel.noDetails"),
    };
  }
  return {
    tone: "passed",
    title: text("verdict.same"),
    reason: text(input.only ? "verdict.sameOnlyWhy" : "verdict.sameWhy"),
  };
}
