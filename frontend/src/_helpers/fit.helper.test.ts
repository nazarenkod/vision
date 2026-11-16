import { fitScale } from "./fit.helper";

describe("fitScale", () => {
  it("fits a portrait screen to the height of the area", () => {
    // a 1080 × 2340 phone screen in a wide, low area: the height decides
    const scale = fitScale(
      { width: 1080, height: 2340 },
      { width: 500, height: 702 },
    );
    expect(scale).toBeCloseTo(0.3, 5);
    expect(2340 * scale).toBeCloseTo(702, 5);
    expect(1080 * scale).toBeLessThanOrEqual(500);
  });

  it("fits a landscape screen to the width of the area", () => {
    const scale = fitScale(
      { width: 2048, height: 1536 },
      { width: 512, height: 900 },
    );
    expect(scale).toBe(0.25);
    expect(1536 * scale).toBeLessThanOrEqual(900);
  });

  it("enlarges a screen smaller than the area", () => {
    expect(
      fitScale({ width: 100, height: 200 }, { width: 400, height: 400 }),
    ).toBe(2);
  });

  it("keeps the scale while the image or the area has no size yet", () => {
    expect(fitScale({ width: 0, height: 0 }, { width: 400, height: 400 })).toBe(
      1,
    );
    expect(fitScale({ width: 100, height: 100 }, { width: 0, height: 0 })).toBe(
      1,
    );
  });
});
