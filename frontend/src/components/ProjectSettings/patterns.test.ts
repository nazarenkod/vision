import { ProjectVocabulary } from "../../types/insights";
import {
  classCoverage,
  compilePattern,
  conditionSuggestions,
  searchElements,
  selectorSeen,
} from "./patterns";

const element = (
  id: string,
  screens: number[],
  fields: Partial<ProjectVocabulary["elements"][number]> = {},
) => ({
  selector: `id:${id.replace(/^.*:id\//, "")}`,
  element: id,
  className: "android.widget.Button",
  text: "",
  label: "",
  screens,
  ...fields,
});

const vocabulary: ProjectVocabulary = {
  trees: 3,
  screens: ["Онбординг 1", "Онбординг 2", "Платежі"],
  elements: [
    element("com.bank:id/tab_0", [0, 1, 2]),
    element("com.bank:id/tab_1", [0, 1, 2]),
    element("Toolbar#PbButton", [2], {
      className: "android.widget.ImageButton",
      label: "Закрити",
    }),
    element("com.bank:id/clock", [0, 1, 2], {
      className: "android.widget.TextView",
      text: "12:30",
    }),
  ],
  classes: [
    { name: "Button", screens: 3 },
    { name: "TextView", screens: 3 },
  ],
  titleCandidates: [],
};

describe("compilePattern", () => {
  it("reads globs as whole values in any case and /regex/ as written", () => {
    expect(compilePattern("*#pbbutton")?.test("Toolbar#PbButton")).toBe(true);
    expect(compilePattern("*#PbButton")?.test("Toolbar#PbButton2")).toBe(false);
    expect(compilePattern("/^.*:id\\/(tab)_\\d+$/")?.test("x:id/tab_1")).toBe(
      true,
    );
    expect(compilePattern("/(/")).toBeNull();
  });
});

describe("classCoverage", () => {
  it("counts the elements and screens a class takes", () => {
    expect(
      classCoverage({ element: ["/^.*:id\\/(tab)_\\d+$/"] }, vocabulary),
    ).toEqual({
      elements: 2,
      screens: 3,
      examples: ["com.bank:id/tab_0", "com.bank:id/tab_1"],
    });
    // every field filled must match; a screen condition narrows the screens
    expect(
      classCoverage(
        { element: ["*tab_*"], screen: ["Онбординг*"] },
        vocabulary,
      ),
    ).toMatchObject({ elements: 2, screens: 2 });
    expect(
      classCoverage(
        { className: ["*ImageButton"], label: ["/^Закрити$/"] },
        vocabulary,
      ),
    ).toMatchObject({ elements: 1, screens: 1 });
  });

  it("takes nothing without a condition, as the server does", () => {
    expect(classCoverage({ element: [" "] }, vocabulary).elements).toBe(0);
  });
});

describe("conditionSuggestions", () => {
  it("suggests values of the project for a class condition", () => {
    expect(conditionSuggestions("screen", vocabulary, "онб")).toEqual([
      "Онбординг 1",
      "Онбординг 2",
    ]);
    expect(conditionSuggestions("label", vocabulary)).toEqual(["Закрити"]);
    expect(conditionSuggestions("className", vocabulary)[0]).toBe(
      "android.widget.Button",
    );
  });
});

describe("searchElements", () => {
  it("finds elements by id, class or text, most common first, with the selector a rule uses", () => {
    const found = searchElements(vocabulary, "12:3");
    expect(found).toEqual([
      { selector: "id:clock", description: 'TextView "12:30"', screens: 3 },
    ]);
    expect(
      searchElements(vocabulary, "textview").map((o) => o.selector),
    ).toEqual(["class:TextView", "id:clock"]);
  });

  it("tells a selector the recent trees do not have", () => {
    expect(selectorSeen("id:clock", vocabulary)).toBe(true);
    expect(selectorSeen("id:gone", vocabulary)).toBe(false);
    expect(selectorSeen("class:android.widget.TextView", vocabulary)).toBe(
      true,
    );
  });
});
