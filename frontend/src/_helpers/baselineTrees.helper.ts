import { routes } from "../constants";
import { InspectorNode } from "../types/insights";
import { TreeOutline } from "./treeInspector.helper";

/**
 * The trees of two versions in a baseline's history, side by side (081). An
 * element is named by its key, so one choice shows it in both versions.
 */

/** The element with this key in a version's tree (REQ-081-10). */
export const counterpart = (
  nodes: InspectorNode[] | undefined,
  key: string | undefined,
): InspectorNode | undefined =>
  key && nodes ? nodes.find((node) => node.key === key) : undefined;

/** One attribute of the card: a version's value, "—" when empty, null when the version has no such element. */
export interface PairCardRow {
  name: string;
  selected: string | null;
  previous: string | null;
}

const shown = (value: string | undefined) =>
  value === undefined || value === "" ? "—" : value;

/**
 * The chosen element's attributes in both versions, in the platform's order:
 * the selected version's first, then what only the previous one has
 * (REQ-081-14, 15).
 */
export function pairCard(
  selected: InspectorNode | undefined,
  previous: InspectorNode | undefined,
): PairCardRow[] {
  const names: string[] = [];
  for (const node of [selected, previous])
    for (const [name] of node?.attributes ?? [])
      if (!names.includes(name)) names.push(name);
  const valueOf = (node: InspectorNode | undefined, name: string) =>
    node ? shown(node.attributes.find(([at]) => at === name)?.[1]) : null;
  return names.map((name) => ({
    name,
    selected: valueOf(selected, name),
    previous: valueOf(previous, name),
  }));
}

/**
 * The chosen element solid and the pointed one dashed, on one version's
 * screenshot, wherever that version has them (REQ-081-11, 13).
 */
export function pairOutlines(
  nodes: InspectorNode[] | undefined,
  chosen: string | undefined,
  pointed: string | undefined,
): TreeOutline[] {
  const label = (node: InspectorNode) =>
    node.id ? `${node.name} #${node.id}` : node.name;
  const chosenHere = counterpart(nodes, chosen);
  const pointedHere = counterpart(nodes, pointed);
  const outlines: TreeOutline[] = [];
  if (pointedHere?.bounds && pointedHere !== chosenHere)
    outlines.push({
      id: "pair:pointed",
      rect: pointedHere.bounds,
      dashed: true,
      label: label(pointedHere),
    });
  if (chosenHere?.bounds)
    outlines.push({
      id: "pair:chosen",
      rect: chosenHere.bounds,
      dashed: false,
      label: label(chosenHere),
    });
  return outlines;
}

export type HistoryView = "screens" | "tree";

/** What the history shows: the version, screenshots or trees, the element. */
export interface HistoryPlace {
  baseline?: string;
  view: HistoryView;
  node?: string;
}

/** The place an address names; screenshots when it names no view (REQ-081-01). */
export function readHistoryPlace(search: string): HistoryPlace {
  const params = new URLSearchParams(search);
  const place: HistoryPlace = {
    view: params.get("view") === "tree" ? "tree" : "screens",
  };
  const baseline = params.get("baseline");
  if (baseline) place.baseline = baseline;
  const node = params.get("node");
  if (node) place.node = node;
  return place;
}

const query = (place: HistoryPlace, withView: boolean) => {
  const params = new URLSearchParams();
  if (place.baseline) params.set("baseline", place.baseline);
  if (withView && place.view === "tree") params.set("view", "tree");
  if (place.node) params.set("node", place.node);
  const text = params.toString();
  return text ? `?${text}` : "";
};

/** The baseline history on a version, a view and an element (REQ-081-09, 19). */
export function historyLocation(variationId: string, place: HistoryPlace) {
  return `${routes.VARIATION_DETAILS_PAGE}/${variationId}${query(place, true)}`;
}

/** The pair with its trees on the whole window, to share (REQ-081-17, 18). */
export function baselineTreesLocation(
  variationId: string,
  place: HistoryPlace,
) {
  return `${routes.BASELINE_TREES_PAGE.replace(":testVariationId", variationId)}${query(place, false)}`;
}
