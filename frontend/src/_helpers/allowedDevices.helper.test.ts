import {
  allowedDevicesOf,
  deviceAllowed,
  invalidAllowedDevice,
  sameDevice,
} from "./allowedDevices.helper";

const allowed = [
  { device: "Pixel 7", os: "Android 15" },
  { device: "iPhone 17", os: "26.*" },
];

describe("allowed devices", () => {
  it("reads the list from the project's settings", () => {
    expect(
      allowedDevicesOf(
        JSON.stringify({ allowedDevices: [...allowed, { device: "x" }] }),
      ),
    ).toEqual(allowed);
    expect(allowedDevicesOf(null)).toEqual([]);
    expect(allowedDevicesOf("not json")).toEqual([]);
  });

  it("refuses a * anywhere but a trailing .* of the OS", () => {
    expect(invalidAllowedDevice(allowed[0])).toBeNull();
    expect(invalidAllowedDevice(allowed[1])).toBeNull();
    for (const entry of [
      { device: "Pixel *", os: "Android 15" },
      { device: "iPhone 17", os: "*" },
      { device: "iPhone 17", os: ".*" },
      { device: "iPhone 17", os: "26*" },
      { device: "iPhone 17", os: "2*.1" },
    ]) {
      expect(invalidAllowedDevice(entry)).toBe("wildcard");
    }
    expect(invalidAllowedDevice({ device: "Pixel 7", os: " " })).toBe(
      "missing",
    );
  });

  it("matches as the server does: case, spaces and a trailing .*", () => {
    expect(deviceAllowed(allowed, " pixel 7", "ANDROID 15")).toBe(true);
    expect(deviceAllowed(allowed, "Pixel 7", "Android 15.1")).toBe(false);
    expect(deviceAllowed(allowed, "iPhone 17", "26.2")).toBe(true);
    expect(deviceAllowed(allowed, "iPhone 17", "260")).toBe(false);
    expect(
      sameDevice(allowed[0], { device: "pixel 7 ", os: "android 15" }),
    ).toBe(true);
  });
});
