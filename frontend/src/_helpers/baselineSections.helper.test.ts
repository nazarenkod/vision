import { TestVariation } from "../types";
import {
  baselineSections,
  featureOfCheck,
  matchesBaselineQuery,
  pageOfSections,
} from "./baselineSections.helper";

const baseline = (fields: Partial<TestVariation>) =>
  ({
    id: fields.name ?? "id",
    name: "Check",
    branchName: "main",
    device: "Pixel 4 XL",
    os: "15",
    browser: "",
    viewport: "",
    customTags: "",
    ...fields,
  }) as TestVariation;
const check = (name: string, featureName?: string | null) => [
  baseline({ name, featureName }),
];
const names = (checks: TestVariation[][]) => checks.map((c) => c[0].name);

describe("baselineSections (068)", () => {
  it("puts the checks of a feature in its section with the count", () => {
    const sections = baselineSections([
      check("Autofill", "Envelopes"),
      check("Cash loan", "Credit"),
      check("New envelope", "Envelopes"),
    ]);
    expect(sections[1]).toEqual(
      expect.objectContaining({ feature: "Envelopes", count: 2 }),
    );
    expect(names(sections[1].checks)).toEqual(["Autofill", "New envelope"]);
  });

  it("orders features by name ignoring case", () => {
    const sections = baselineSections([
      check("a", "savings"),
      check("b", "Envelopes"),
      check("c", "Credit"),
    ]);
    expect(sections.map((s) => s.feature)).toEqual([
      "Credit",
      "Envelopes",
      "savings",
    ]);
  });

  it("keeps features that differ only in case apart", () => {
    const sections = baselineSections([
      check("a", "Envelopes"),
      check("b", "envelopes"),
    ]);
    expect(sections).toHaveLength(2);
  });

  it("puts checks without a feature after the sections, in no section", () => {
    const sections = baselineSections([
      check("QR checkout"),
      check("Autofill", "Envelopes"),
      check("Contactless", "  "),
    ]);
    expect(sections.map((s) => s.feature)).toEqual(["Envelopes", null]);
    expect(names(sections[1].checks)).toEqual(["QR checkout", "Contactless"]);
  });

  it("has no sections when no check has a feature", () => {
    const sections = baselineSections([check("a"), check("b")]);
    expect(sections.filter((s) => s.feature)).toEqual([]);
    expect(names(sections[0].checks)).toEqual(["a", "b"]);
  });

  it("takes the feature of the device updated last", () => {
    const devices = [
      baseline({ featureName: "Deposits", updatedAt: "2026-11-01T10:00:00Z" }),
      baseline({ featureName: "Savings", updatedAt: "2026-11-10T10:00:00Z" }),
      baseline({ featureName: null, updatedAt: "2026-11-15T10:00:00Z" }),
    ];
    expect(featureOfCheck(devices)).toBe("Savings");
  });

  it("repeats a section split by a page with its whole count", () => {
    const sections = baselineSections([
      check("a", "Credit"),
      check("b", "Envelopes"),
      check("c", "Envelopes"),
      check("d", "Envelopes"),
      check("e"),
    ]);
    const first = pageOfSections(sections, 1, 2);
    const second = pageOfSections(sections, 2, 2);
    const third = pageOfSections(sections, 3, 2);
    expect(first.map((s) => [s.feature, s.count, names(s.checks)])).toEqual([
      ["Credit", 1, ["a"]],
      ["Envelopes", 3, ["b"]],
    ]);
    expect(second.map((s) => [s.feature, s.count, names(s.checks)])).toEqual([
      ["Envelopes", 3, ["c", "d"]],
    ]);
    expect(third.map((s) => [s.feature, names(s.checks)])).toEqual([
      [null, ["e"]],
    ]);
  });

  it("finds every check of a feature whose name holds the query", () => {
    const envelope = baseline({ name: "Autofill", featureName: "Конверти" });
    expect(matchesBaselineQuery(envelope, "конв")).toBe(true);
    expect(matchesBaselineQuery(envelope, "Auto")).toBe(true);
    expect(matchesBaselineQuery(envelope, "Кредит")).toBe(false);
    expect(matchesBaselineQuery(baseline({ name: "Autofill" }), "")).toBe(true);
  });
});
