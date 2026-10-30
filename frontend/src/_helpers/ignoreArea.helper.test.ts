import {
  hasSurface,
  invertIgnoreArea,
  readAreas,
  clampToImage,
} from "./ignoreArea.helper";

describe("clampToImage", () => {
  const area = { id: "1", x: 10, y: 20, width: 30, height: 40 };

  it("leaves an area inside the image as it is", () => {
    expect(clampToImage(area, 100, 100)).toEqual(area);
  });

  it("leaves an area that touches the borders as it is", () => {
    const full = { ...area, x: 0, y: 0, width: 100, height: 50 };

    expect(clampToImage(full, 100, 50)).toEqual(full);
  });

  it("pulls the right and bottom edges back onto the borders", () => {
    expect(
      clampToImage({ ...area, x: 80, y: 30, width: 50, height: 40 }, 100, 50),
    ).toEqual({ ...area, x: 80, y: 30, width: 20, height: 20 });
  });

  it("pulls the left and top edges back onto the borders, keeping the others", () => {
    expect(
      clampToImage({ ...area, x: -15, y: -5, width: 40, height: 30 }, 100, 50),
    ).toEqual({ ...area, x: 0, y: 0, width: 25, height: 25 });
  });

  it("trims an area wider and taller than the image to the image", () => {
    expect(
      clampToImage(
        { ...area, x: -10, y: -10, width: 200, height: 200 },
        100,
        50,
      ),
    ).toEqual({ ...area, x: 0, y: 0, width: 100, height: 50 });
  });

  it("keeps the fields it does not know about", () => {
    const box = { x: 90, y: 0, width: 20, height: 10, rotation: 0 };

    expect(clampToImage(box, 100, 50)).toEqual({ ...box, width: 10 });
  });
});

describe("invertIgnoreArea", () => {
  const sizes = (areas: { width: number; height: number }[]) =>
    areas.map((area) => `${area.width}×${area.height}`);

  it("leaves eight strips around an area well inside the image", () => {
    expect(
      sizes(
        invertIgnoreArea(100, 100, {
          id: "a",
          x: 10,
          y: 20,
          width: 50,
          height: 30,
        }),
      ),
    ).toEqual([
      "10×20",
      "50×20",
      "40×20",
      "10×30",
      "40×30",
      "10×50",
      "50×50",
      "40×50",
    ]);
  });

  it("leaves no empty or negative strips for an area drawn past the borders", () => {
    // as drawn on a 1440 × 3040 screenshot: from 0, 110 and 21 px too wide, 113 too tall
    const strips = invertIgnoreArea(1440, 3040, {
      id: "a",
      x: 0,
      y: 110,
      width: 1461,
      height: 3043,
    });
    expect(strips).toEqual([
      expect.objectContaining({ x: 0, y: 0, width: 1440, height: 110 }),
    ]);
  });
});

describe("readAreas", () => {
  it("drops the areas that have no surface", () => {
    expect(
      readAreas(
        JSON.stringify([
          { id: "1", x: 0, y: 0, width: 1461, height: 110 },
          { id: "2", x: 0, y: 0, width: 0, height: 110 },
          { id: "3", x: 1461, y: 0, width: -21, height: 110 },
          { id: "4", x: 0, y: 3153, width: 1461, height: -113 },
        ]),
      ).map((area) => area.id),
    ).toEqual(["1"]);
    expect(hasSurface({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
  });

  it("reads nothing from a missing or broken value", () => {
    expect(readAreas(null)).toEqual([]);
    expect(readAreas("not json")).toEqual([]);
  });
});
