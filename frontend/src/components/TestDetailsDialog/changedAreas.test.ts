import {
  changeRows,
  countRows,
  groupAreas,
  placeLabel,
  splitElement,
} from "./changedAreas";

const rect = (x: number, y: number, width = 10, height = 10) => ({
  x,
  y,
  width,
  height,
});

describe("splitElement", () => {
  it("separates the type, the name and the id", () => {
    expect(
      splitElement(
        'Button "Зі своєї картки *1050 (+1.01)" (activity_list_item)',
      ),
    ).toEqual({
      type: "Button",
      name: "Зі своєї картки *1050 (+1.01)",
      id: "activity_list_item",
    });
  });

  it("keeps the id apart from a name that runs over several lines", () => {
    expect(
      splitElement(
        'View "OCH_card № 2 6 0 1\n0 6 4 0" (mandatory_payment_error_info)',
      ),
    ).toEqual({
      type: "View",
      name: "OCH_card № 2 6 0 1 0 6 4 0",
      id: "mandatory_payment_error_info",
    });
  });

  it("keeps an element without a name or an id", () => {
    expect(splitElement("ImageView (id/logo)")).toEqual({
      type: "ImageView",
      name: null,
      id: "id/logo",
    });
    expect(splitElement('Text "Історія"')).toEqual({
      type: "Text",
      name: "Історія",
      id: null,
    });
  });
});

describe("groupAreas", () => {
  it("shows an element changed in several spots once, outlining all of them", () => {
    const button = 'Button "Історія" (Історія#PbButton)';
    const groups = groupAreas([
      { region: rect(0, 0), key: "a", element: button, resourceId: "x" },
      { region: rect(100, 0), key: null, element: null, resourceId: null },
      { region: rect(40, 50), key: "a", element: button, resourceId: "x" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].regions).toHaveLength(2);
    expect(groups[0].bounds).toEqual({ x: 0, y: 0, width: 50, height: 60 });
  });

  it("keeps areas no element wraps apart", () => {
    const groups = groupAreas([
      { region: rect(0, 0), key: null, element: null, resourceId: null },
      { region: rect(5, 5), key: null, element: null, resourceId: null },
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe("changeRows", () => {
  const card = 'View "Картка m"';
  const area = (
    x: number,
    y: number,
    element: string | null,
    key: string | null = element,
  ) => ({ region: rect(x, y), key, element, resourceId: null });
  const change = (key: string, element: string, y = 0) =>
    ({
      kind: "text",
      key,
      element,
      resourceId: "",
      before: "30",
      after: "31",
      bounds: rect(0, y),
    }) as const;

  it("puts the spots no element wraps in one last row that still counts each", () => {
    const rows = changeRows(
      [area(0, 0, null), area(0, 50, card), area(90, 0, null)],
      [],
    );
    expect(rows.map((row) => row.element)).toEqual([card, null]);
    expect(rows[1].places).toHaveLength(2);
    expect(countRows(rows)).toBe(3);
  });

  it("leaves rows with the same name unnumbered", () => {
    const rows = changeRows(
      [area(0, 300, 'View "Картка m" (cards#PbCard)'), area(0, 100, card)],
      [],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toHaveProperty("nth");
  });

  it("tells what the tree saw in the same row as the element's spots", () => {
    const rows = changeRows(
      [area(0, 0, card, "k"), area(0, 40, card, "k")],
      [change("k", card), change("other", 'Text "Balance"', 200)],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].change?.after).toBe("31");
    expect(rows[0].places).toHaveLength(2);
    expect(rows[1].places).toHaveLength(0);
    expect(countRows(rows)).toBe(2);
  });

  it("leaves a move out: it is not counted", () => {
    const moved = { ...change("m", card), kind: "moved" as const };
    expect(changeRows([], [moved])).toEqual([]);
  });
});

describe("placeLabel", () => {
  const el = (
    selector: string,
    bounds: ReturnType<typeof rect>,
    text?: string,
    element = `TextView "${text ?? ""}"`,
  ) => ({ selector, element, bounds, text });
  const cardRow = 'View "Картка m"';
  const cardBox = rect(0, 2000, 1000, 400);
  const balanceNow = el("id:balance", rect(40, 2100, 300, 56), "9 870,00 ₴");
  const current = [
    el("id:card", cardBox, undefined, cardRow),
    balanceNow,
    el("id:logo", rect(800, 2050, 96, 32), undefined, "ImageView (logo)"),
  ];
  const baseline = [
    // the other card's balance lies farther away: the near one is the twin
    el("id:balance", rect(40, 2600, 300, 56), "1,00 ₴"),
    el("id:balance", rect(40, 2110, 300, 56), "12 450,00 ₴"),
  ];

  it("says what the text was and is when it changed", () => {
    expect(
      placeLabel(rect(50, 2110, 100, 30), cardRow, current, baseline),
    ).toEqual({ now: "9 870,00 ₴", before: "12 450,00 ₴", isText: true });
  });

  it("names a place without text by the element's type", () => {
    expect(
      placeLabel(rect(810, 2055, 20, 20), cardRow, current, baseline),
    ).toEqual({ now: "ImageView", before: null, isText: false });
  });

  it("leaves a place on the row's own element, or with no tree, to its size", () => {
    expect(
      placeLabel(rect(500, 2300, 50, 50), cardRow, current, baseline),
    ).toBe(null);
    expect(placeLabel(rect(50, 2110, 100, 30), cardRow, [], [])).toBe(null);
  });
});
