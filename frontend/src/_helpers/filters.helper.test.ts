import { activeFilters, distinctValues } from "./filters.helper";

describe("filters", () => {
  it("names each chosen filter as its chip reads, in the order offered", () => {
    expect(
      activeFilters([
        { key: "os", label: "OS", value: "Android 14" },
        { key: "device", label: "Device", value: "" },
        { key: "branch", label: "Branch", value: "main" },
      ]),
    ).toEqual([
      { key: "os", label: "OS", text: "OS: Android 14" },
      { key: "branch", label: "Branch", text: "Branch: main" },
    ]);
  });

  it("shows a value by its own label when it has one", () => {
    expect(
      activeFilters([
        {
          key: "status",
          label: "Status",
          value: "unresolved",
          shownValue: "Changed",
        },
      ]).map((filter) => filter.text),
    ).toEqual(["Status: Changed"]);
  });

  it("offers each value once and leaves out empty ones", () => {
    expect(distinctValues(["a", null, "b", "a", "", undefined])).toEqual([
      "a",
      "b",
    ]);
  });
});
