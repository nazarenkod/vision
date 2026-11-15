import { decidedScreens, isApproveHotkey } from "./elementReview.helper";
import type { ReviewedElement } from "../types";

const screen = (id: string, only: boolean) => ({
  id,
  name: id,
  customTags: "",
  device: "Pixel 7",
  os: "Android 14",
  browser: "",
  viewport: "",
  imageName: `${id}.png`,
  baselineName: `${id}-base.png`,
  merge: false,
  only,
  current: { x: 0, y: 0, width: 1080, height: 150 },
  baseline: { x: 0, y: 0, width: 1080, height: 150 },
  width: 1080,
  height: 2400,
  baselineWidth: 1080,
  baselineHeight: 2400,
});

const element: ReviewedElement = {
  key: "id:toolbar",
  name: "Toolbar",
  screens: 3,
  only: 2,
  items: [screen("a", true), screen("b", true), screen("c", false)],
};

describe("element review helper", () => {
  it("decides only the ticked screens where nothing else changed", () => {
    expect(decidedScreens(element, new Set()).map((item) => item.id)).toEqual([
      "a",
      "b",
    ]);
    expect(
      decidedScreens(element, new Set(["b"])).map((item) => item.id),
    ).toEqual(["a"]);
  });

  it("approves with shift and A outside a field", () => {
    const key = (over = {}) => ({
      key: "A",
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      target: document.body,
      ...over,
    });
    expect(isApproveHotkey(key())).toBe(true);
    expect(isApproveHotkey(key({ shiftKey: false, key: "a" }))).toBe(false);
    expect(isApproveHotkey(key({ metaKey: true }))).toBe(false);
    expect(
      isApproveHotkey(key({ target: document.createElement("input") })),
    ).toBe(false);
  });
});
