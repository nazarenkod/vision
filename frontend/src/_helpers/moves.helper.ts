import { english, Text } from "../i18n";
import type { MovedElement } from "../types";
import type { OverlayRect } from "../components/TestDetailsDialog/DrawArea";

/** The id a moved element's row lights or pins on the screenshots (spec 079). */
export const moveMarkId = (key: string) => `move:${key}`;

const isMove = (id: string | undefined): id is string =>
  !!id && id.startsWith("move:");

/**
 * The move lit on the screenshots: the one under the pointer, else the pinned
 * one while nothing else is pointed at (REQ-079-06).
 */
export function shownMove(
  moves: MovedElement[],
  preview: string | undefined,
  pinned: string | undefined,
): MovedElement | undefined {
  const id = isMove(preview)
    ? preview
    : !preview && isMove(pinned)
      ? pinned
      : undefined;
  return id ? moves.find((move) => moveMarkId(move.key) === id) : undefined;
}

/** «View · навколо «IBAN», «Сканер»» for a nameless one, the name as it is otherwise (REQ-079-09…11). */
export function moveName(move: MovedElement, t: Text = english): string {
  if (!move.around?.length) return move.element;
  return t("panel.movedAround", {
    element: move.element,
    texts: move.around
      .map((text) => t("panel.movedQuote", { text }))
      .join(", "),
  });
}

/** «вниз на 54 dp, праворуч на 8 dp» (REQ-079-12). */
export function movedBy(move: MovedElement, t: Text = english): string {
  return [
    move.dyDp
      ? t(move.dyDp > 0 ? "panel.down" : "panel.up", {
          count: Math.abs(move.dyDp),
        })
      : "",
    move.dxDp
      ? t(move.dxDp > 0 ? "panel.right" : "panel.left", {
          count: Math.abs(move.dxDp),
        })
      : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** «↓ 54 dp, → 8 dp»: the tag of the element where it is now (REQ-079-02). */
export function moveArrows(move: MovedElement): string {
  return [
    move.dyDp ? `${move.dyDp > 0 ? "↓" : "↑"} ${Math.abs(move.dyDp)} dp` : "",
    move.dxDp ? `${move.dxDp > 0 ? "→" : "←"} ${Math.abs(move.dxDp)} dp` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The outlines of a lit move on one screenshot: dashed where it was on the
 * baseline, solid where it is on the current one, and both on the one
 * screenshot of the overlay and fade views (REQ-079-01, 02, 07).
 */
export function moveMarks(
  move: MovedElement | undefined,
  side: "baseline" | "current",
  { single, color, t = english }: { single: boolean; color: string; t?: Text },
): OverlayRect[] {
  if (!move?.from || !move.to) return [];
  const id = moveMarkId(move.key);
  const was: OverlayRect = {
    id: `${id}:was`,
    ...move.from,
    color,
    dashed: true,
    label: t("panel.movedWas"),
  };
  if (side === "baseline") return [was];
  const now: OverlayRect = {
    id: `${id}:now`,
    ...move.to,
    color,
    label: moveArrows(move),
  };
  return single ? [was, now] : [now];
}
