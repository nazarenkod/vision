import { deviceLabel, deviceTagsOf } from "./device.helper";

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

describe("deviceTagsOf", () => {
  it("puts the OS first, then the model, browser and viewport", () => {
    expect(
      deviceTagsOf({
        viewport: "1080x2280",
        device: "PIXEL_4_XL",
        browser: "chrome",
        os: "15",
      }).map((tag) => tag.value),
    ).toEqual(["15", "PIXEL_4_XL", "chrome", "1080x2280"]);
  });

  it("leaves out empty values but keeps repeated ones apart", () => {
    expect(
      deviceTagsOf({
        os: " ",
        device: "Tablet",
        browser: null,
        viewport: "Tablet",
      }),
    ).toEqual([
      { field: "device", value: "Tablet" },
      { field: "viewport", value: "Tablet" },
    ]);
  });
});
