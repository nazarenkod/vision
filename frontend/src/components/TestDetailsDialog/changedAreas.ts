import { Rect, StructuralChange, StructureInfo } from "../../types";

type Area = StructureInfo["regions"][number];

export interface ElementParts {
  type: string;
  name: string | null;
  id: string | null;
}

/**
 * The backend names an element `Button "Pay" (id/btn_pay)`; the panel shows the
 * three parts apart so a long name does not bury the type and the id.
 */
export function splitElement(element: string): ElementParts {
  // a name may run over several lines on the device: it is still one name (REQ-036-13)
  const match = /^(\S+)(?: "([\s\S]*)")?(?: \(([^()]*)\))?$/.exec(element);
  if (!match) return { type: element, name: null, id: null };
  const name = match[2]?.replace(/\s+/g, " ").trim() || null;
  return { type: match[1], name, id: match[3] ?? null };
}

export interface AreaGroup {
  element: string | null;
  resourceId: string | null;
  regions: Rect[];
  // what to outline on the screenshot: the box around all of its areas
  bounds: Rect;
}

const union = (rects: Rect[]): Rect => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
};

/**
 * One row per element: several changed spots in one element, or in look-alike
 * elements a rule would name the same way, are one thing to decide about.
 * Areas no element wraps stay one row each.
 */
export function groupAreas(areas: Area[]): AreaGroup[] {
  const groups: Array<Omit<AreaGroup, "bounds">> = [];
  const byElement = new Map<string, Omit<AreaGroup, "bounds">>();
  for (const area of areas) {
    const known = area.element ? byElement.get(area.element) : undefined;
    if (known) {
      known.regions.push(area.region);
      continue;
    }
    const group = {
      element: area.element,
      resourceId: area.resourceId,
      regions: [area.region],
    };
    groups.push(group);
    if (area.element) byElement.set(area.element, group);
  }
  return groups.map((group) => ({ ...group, bounds: union(group.regions) }));
}

export interface ChangeRow {
  key: string;
  // null for the one row of spots no element wraps
  element: string | null;
  resourceId: string | null;
  // what the UI tree says changed in it, when it says anything
  change: StructuralChange | null;
  places: Rect[];
  bounds: Rect | null;
  // "2 of 2" when another row bears the same name (REQ-036-14)
  nth: number;
  of: number;
}

/** What the row is called on screen: the name, else the type. */
export const rowName = (element: string) => {
  const { type, name } = splitElement(element);
  return name ?? type;
};

/**
 * One row per changed thing (REQ-036-11…16): an element with every spot that
 * changed in it and what its UI tree says changed, then one row for all the
 * spots no element wraps. Rows with the same name are numbered top to bottom.
 */
export function changeRows(
  regions: Area[],
  changes: StructuralChange[],
): ChangeRow[] {
  const groups = groupAreas(regions);
  const byKey = new Map<string, number>();
  regions.forEach((area) => {
    if (!area.key || !area.element) return;
    const index = groups.findIndex((group) => group.element === area.element);
    if (index >= 0 && !byKey.has(area.key)) byKey.set(area.key, index);
  });
  const rows: ChangeRow[] = groups
    .filter((group) => group.element)
    .map((group) => ({
      key: `area:${group.element}`,
      element: group.element,
      resourceId: group.resourceId,
      change: null,
      places: group.regions,
      bounds: group.bounds,
      nth: 1,
      of: 1,
    }));
  for (const change of changes) {
    if (change.kind === "moved") continue;
    const index = byKey.get(change.key);
    const group = index === undefined ? undefined : groups[index];
    const row = group && rows.find((item) => item.element === group.element);
    if (row && !row.change) {
      row.change = change;
      continue;
    }
    rows.push({
      key: `${change.kind}:${change.key}`,
      element: change.element,
      resourceId: change.resourceId || null,
      change,
      places: [],
      bounds: change.bounds ?? null,
      nth: 1,
      of: 1,
    });
  }
  const top = (row: ChangeRow) => row.bounds?.y ?? Number.MAX_SAFE_INTEGER;
  const byName = new Map<string, ChangeRow[]>();
  rows.forEach((row) => {
    const name = rowName(row.element ?? "");
    byName.set(name, [...(byName.get(name) ?? []), row]);
  });
  byName.forEach((same) => {
    if (same.length < 2) return;
    [...same]
      .sort((a, b) => top(a) - top(b))
      .forEach((row, index) => {
        row.nth = index + 1;
        row.of = same.length;
      });
  });
  const loose = groups.filter((group) => !group.element);
  if (loose.length) {
    const places = loose.flatMap((group) => group.regions);
    rows.push({
      key: "loose",
      element: null,
      resourceId: null,
      change: null,
      places,
      bounds: union(places),
      nth: 1,
      of: 1,
    });
  }
  return rows;
}

/** A spot outside every element counts on its own, as before (REQ-036-16). */
export const countRows = (rows: ChangeRow[]) =>
  rows.reduce((sum, row) => sum + (row.element ? 1 : row.places.length), 0);

export type Where =
  `${"top" | "middle" | "bottom"}.${"left" | "center" | "right"}`;

/** Where a spot sits on the screen, in thirds, so a place reads without coordinates. */
export function whereOn(
  rect: Rect,
  size: { width: number; height: number },
): Where {
  const third = (at: number, of: number) =>
    at < of / 3 ? 0 : at < (of * 2) / 3 ? 1 : 2;
  const v = (["top", "middle", "bottom"] as const)[
    third(rect.y + rect.height / 2, size.height)
  ];
  const h = (["left", "center", "right"] as const)[
    third(rect.x + rect.width / 2, size.width)
  ];
  return `${v}.${h}`;
}
