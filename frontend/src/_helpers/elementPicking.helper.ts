import { english, Text } from "../i18n";
import {
  PickableElement,
  Rect,
  ScreenRule,
  SelectorVariant,
} from "../types/insights";

export type Point = { x: number; y: number };

const contains = (b: Rect, point: Point) =>
  point.x >= b.x &&
  point.x < b.x + b.width &&
  point.y >= b.y &&
  point.y < b.y + b.height;

const areaOf = (b: Rect) => b.width * b.height;

/** The smallest element under the pointer is the one meant (REQ-024-02). */
export function elementAt(
  point: Point | null,
  elements: PickableElement[],
): PickableElement | undefined {
  if (!point) return undefined;
  return elements
    .filter((element) => contains(element.bounds, point))
    .sort((a, b) => areaOf(a.bounds) - areaOf(b.bounds))[0];
}

/**
 * The element chosen, and the children stepped up from, so ↓ goes back the
 * way ↑ came (REQ-024-04).
 */
export interface Picked {
  element: PickableElement;
  trail: PickableElement[];
}

export function stepUp(
  picked: Picked,
  elements: PickableElement[],
): Picked | null {
  const { parent } = picked.element;
  const up =
    parent === undefined || parent === null
      ? undefined
      : elements.find((element) => element.index === parent);
  return up ? { element: up, trail: [picked.element, ...picked.trail] } : null;
}

export function stepDown(picked: Picked): Picked | null {
  const [down, ...rest] = picked.trail;
  return down ? { element: down, trail: rest } : null;
}

/** The variant an element is now found by: the first unless another was chosen (REQ-027-16). */
export const chosenVariant = (
  element: PickableElement,
): SelectorVariant | undefined =>
  element.variants?.find((variant) => variant.selector === element.selector) ??
  element.variants?.[0];

/** What the element is to its anchor, briefly: "нащадок offers_list", "батько cashback_label". */
export const relationTo = (
  variant: SelectorVariant,
  text: Text = english,
): string =>
  text(
    variant.direction === "down"
      ? "select.relation.inside"
      : (variant.levels ?? 1) > 1
        ? "select.relation.ancestor"
        : "select.relation.parent",
    { anchor: variant.anchor },
  );

/** "ImageView · inside offers_list" for an element found by a path (REQ-027-03). */
export function elementLabel(
  element: PickableElement,
  text: Text = english,
): string {
  const variant = element.nameless ? chosenVariant(element) : undefined;
  return variant
    ? `${element.element} · ${relationTo(variant, text)}`
    : element.element;
}

/** How many elements a rule with this selector would take on the screenshot. */
export function countBySelector(
  selector: string,
  elements: PickableElement[],
): number {
  return elements.filter((element) => element.selector === selector).length;
}

const sameElement = (a: PickableElement, b: PickableElement) =>
  a.selector === b.selector &&
  a.bounds.x === b.bounds.x &&
  a.bounds.y === b.bounds.y;

/** Shift adds an element or takes it back out; a plain click starts over (REQ-024-05). */
export function toggleSelection(
  selected: PickableElement[],
  element: PickableElement,
  additive: boolean,
): PickableElement[] {
  if (!additive) return [element];
  return selected.some((item) => sameElement(item, element))
    ? selected.filter((item) => !sameElement(item, element))
    : [...selected, element];
}

const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** The rule an element is already under, by what the rule found (REQ-024-09). */
export function ruleFor(
  element: PickableElement,
  rules: ScreenRule[],
  side: "current" | "baseline",
): ScreenRule | undefined {
  // a nameless element is under a rule made with any of its selectors
  const selectors = [
    element.selector,
    ...(element.variants ?? []).map((variant) => variant.selector),
  ];
  return rules.find(
    (rule) =>
      selectors.includes(rule.selector) ||
      (rule.found?.[side] ?? []).some((rect) => sameRect(rect, element.bounds)),
  );
}
