import {
  ClassConditions,
  ProjectVocabulary,
  VocabularyElement,
} from "../../types/insights";

const compiled = new Map<string, RegExp | null>();

/**
 * A class pattern as the server reads it (a11y-problems.ts compilePattern):
 * /regex/flags as written, else a whole-value glob with * and ?, any case.
 * Null when it does not compile.
 */
export function compilePattern(pattern: string): RegExp | null {
  if (!compiled.has(pattern)) {
    let result: RegExp | null = null;
    try {
      const regex = /^\/(.+)\/([a-z]*)$/s.exec(pattern.trim());
      if (regex) {
        result = new RegExp(regex[1], regex[2].replace(/[^imsu]/g, ""));
      } else {
        const glob = pattern
          .trim()
          .replace(/[.+^$(){}|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".");
        result = new RegExp(`^${glob}$`, "i");
      }
    } catch {
      result = null;
    }
    if (compiled.size > 1000) compiled.clear();
    compiled.set(pattern, result);
  }
  return compiled.get(pattern) ?? null;
}

/** Why a pattern does not compile, or null; a glob always does. */
export function patternError(pattern: string): string | null {
  const regex = /^\/(.+)\/([a-z]*)$/s.exec(pattern.trim());
  if (!regex) return null;
  try {
    new RegExp(regex[1], regex[2].replace(/[^imsu]/g, ""));
    return null;
  } catch (error) {
    return `${error}`;
  }
}

/** A selector an element rule or the screen title can use: id:…, class:… or text:…. */
export const isSelector = (value: string) =>
  /^(id|class|text):.+/s.test(value.trim());

export const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export type ConditionField = keyof ClassConditions;

export const CONDITION_FIELDS: ConditionField[] = [
  "element",
  "screen",
  "className",
  "label",
];

const matchAny = (patterns: string[] | undefined, value: string) => {
  const given = (patterns ?? []).filter((item) => item.trim());
  if (!given.length) return undefined;
  return given.some((pattern) => !!compilePattern(pattern)?.test(value));
};

export interface Coverage {
  elements: number;
  screens: number;
  examples: string[];
}

/**
 * How much of the project a class's conditions take, by the same reading as
 * the server's classOf: a field left empty does not narrow, any pattern of a
 * field may match, every field filled must.
 */
export function classCoverage(
  conditions: ClassConditions,
  vocabulary: ProjectVocabulary,
): Coverage {
  const screens = new Set<number>();
  const examples: string[] = [];
  let elements = 0;
  const hasCondition = CONDITION_FIELDS.some(
    (field) => (conditions[field] ?? []).filter((item) => item.trim()).length,
  );
  if (!hasCondition) return { elements: 0, screens: 0, examples: [] };

  for (const item of vocabulary.elements) {
    const own = [
      matchAny(conditions.element, item.element),
      matchAny(conditions.className, item.className),
      matchAny(conditions.label, item.label),
    ];
    if (own.some((check) => check === false)) continue;
    const onScreens = item.screens.filter(
      (index) =>
        matchAny(conditions.screen, vocabulary.screens[index] ?? "") !== false,
    );
    if (!onScreens.length) continue;
    elements += 1;
    onScreens.forEach((index) => screens.add(index));
    if (examples.length < 5) examples.push(item.element);
  }
  return { elements, screens: screens.size, examples };
}

/** Values of the project for a class condition field, most common first. */
export function conditionSuggestions(
  field: ConditionField,
  vocabulary: ProjectVocabulary,
  query = "",
  limit = 50,
): string[] {
  const counts = new Map<string, number>();
  const add = (value: string, weight: number) => {
    if (value) counts.set(value, (counts.get(value) ?? 0) + weight);
  };
  if (field === "screen") {
    vocabulary.screens.forEach((screen) => add(screen, 1));
  } else {
    for (const item of vocabulary.elements) {
      const value =
        field === "element"
          ? item.element
          : field === "className"
            ? item.className
            : item.label;
      add(value, item.screens.length);
    }
  }
  const needle = query.trim().toLowerCase();
  return [...counts.entries()]
    .filter(([value]) => !needle || value.toLowerCase().includes(needle))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

export interface ElementOption {
  selector: string;
  // what it is, for telling options apart: class and text or label
  description: string;
  screens: number;
}

const shortClass = (className: string) =>
  className.split(".").pop()?.replace("XCUIElementType", "") ?? className;

/**
 * Elements and classes of the project an element rule can name, matching
 * the query in their id, class, text or label; most common first.
 */
export function searchElements(
  vocabulary: ProjectVocabulary,
  query: string,
  limit = 50,
): ElementOption[] {
  const needle = query.trim().toLowerCase();
  const bySelector = new Map<string, ElementOption>();
  const matches = (item: VocabularyElement) =>
    !needle ||
    [item.selector ?? "", item.className, item.text, item.label].some((value) =>
      value.toLowerCase().includes(needle),
    );
  for (const item of vocabulary.elements) {
    if (!item.selector || !matches(item)) continue;
    const known = bySelector.get(item.selector);
    if (known) {
      known.screens = Math.max(known.screens, item.screens.length);
      continue;
    }
    const words = item.text || item.label;
    bySelector.set(item.selector, {
      selector: item.selector,
      description: [shortClass(item.className), words && `"${words}"`]
        .filter(Boolean)
        .join(" "),
      screens: item.screens.length,
    });
  }
  for (const item of vocabulary.classes) {
    if (needle && !item.name.toLowerCase().includes(needle)) continue;
    bySelector.set(`class:${item.name}`, {
      selector: `class:${item.name}`,
      description: "",
      screens: item.screens,
    });
  }
  return [...bySelector.values()]
    .sort(
      (a, b) => b.screens - a.screens || a.selector.localeCompare(b.selector),
    )
    .slice(0, limit);
}

/** Whether a rule's selector names anything in the project's recent trees. */
export function selectorSeen(
  selector: string,
  vocabulary: ProjectVocabulary,
): boolean {
  const value = selector.trim();
  if (value.startsWith("class:")) {
    const name = shortClass(value.slice(6));
    return vocabulary.classes.some((item) => item.name === name);
  }
  if (value.startsWith("text:/")) return true;
  return vocabulary.elements.some((item) => item.selector === value);
}
