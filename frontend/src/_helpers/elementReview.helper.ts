import type { ElementReviewScreen, ReviewedElement } from "../types";

/**
 * The screens one decision takes (055): those where nothing but the element changed, less the
 * ones the reviewer unticked. A screen with another change is never among them.
 */
export const decidedScreens = (
  element: ReviewedElement,
  unpicked: Set<string>,
): ElementReviewScreen[] =>
  element.items.filter((item) => item.only && !unpicked.has(item.id));

/** ⇧A approves the ticked screens, outside a field, like A approves one screen in the comparison. */
export function isApproveHotkey(event: {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean {
  if (event.key.toLowerCase() !== "a" || !event.shiftKey) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target as HTMLElement | null;
  const tag = target?.tagName?.toLowerCase();
  return !(
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target?.isContentEditable
  );
}
