import {
  baselineValues,
  comparisonLocation,
  initialOpen,
  inspectorLocation,
  isMarked,
  keepWithAncestors,
  keyAction,
  marksByKey,
  matchesQuery,
  nodeAt,
  readPanelPlace,
  readTreePlace,
  treeOutlines,
  visibleRows,
} from "./treeInspector.helper";
import { InspectorNode, Rect } from "../types/insights";

const node = (
  index: number,
  parent: number | null,
  name: string,
  extra: Partial<InspectorNode> = {},
): InspectorNode => ({
  index,
  parent,
  key: extra.key ?? `k${index}`,
  className: `android.widget.${name}`,
  name,
  id: "",
  text: "",
  attributes: [],
  bounds: { x: 0, y: 0, width: 1080, height: 2400 },
  ...extra,
});

// root ─ content ─┬ toolbar ─ title
//                 ├ welcome
//                 └ promo ─ promoText
const tree: InspectorNode[] = [
  node(0, null, "FrameLayout"),
  node(1, 0, "LinearLayout", { id: "content" }),
  node(2, 1, "Toolbar", {
    id: "toolbar",
    bounds: { x: 0, y: 0, width: 1080, height: 220 },
  }),
  node(3, 2, "TextView", {
    id: "toolbar_title",
    text: "Sign in",
    bounds: { x: 64, y: 70, width: 536, height: 80 },
  }),
  node(4, 1, "TextView", {
    key: "id:welcome",
    id: "welcome",
    text: "Welcome back",
    attributes: [
      ["text", "Welcome back"],
      ["bounds", "[120,700][960,800]"],
    ],
    bounds: { x: 120, y: 700, width: 840, height: 100 },
  }),
  node(5, 1, "FrameLayout", {
    key: "id:promo",
    id: "promo",
    bounds: { x: 96, y: 1760, width: 888, height: 280 },
  }),
  node(6, 5, "TextView", {
    text: "20% off",
    bounds: { x: 140, y: 1830, width: 800, height: 140 },
  }),
];

const shown = (rows: ReturnType<typeof visibleRows>) =>
  rows.map((row) => row.index);

describe("tree inspector (062)", () => {
  it("opens two levels and the way to every marked node", () => {
    const open = initialOpen(tree, (n) => n.index === 6);
    // root and content: the first two levels; promo: on the way to the marked text
    expect([...open].sort()).toEqual([0, 1, 5]);
    expect(shown(visibleRows(tree, open, null))).toEqual([0, 1, 2, 4, 5, 6]);
  });

  it("hides the children of a folded node", () => {
    const open = new Set([0, 1, 2, 5]);
    expect(shown(visibleRows(tree, open, null))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    open.delete(1);
    const rows = visibleRows(tree, open, null);
    expect(shown(rows)).toEqual([0, 1]);
    expect(rows[1]).toMatchObject({ hasChildren: true, open: false });
  });

  it("keeps matches and their ancestors whatever the case", () => {
    const keep = keepWithAncestors(tree, (n) => matchesQuery(n, "WELCOME"));
    // the search shows what it keeps unfolded, folded or not
    expect(shown(visibleRows(tree, new Set(), keep))).toEqual([0, 1, 4]);
    expect(matchesQuery(tree[3], "toolbar_t")).toBe(true);
    expect(matchesQuery(tree[3], "textview")).toBe(true);
    expect(
      keepWithAncestors(tree, (n) => matchesQuery(n, "nothing")).size,
    ).toBe(0);
  });

  it("keeps only changed and flagged nodes with their ancestors", () => {
    const marks = marksByKey(
      [
        {
          kind: "text",
          key: "id:welcome",
          element: "",
          resourceId: "",
          bounds: tree[4].bounds as Rect,
        },
      ],
      [{ nodeKey: "k6" }],
    );
    const keep = keepWithAncestors(tree, (n) => isMarked(marks.get(n.key)));
    expect(shown(visibleRows(tree, new Set(), keep))).toEqual([0, 1, 4, 5, 6]);
  });

  it("marks nodes by the change and the finding on their key", () => {
    const marks = marksByKey(
      [
        {
          kind: "text",
          key: "id:welcome",
          element: "",
          resourceId: "",
          bounds: tree[4].bounds as Rect,
        },
        {
          kind: "moved",
          key: "id:welcome",
          element: "",
          resourceId: "",
          bounds: tree[4].bounds as Rect,
        },
        {
          kind: "added",
          key: "id:promo",
          element: "",
          resourceId: "",
          bounds: tree[5].bounds as Rect,
        },
      ],
      [{ nodeKey: "id:welcome" }, { nodeKey: "id:welcome" }],
    );
    expect(marks.get("id:welcome")).toEqual({ change: "text", a11y: 2 });
    expect(marks.get("id:promo")).toEqual({ change: "added" });
    expect(isMarked(marks.get("k0"))).toBe(false);
  });

  it("picks the smallest positioned node under the point", () => {
    expect(nodeAt({ x: 200, y: 1900 }, tree)?.index).toBe(6);
    expect(nodeAt({ x: 100, y: 100 }, tree)?.index).toBe(3);
    const hidden = tree.map((n) =>
      n.index === 6 ? { ...n, bounds: null } : n,
    );
    expect(nodeAt({ x: 200, y: 1900 }, hidden)?.index).toBe(5);
    expect(nodeAt(null, tree)).toBeUndefined();
  });

  it("outlines the hovered node dashed and the chosen one solid", () => {
    const outlines = treeOutlines(
      "current",
      { current: tree },
      { side: "current", index: 4 },
      { side: "current", index: 3 },
    );
    expect(outlines).toEqual([
      {
        id: "tree:pointed",
        rect: tree[3].bounds,
        dashed: true,
        label: "TextView #toolbar_title",
      },
      {
        id: "tree:chosen",
        rect: tree[4].bounds,
        dashed: false,
        label: "TextView #welcome",
      },
    ]);
  });

  it("outlines the chosen node on the baseline by its key", () => {
    const baseline = [
      node(0, null, "FrameLayout"),
      node(1, 0, "TextView", {
        key: "id:welcome",
        id: "welcome",
        bounds: { x: 120, y: 650, width: 840, height: 100 },
      }),
    ];
    const trees = { current: tree, baseline };
    expect(
      treeOutlines("baseline", trees, { side: "current", index: 4 }, undefined),
    ).toEqual([
      {
        id: "tree:chosen",
        rect: baseline[1].bounds,
        dashed: false,
        label: "TextView #welcome",
      },
    ]);
    // the banner is new: nothing on the baseline stands for it
    expect(
      treeOutlines("baseline", trees, { side: "current", index: 5 }, undefined),
    ).toEqual([]);
  });

  it("gives the baseline value of a changed attribute", () => {
    const before = {
      ...tree[4],
      attributes: [
        ["text", "Hello again"],
        ["bounds", "[120,700][960,800]"],
      ] as Array<[string, string]>,
    };
    expect([...baselineValues(tree[4], before)]).toEqual([
      ["text", "Hello again"],
    ]);
    expect(baselineValues(tree[4], undefined).size).toBe(0);
  });

  it("steps through the visible rows with the arrow keys", () => {
    const open = new Set([0, 1]);
    const rows = visibleRows(tree, open, null);
    expect(keyAction("ArrowDown", rows, 1, tree)).toEqual({ select: 2 });
    expect(keyAction("ArrowUp", rows, 1, tree)).toEqual({ select: 0 });
    // → unfolds a folded node, then goes into it
    expect(keyAction("ArrowRight", rows, 2, tree)).toEqual({ open: 2 });
    expect(keyAction("ArrowRight", rows, 1, tree)).toEqual({ select: 2 });
    // ← folds an open node, else goes to the parent
    expect(keyAction("ArrowLeft", rows, 1, tree)).toEqual({ fold: 1 });
    expect(keyAction("ArrowLeft", rows, 4, tree)).toEqual({ select: 1 });
    expect(keyAction("ArrowDown", rows, undefined, tree)).toEqual({
      select: 0,
    });
  });

  it("keeps the check, the tree and the node in the inspector address", () => {
    expect(inspectorLocation("r1", "baseline", 12)).toBe(
      "/inspect/r1?tree=baseline&node=12",
    );
    expect(inspectorLocation("r1", "current")).toBe("/inspect/r1?tree=current");
  });

  it("reads the tree and the node back from the inspector address", () => {
    expect(readTreePlace("?tree=baseline&node=12")).toEqual({
      side: "baseline",
      node: 12,
    });
    expect(readTreePlace("?node=x")).toEqual({ side: "current" });
  });

  it("returns to the comparison on the Elements tab with the node", () => {
    const back = comparisonLocation("p1", "b1", "r1", "current", 4);
    expect(back).toEqual({
      pathname: "/p1",
      search: "buildId=b1&panel=elements&tree=current&node=4&testId=r1",
    });
    expect(readPanelPlace(`?${back.search}`)).toEqual({
      side: "current",
      node: 4,
    });
    expect(readPanelPlace("?buildId=b1&testId=r1")).toBeNull();
  });
});
