import { cropLayout } from "./elementCrop.helper";

describe("element crop helper", () => {
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
});
