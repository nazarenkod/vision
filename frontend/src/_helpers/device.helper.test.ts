import { deviceLabel } from "./device.helper";

describe("deviceLabel", () => {
  it("names each value as upstream VRT does", () => {
    expect(deviceLabel({ device: "PIXEL_4_XL", os: "15" })).toBe(
      "OS: 15 · Device: PIXEL_4_XL",
    );
    expect(deviceLabel({ browser: "chrome", viewport: "1280x720" })).toBe(
      "Browser: chrome · Viewport: 1280x720",
    );
  });

  it("says when there is nothing to name", () => {
    expect(deviceLabel({})).toBe("No device");
    expect(deviceLabel({}, "—")).toBe("—");
  });
});
