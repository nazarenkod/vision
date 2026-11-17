import { frameInside, labelTop } from "./overlayRect.helper";

const stage = { x: 0, y: 0, width: 1290, height: 2796 };

describe("frameInside", () => {
  it("keeps the frame of a full-screen element whole on the screenshot", () => {
    expect(frameInside(stage, 10, stage)).toEqual({
      x: 5,
      y: 5,
      width: 1280,
      height: 2786,
    });
  });

  it("leaves an element inside the screenshot where it is", () => {
    const rect = { x: 100, y: 200, width: 300, height: 80 };
    expect(frameInside(rect, 10, stage)).toEqual(rect);
  });

  it("cuts an element reaching past the screenshot to its edge", () => {
    expect(
      frameInside({ x: -40, y: 2700, width: 200, height: 300 }, 4, stage),
    ).toEqual({ x: 2, y: 2700, width: 158, height: 94 });
  });
});

describe("labelTop", () => {
  it("puts the label above the frame when there is room", () => {
    expect(labelTop({ x: 0, y: 300, width: 10, height: 10 }, 100)).toBe(200);
  });

  it("puts the label inside a frame at the top of the screenshot", () => {
    expect(labelTop({ x: 0, y: 5, width: 10, height: 10 }, 100)).toBe(5);
  });
});
