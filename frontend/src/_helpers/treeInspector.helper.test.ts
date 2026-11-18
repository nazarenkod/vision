import {
  indentPlan,
  foldedPath,
  nodeKind,
  oneLine,
  splitId,
  splitMatch,
  stepMarked,
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
  clickable: false,
  wrapper: false,
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

  it("opens two levels when nothing is marked", () => {
    // a version in the baseline history has no marks (079)
    expect([...initialOpen(tree, () => false)].sort()).toEqual([0, 1]);
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

// iOS as it comes: the tab bar's texts under a run of wrappers (063)
//  0 Application ─ 1 Other ─ 2 Other ─ 3 Other ─┬ 4 StaticText "Кредити"
//                                               └ 5 Button #Сканувати#PbButton
const deep: InspectorNode[] = [
  node(0, null, "Application", { text: "Bank" }),
  node(1, 0, "Other", { wrapper: true }),
  node(2, 1, "Other", { wrapper: true }),
  node(3, 2, "Other", { wrapper: true }),
  node(4, 3, "StaticText", {
    text: "Кредити\nВкладка 2 з 5",
    bounds: { x: 80, y: 770, width: 78, height: 62 },
  }),
  node(5, 3, "Button", {
    id: "Сканувати#PbButton",
    clickable: true,
    bounds: { x: 16, y: 700, width: 120, height: 44 },
  }),
];
const all = new Set(deep.map((n) => n.index));

describe("readable tree (063)", () => {
  it("hides wrappers and lifts their children, counting what was hidden", () => {
    const rows = visibleRows(deep, all, null, false);
    expect(shown(rows)).toEqual([0, 4, 5]);
    expect(rows[1]).toMatchObject({ depth: 1, parent: 0, skipped: 3 });
  });

  it("shows every node once wrappers are asked for", () => {
    const rows = visibleRows(deep, all, null, true);
    expect(shown(rows)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(rows[4]).toMatchObject({ depth: 4, skipped: 0 });
  });

  it("gives each row the levels above it for the level lines", () => {
    const rows = visibleRows(deep, all, null, false);
    expect(rows[2]).toMatchObject({ levels: [0], parent: 0 });
    // a folded node says how many it holds
    const folded = visibleRows(deep, new Set(), null, false);
    expect(folded).toEqual([
      expect.objectContaining({ index: 0, open: false, childCount: 2 }),
    ]);
  });

  it("folds a run of wrappers in the path and cuts a long one", () => {
    expect(foldedPath(deep, 4)).toEqual([
      { kind: "node", index: 0 },
      { kind: "wrappers", index: 1, count: 3 },
      { kind: "node", index: 4 },
    ]);
    const long = [
      node(0, null, "Application", {}),
      node(1, 0, "Window", { text: "w" }),
      node(2, 1, "Cell", { text: "a" }),
      node(3, 2, "Cell", { text: "b" }),
      node(4, 3, "Cell", { text: "c" }),
      node(5, 4, "StaticText", { text: "d" }),
    ];
    expect(foldedPath(long, 5)).toEqual([
      { kind: "node", index: 0 },
      { kind: "more", count: 2 },
      { kind: "node", index: 3 },
      { kind: "node", index: 4 },
      { kind: "node", index: 5 },
    ]);
  });

  it("marks where a search finds a value", () => {
    expect(splitMatch("Кредити", "КРЕД")).toEqual({
      before: "",
      match: "Кред",
      after: "ити",
    });
    expect(splitMatch("Pay", "x").match).toBe("");
  });

  it("shows a line break as ↵ on one line", () => {
    expect(oneLine("Кредити\nВкладка 2 з 5")).toBe("Кредити ↵ Вкладка 2 з 5");
  });

  it("splits a Compose tag into the id and its component", () => {
    expect(splitId("Сканувати кю ар код#PbButton")).toEqual({
      name: "Сканувати кю ар код",
      component: "PbButton",
    });
    expect(splitId("btn_pay")).toEqual({ name: "btn_pay", component: "" });
  });

  it("names the kind of a node on Android, iOS and the web", () => {
    const kind = (name: string, extra: Partial<InspectorNode> = {}) =>
      nodeKind(node(0, null, name, extra));
    expect(kind("Button")).toBe("button");
    expect(kind("ImageButton")).toBe("button");
    expect(kind("StaticText")).toBe("text");
    expect(kind("TextView")).toBe("text");
    expect(kind("EditText")).toBe("input");
    expect(kind("SecureTextField")).toBe("input");
    expect(kind("ImageView")).toBe("image");
    expect(kind("Switch")).toBe("toggle");
    expect(kind("RecyclerView")).toBe("list");
    expect(kind("Cell")).toBe("cell");
    expect(kind("Window")).toBe("window");
    expect(kind("a")).toBe("link");
    expect(kind("div")).toBe("container");
    // a container someone can tap is a button
    expect(kind("Other", { clickable: true })).toBe("button");
  });

  it("steps to the next and the previous marked node", () => {
    const marked = [2, 5, 9];
    expect(stepMarked(marked, 5, 1)).toBe(9);
    expect(stepMarked(marked, 9, 1)).toBe(2);
    expect(stepMarked(marked, 2, -1)).toBe(9);
    // from a node that is not marked: the nearest one that way
    expect(stepMarked(marked, 6, 1)).toBe(9);
    expect(stepMarked(marked, 6, -1)).toBe(5);
    expect(stepMarked(marked, undefined, 1)).toBe(2);
    expect(stepMarked([], 1, 1)).toBeUndefined();
  });

  it("never chooses a wrapper on the screenshot", () => {
    const covering = deep.map((n) =>
      n.wrapper
        ? { ...n, bounds: { x: 0, y: 600, width: 390, height: 300 } }
        : n,
    );
    expect(nodeAt({ x: 300, y: 650 }, covering)?.index).toBe(0);
    expect(nodeAt({ x: 100, y: 800 }, covering)?.index).toBe(4);
  });
});

describe("a deep tree in a narrow panel (063)", () => {
  it("narrows its levels so a row's own part stays in view", () => {
    // shallow: full levels with their lines
    expect(indentPlan(420, 5)).toEqual({ level: 16, skip: 0, lines: true });
    // twenty levels in 420 px: 10 px each, lines still apart
    expect(indentPlan(420, 20)).toEqual({ level: 10, skip: 0, lines: true });
    // thirty: 6 px each, no lines, they would read as a hatch
    expect(indentPlan(420, 30)).toEqual({ level: 6, skip: 0, lines: false });
    // past that, the top levels are left out and the row says its level
    expect(indentPlan(400, 40)).toEqual({ level: 6, skip: 10, lines: false });
    // not measured yet: as before
    expect(indentPlan(0, 40)).toEqual({ level: 16, skip: 0, lines: true });
  });
});
