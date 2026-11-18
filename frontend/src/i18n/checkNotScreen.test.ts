import { en } from "./en";
import { uk } from "./uk";
import { translate } from "./translate";

const dictionaries = { en, uk } as unknown as Parameters<typeof translate>[0];

// "screen" stays only where it is the device's or the app's screen (REQ-057-05);
// a build result is a check and its image a screenshot (REQ-057-01, REQ-057-04)
const LITERAL_SCREEN = new Set([
  "explainer.diffDimensions", // a device with a taller screen
  "section.mobile",
  "section.mobileFormer",
  "general.newProjectHint",
  "comparison.lookSameHelp", // text-heavy screens of the app
  "changes.mostOfScreen", // most of the app's screen changed (REQ-074-30)
  "mobile.title",
  "a11y.reader.screenReader",
  "filters.viewport",
  "review.fit",
  "review.attr.viewport",
  "select.shownText", // the text drawn on the device screen, not a label (REQ-066-08)
  // an accessibility problem names the app screen its tree titles
  "panel.elsewhereIgnored",
  "panel.elsewhereFiling",
  "panel.elsewhereFiled",
  "panel.onScreen",
  "bug.everyScreen",
  "bug.description",
  "bug.existingFiled",
  "bug.existingFiling",
  "bug.existingIgnored",
  "brand.tagline",
  "tour.variationsTitle",
  "manual.intro",
  "manual.step3",
  "manual.sources",
  "manual.many",
  "device.viewport",
  "reportBug.stepsPlaceholder",
]);

const textsOf = (value: unknown) =>
  typeof value === "string" ? [value] : Object.values(value as object);

const keysSaying = (dictionary: object, word: RegExp) =>
  Object.entries(dictionary)
    .filter(([, value]) =>
      textsOf(value).some((text) => word.test(text.replace(/\{\w+\}/g, ""))),
    )
    .map(([key]) => key);

describe("a build result is a check, not a screen", () => {
  it("says screen only for the device's or the app's screen", () => {
    const allowed = (key: string) => !LITERAL_SCREEN.has(key);
    expect(keysSaying(en, /\bscreens?\b/i).filter(allowed)).toEqual([]);
    expect(keysSaying(uk, /екран/i).filter(allowed)).toEqual([]);
    // and the list holds no key that no longer says it
    const literal = new Set([
      ...keysSaying(en, /\bscreens?\b/i),
      ...keysSaying(uk, /екран/i),
    ]);
    expect([...LITERAL_SCREEN].filter((key) => !literal.has(key))).toEqual([]);
  });

  it("names the build tab and the rule scope a check in both languages", () => {
    for (const [key, english, ukrainian] of [
      ["builds.allTests", "All checks", "Усі перевірки"],
      ["select.thisScreen", "This check", "Ця перевірка"],
      ["select.allScreens", "All checks", "Усі перевірки"],
    ] as const) {
      expect(translate(dictionaries, "en", key)).toBe(english);
      expect(translate(dictionaries, "uk", key)).toBe(ukrainian);
    }
  });

  it("counts checks by the plural forms of each language", () => {
    const approve = (language: "en" | "uk", count: number) =>
      translate(dictionaries, language, "undo.approvedMany", { count });
    expect(approve("uk", 1)).toBe("Прийнято 1 перевірку");
    expect(approve("uk", 3)).toBe("Прийнято 3 перевірки");
    expect(approve("uk", 5)).toBe("Прийнято 5 перевірок");
    expect(approve("en", 1)).toBe("Approved 1 check");
    expect(approve("en", 3)).toBe("Approved 3 checks");
    expect(
      translate(dictionaries, "uk", "groups.sameOnScreens", { count: 4 }),
    ).toBe("Однаково змінилося в 4 перевірках");
  });
});
