import {
  boxPercent,
  decodeBoxes,
  encodeBoxes,
  isSearchable,
  isSearchHotkey,
  cropLayout,
  devicesOf,
  nextActive,
  searchHits,
} from "./screenSearch.helper";
import type { ScreenSearchRow } from "../types";

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

describe("screen search results", () => {
  const item = (device: string, keys: string[]) => ({
    id: device,
    testVariationId: device,
    device,
    os: "Android 14",
    browser: "",
    viewport: "",
    imageName: `${device}.png`,
    imageThumbnailName: null,
    width: 1080,
    height: 2400,
    boxes: keys.map((_, i) => ({ x: 0, y: i * 100, width: 500, height: 80 })),
    keys,
  });
  const rows: ScreenSearchRow[] = [
    {
      name: "Cards",
      customTags: "",
      screen: "Картка",
      matches: 3,
      where: ["text"],
      items: [item("Pixel 7", ["id:a", "id:b"]), item("Galaxy S23", ["id:a"])],
    },
  ];

  it("shows each found element once with every device it was found on", () => {
    const hits = searchHits(rows);
    expect(hits.map((hit) => [hit.key, hit.devices.length])).toEqual([
      ["id:a", 2],
      ["id:b", 1],
    ]);
    expect(hits[0].devices[1].box).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 80,
    });
  });

  it("leaves out the devices switched off", () => {
    const hits = searchHits(rows, new Set(["Pixel 7 · Android 14"]));
    expect(hits.map((hit) => [hit.key, hit.devices.length])).toEqual([
      ["id:a", 1],
    ]);
    expect(devicesOf(rows)).toEqual([
      "Pixel 7 · Android 14",
      "Galaxy S23 · Android 14",
    ]);
  });

  it("cuts the element out with a margin, keeping its proportions", () => {
    const layout = cropLayout(
      { x: 100, y: 200, width: 468, height: 68 },
      { width: 1080, height: 2400 },
      250,
      200,
    );
    expect(layout).toEqual({
      boxWidth: 250,
      boxHeight: 50,
      imageWidth: 540,
      imageHeight: 1200,
      left: -42,
      top: -92,
    });
  });

  it("moves through the suggestions and back to the field", () => {
    expect(nextActive(-1, 1, 3)).toBe(0);
    expect(nextActive(2, 1, 3)).toBe(-1);
    expect(nextActive(-1, -1, 3)).toBe(2);
    expect(nextActive(-1, 1, 0)).toBe(-1);
  });
});
