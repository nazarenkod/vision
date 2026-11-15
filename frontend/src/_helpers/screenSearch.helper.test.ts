import {
  boxPercent,
  decodeBoxes,
  encodeBoxes,
  isSearchable,
  isSearchHotkey,
} from "./screenSearch.helper";

const key = (over: Partial<Parameters<typeof isSearchHotkey>[0]> = {}) => ({
  key: "/",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: document.body,
  ...over,
});

describe("screen search helper", () => {
  it("asks for two characters before searching", () => {
    expect(isSearchable(" к ")).toBe(false);
    expect(isSearchable("кб")).toBe(true);
    expect(isSearchable("id:")).toBe(true);
    expect(isSearchable("Component:PbButton")).toBe(true);
  });

  it("opens the search with the slash key outside a field only", () => {
    expect(isSearchHotkey(key())).toBe(true);
    expect(isSearchHotkey(key({ ctrlKey: true }))).toBe(false);
    expect(isSearchHotkey(key({ key: "?" }))).toBe(false);
    expect(
      isSearchHotkey(key({ target: document.createElement("input") })),
    ).toBe(false);
    expect(
      isSearchHotkey(key({ target: document.createElement("textarea") })),
    ).toBe(false);
  });

  it("outlines a found element in percent of the picture", () => {
    expect(
      boxPercent({ x: 108, y: 240, width: 540, height: 120 }, 1080, 2400),
    ).toEqual({ left: "10%", top: "10%", width: "50%", height: "5%" });
  });

  it("carries found elements to the baseline in the address", () => {
    const boxes = [
      { x: 10.4, y: 20, width: 300, height: 60 },
      { x: 0, y: 0, width: 1080, height: 100 },
    ];
    expect(encodeBoxes(boxes)).toBe("10,20,300,60;0,0,1080,100");
    expect(decodeBoxes(encodeBoxes(boxes))).toEqual([
      { x: 10, y: 20, width: 300, height: 60 },
      { x: 0, y: 0, width: 1080, height: 100 },
    ]);
    expect(decodeBoxes("1,2,3;a,b,c,d;5,5,0,10")).toEqual([]);
    expect(decodeBoxes(null)).toEqual([]);
  });
});
