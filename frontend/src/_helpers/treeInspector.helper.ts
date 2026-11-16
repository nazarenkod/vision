import {
  InspectorNode,
  Rect,
  StructuralChange,
  TreeSide,
} from "../types/insights";
import { buildTestRunLocation } from "./route.helpers";
import { routes } from "../constants";

/** What the Elements tab says about a node on its row (REQ-061-17). */
export interface NodeMark {
  change?: StructuralChange["kind"];
  a11y?: number;
}

/**
 * Marks by node key, from the changes and findings the other tabs show, so the
 * tree says exactly what they say. The first change of a key wins: content
 * changes come first in the diff.
 */
export function marksByKey(
  changes: StructuralChange[],
  violations: Array<{ nodeKey: string }>,
): Map<string, NodeMark> {
  const marks = new Map<string, NodeMark>();
  for (const change of changes) {
    const mark = marks.get(change.key) ?? {};
    if (!mark.change) marks.set(change.key, { ...mark, change: change.kind });
  }
  for (const { nodeKey } of violations) {
    const mark = marks.get(nodeKey) ?? {};
    marks.set(nodeKey, { ...mark, a11y: (mark.a11y ?? 0) + 1 });
  }
  return marks;
}

export const isMarked = (mark: NodeMark | undefined) =>
  !!mark && (!!mark.change || !!mark.a11y);

/** Each node's children, in tree order. */
export function childrenOf(nodes: InspectorNode[]): number[][] {
  const children: number[][] = nodes.map(() => []);
  for (const node of nodes)
    if (node.parent !== null) children[node.parent]?.push(node.index);
  return children;
}

/** How deep each node lies: 0 for a top one. */
export function depthsOf(nodes: InspectorNode[]): number[] {
  const depths: number[] = [];
  // a parent always comes before its children
  for (const node of nodes)
    depths[node.index] = node.parent === null ? 0 : depths[node.parent] + 1;
  return depths;
}

const ancestorsOf = (nodes: InspectorNode[], index: number): number[] => {
  const up: number[] = [];
  for (
    let at = nodes[index]?.parent ?? null;
    at !== null;
    at = nodes[at].parent
  )
    up.push(at);
  return up;
};

/**
 * What is unfolded when the tab opens: the first two levels, and the way to
 * every changed or flagged node (REQ-061-05).
 */
export function initialOpen(
  nodes: InspectorNode[],
  marked: (node: InspectorNode) => boolean,
  levels = 2,
): Set<number> {
  const depths = depthsOf(nodes);
  const open = new Set<number>();
  for (const node of nodes) {
    if (depths[node.index] < levels) open.add(node.index);
    if (marked(node))
      ancestorsOf(nodes, node.index).forEach((up) => open.add(up));
  }
  return open;
}

/** Unfolds everything above a node, so its row can be shown. */
export function openTo(
  open: Set<number>,
  nodes: InspectorNode[],
  index: number,
): Set<number> {
  const next = new Set(open);
  ancestorsOf(nodes, index).forEach((up) => next.add(up));
  return next;
}

/** Whether a search finds the node: its class, id, text or label, whatever the case (REQ-061-22). */
export function matchesQuery(node: InspectorNode, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const label =
    node.attributes.find(
      ([name]) =>
        name === "content-desc" || name === "label" || name === "aria-label",
    )?.[1] ?? "";
  return [node.className, node.id, node.text, label].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

/** The nodes a test keeps, with every ancestor, so each stays in its place (REQ-061-21, 22). */
export function keepWithAncestors(
  nodes: InspectorNode[],
  test: (node: InspectorNode) => boolean,
): Set<number> {
  const keep = new Set<number>();
  for (const node of nodes) {
    if (!test(node) || keep.has(node.index)) continue;
    keep.add(node.index);
    for (const up of ancestorsOf(nodes, node.index)) {
      if (keep.has(up)) break;
      keep.add(up);
    }
  }
  return keep;
}

export interface TreeRow {
  index: number;
  depth: number;
  hasChildren: boolean;
  open: boolean;
}

/**
 * The rows shown, in tree order: what folded nodes hold is left out (REQ-061-04).
 * While a search or a filter is on, everything it keeps is shown unfolded.
 */
export function visibleRows(
  nodes: InspectorNode[],
  open: Set<number>,
  keep: Set<number> | null,
): TreeRow[] {
  const children = childrenOf(nodes);
  const depths = depthsOf(nodes);
  const rows: TreeRow[] = [];
  const walk = (index: number) => {
    if (keep && !keep.has(index)) return;
    const kids = keep
      ? children[index].filter((child) => keep.has(child))
      : children[index];
    const isOpen = !!keep || open.has(index);
    rows.push({
      index,
      depth: depths[index],
      hasChildren: kids.length > 0,
      open: kids.length > 0 && isOpen,
    });
    if (isOpen) kids.forEach(walk);
  };
  nodes
    .filter((node) => node.parent === null)
    .forEach((node) => walk(node.index));
  return rows;
}

const contains = (rect: Rect, point: { x: number; y: number }) =>
  point.x >= rect.x &&
  point.x < rect.x + rect.width &&
  point.y >= rect.y &&
  point.y < rect.y + rect.height;

/** The smallest node with a place on the screenshot under a point (REQ-061-12, 13). */
export function nodeAt(
  point: { x: number; y: number } | null,
  nodes: InspectorNode[],
): InspectorNode | undefined {
  if (!point) return undefined;
  let best: InspectorNode | undefined;
  for (const node of nodes) {
    if (!node.bounds || !contains(node.bounds, point)) continue;
    const area = node.bounds.width * node.bounds.height;
    // the later of two the same size lies on top
    if (!best?.bounds || area <= best.bounds.width * best.bounds.height)
      best = node;
  }
  return best;
}

/** The node with the same key on the other tree. */
export const sameNode = (
  node: InspectorNode | undefined,
  other: InspectorNode[] | undefined,
) => (node && other ? other.find((item) => item.key === node.key) : undefined);

/** Attributes whose value the baseline has otherwise: name → the baseline's value (REQ-061-18). */
export function baselineValues(
  node: InspectorNode,
  baseline: InspectorNode | undefined,
): Map<string, string> {
  const differ = new Map<string, string>();
  if (!baseline) return differ;
  const before = new Map(baseline.attributes);
  for (const [name, value] of node.attributes) {
    const was = before.get(name);
    if (was !== undefined && was !== value) differ.set(name, was);
  }
  return differ;
}

export type TreeKeyAction =
  { select: number } | { open: number } | { fold: number } | null;

/** What an arrow key does in the tree (REQ-061-25). */
export function keyAction(
  key: string,
  rows: TreeRow[],
  current: number | undefined,
  nodes: InspectorNode[],
): TreeKeyAction {
  const at = rows.findIndex((row) => row.index === current);
  if (at < 0) return rows.length ? { select: rows[0].index } : null;
  const row = rows[at];
  if (key === "ArrowDown")
    return at + 1 < rows.length ? { select: rows[at + 1].index } : null;
  if (key === "ArrowUp") return at > 0 ? { select: rows[at - 1].index } : null;
  if (key === "ArrowRight") {
    if (row.hasChildren && !row.open) return { open: row.index };
    return row.open ? { select: rows[at + 1].index } : null;
  }
  if (key === "ArrowLeft") {
    if (row.open) return { fold: row.index };
    const parent = nodes[row.index]?.parent;
    return parent === null || parent === undefined ? null : { select: parent };
  }
  return null;
}

/** A node outlined on a screenshot: the one chosen solid, the one pointed at dashed (REQ-061-10, 11). */
export interface TreeOutline {
  id: string;
  rect: Rect;
  dashed: boolean;
  label: string;
}

const outlineLabel = (node: InspectorNode) =>
  node.id ? `${node.name} #${node.id}` : node.name;

/**
 * The outlines for one screenshot. A node is shown where its own tree is; on
 * the other screenshot, the node with the same key is (REQ-061-11).
 */
export function treeOutlines(
  screenshot: TreeSide,
  trees: Partial<Record<TreeSide, InspectorNode[]>>,
  chosen: { side: TreeSide; index: number } | undefined,
  pointed: { side: TreeSide; index: number } | undefined,
): TreeOutline[] {
  const here = (
    item: { side: TreeSide; index: number } | undefined,
  ): InspectorNode | undefined => {
    if (!item) return undefined;
    const node = trees[item.side]?.[item.index];
    return item.side === screenshot ? node : sameNode(node, trees[screenshot]);
  };
  const outlines: TreeOutline[] = [];
  const chosenHere = here(chosen);
  const pointedHere = here(pointed);
  if (pointedHere?.bounds && pointedHere !== chosenHere)
    outlines.push({
      id: "tree:pointed",
      rect: pointedHere.bounds,
      dashed: true,
      label: outlineLabel(pointedHere),
    });
  if (chosenHere?.bounds)
    outlines.push({
      id: "tree:chosen",
      rect: chosenHere.bounds,
      dashed: false,
      label: outlineLabel(chosenHere),
    });
  return outlines;
}

/** The inspector page of a check, on one tree and node (REQ-061-31, 33). */
export function inspectorLocation(
  testRunId: string,
  side: TreeSide,
  node?: number,
): string {
  const params = new URLSearchParams({ tree: side });
  if (node !== undefined) params.set("node", String(node));
  return `${routes.INSPECT_PAGE.replace(":testRunId", testRunId)}?${params}`;
}

/** The tree and the node an address names; the current tree when it names none. */
export function readTreePlace(search: string): {
  side: TreeSide;
  node?: number;
} {
  const params = new URLSearchParams(search);
  const side: TreeSide =
    params.get("tree") === "baseline" ? "baseline" : "current";
  const raw = params.get("node");
  const node = raw !== null && /^\d+$/.test(raw) ? Number(raw) : undefined;
  return node === undefined ? { side } : { side, node };
}

/** Back to the comparison of the check, on the Elements tab with the node (REQ-061-35). */
export function comparisonLocation(
  projectId: string,
  buildId: string,
  testRunId: string,
  side: TreeSide,
  node?: number,
): { pathname: string; search: string } {
  const params = new URLSearchParams(
    buildTestRunLocation(buildId, testRunId).search,
  );
  params.set("panel", "elements");
  params.set("tree", side);
  if (node !== undefined) params.set("node", String(node));
  // the run stays last: links and tests read it off the end
  const testId = params.get("testId");
  params.delete("testId");
  if (testId) params.set("testId", testId);
  return { pathname: `${routes.HOME}${projectId}`, search: params.toString() };
}

/** Whether an address asks the comparison to open on the Elements tab. */
export function readPanelPlace(
  search: string,
): { side: TreeSide; node?: number } | null {
  const params = new URLSearchParams(search);
  return params.get("panel") === "elements" ? readTreePlace(search) : null;
}
