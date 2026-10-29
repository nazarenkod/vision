import { Rect, StructureInfo } from "../../types";

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
  const match = /^(\S+)(?: "(.*)")?(?: \(([^()]*)\))?$/.exec(element);
  if (!match) return { type: element, name: null, id: null };
  return { type: match[1], name: match[2] ?? null, id: match[3] ?? null };
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
