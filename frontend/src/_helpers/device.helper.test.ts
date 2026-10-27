import { deviceLabel, osLabel } from "./device.helper";

describe("deviceLabel", () => {
  it("labels an OS sent as a bare version", () => {
    expect(deviceLabel({ device: "PIXEL_4_XL", os: "15" })).toBe(
      "PIXEL_4_XL · OS 15",
    );
    expect(osLabel("17.4")).toBe("OS 17.4");
  });

  it("keeps an OS that names itself", () => {
    expect(deviceLabel({ device: "Pixel 7", os: "Android 15" })).toBe(
      "Pixel 7 · Android 15",
    );
    expect(osLabel("iOS 17")).toBe("iOS 17");
  });

  it("joins the parts that are set, or says there are none", () => {
    expect(deviceLabel({ browser: "chrome", viewport: "1280x720" })).toBe(
      "chrome · 1280x720",
    );
    expect(deviceLabel({}, "—")).toBe("—");
  });
});
