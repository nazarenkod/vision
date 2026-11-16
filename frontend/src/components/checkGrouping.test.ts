import { TestRun, TestVariation } from "../types";
import { deviceLabel, runsOfCheck } from "./TestDetailsDialog/DeviceStrip";
import { groupByCheck } from "./TestVariationList";

const run = (fields: Partial<TestRun>) =>
  ({
    id: "id",
    name: "Payment",
    customTags: "",
    device: "",
    os: "",
    browser: "",
    viewport: "",
    status: "new",
    ...fields,
  }) as TestRun;

describe("runsOfCheck", () => {
  it("finds the same check on every device of the build, by name and custom tags", () => {
    const runs = [
      run({ id: "a", device: "Pixel 7", os: "Android 15" }),
      run({ id: "b", device: "Galaxy S23", os: "Android 14" }),
      run({ id: "c", name: "Login", device: "Pixel 7" }),
      run({ id: "d", device: "Pixel 7", customTags: "dark" }),
    ];
    expect(runsOfCheck(runs, runs[0]).map((r) => r.id)).toEqual(["b", "a"]);
    expect(runsOfCheck(runs, runs[3]).map((r) => r.id)).toEqual(["d"]);
  });

  it("names a device from whatever is set", () => {
    expect(deviceLabel(run({ device: "Pixel 7", os: "Android 15" }))).toBe(
      "OS: Android 15 · Device: Pixel 7",
    );
    expect(deviceLabel(run({ browser: "chrome", viewport: "1280x720" }))).toBe(
      "Browser: chrome · Viewport: 1280x720",
    );
    expect(deviceLabel(run({}))).toBe("No device");
  });
});

describe("groupByCheck", () => {
  const variation = (fields: Partial<TestVariation>) =>
    ({
      id: "id",
      name: "Payment",
      branchName: "master",
      customTags: "",
      device: "",
      os: "",
      browser: "",
      viewport: "",
      ...fields,
    }) as TestVariation;

  it("puts each check's devices on one card, apart per branch and tags", () => {
    const groups = groupByCheck([
      variation({ id: "1", device: "Pixel 7" }),
      variation({ id: "2", name: "Login" }),
      variation({ id: "3", device: "Galaxy S23" }),
      variation({ id: "4", device: "Pixel 7", branchName: "feature" }),
      variation({ id: "5", device: "Pixel 7", customTags: "dark" }),
    ]);
    expect(groups.map((group) => group.map((v) => v.id))).toEqual([
      ["3", "1"],
      ["2"],
      ["4"],
      ["5"],
    ]);
  });
});
