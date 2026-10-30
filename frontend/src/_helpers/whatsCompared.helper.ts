import {
  ElementRuleAction,
  ScreenRule,
  StructureInfo,
} from "../types/insights";

/**
 * What a screenshot is compared on, in one line (REQ-024-22): the whole
 * screen, the whole screen except some elements, or only some elements.
 * Rules that found nothing on the screenshot change nothing here.
 */
export interface Summary {
  kind: "whole" | "except" | "only";
  elements: number;
  areas: number;
}

/**
 * Whether compare-only rules shape this comparison. Without a UI tree they
 * cannot (REQ-015-22): the whole screen is compared, so nothing is "only".
 */
export function compareOnlyApplied(
  compareOnly: StructureInfo["compareOnly"] | null | undefined,
): boolean {
  return (
    !!compareOnly?.active &&
    !compareOnly.problems.some((problem) => problem.kind === "no-tree")
  );
}

export function summarize(
  structure: Pick<StructureInfo, "rules" | "compareOnly"> | null | undefined,
  areas: number,
): Summary {
  if (structure?.compareOnly && compareOnlyApplied(structure.compareOnly)) {
    return { kind: "only", elements: structure.compareOnly.keep.length, areas };
  }
  const ignored = (structure?.rules ?? [])
    .filter((rule) => rule.action === "ignore")
    .reduce((sum, rule) => sum + foundOn(rule).current, 0);
  return { kind: ignored ? "except" : "whole", elements: ignored, areas };
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

const ORDER: ElementRuleAction[] = ["compare", "ignore", "tolerate"];

/** Rules by what they do, compared ones first (REQ-024-23). */
export function groupRules(
  rules: ScreenRule[],
): Array<{ action: ElementRuleAction; rules: ScreenRule[] }> {
  return ORDER.map((action) => ({
    action,
    rules: rules.filter((rule) => rule.action === action),
  })).filter((group) => group.rules.length);
}
