import { groupAreas, splitElement } from "./changedAreas";

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
