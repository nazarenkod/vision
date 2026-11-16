import { en } from "./en";
import { uk } from "./uk";
import {
  formatDate,
  formatFixed,
  formatNumber,
  formatOrdinal,
  initialLanguage,
  placeholdersOf,
  translate,
} from "./translate";

const dictionaries = { en, uk } as unknown as Parameters<typeof translate>[0];

describe("dictionaries", () => {
  it("has every text in both languages with the same placeholders", () => {
    // tsc makes uk have every key of en; this checks what types cannot
    expect(Object.keys(uk).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      const english = en[key];
      const ukrainian = uk[key];
      const texts =
        typeof ukrainian === "string" ? [ukrainian] : Object.values(ukrainian);
      expect({ key, empty: texts.some((text) => !text?.trim()) }).toEqual({
        key,
        empty: false,
      });
      expect({ key, placeholders: placeholdersOf(ukrainian) }).toEqual({
        key,
        placeholders: placeholdersOf(english),
      });
      // a Ukrainian plural needs its one, few and many forms
      if (typeof english !== "string" && typeof ukrainian !== "string") {
        expect({ key, forms: Object.keys(ukrainian).sort() }).toEqual({
          key,
          forms: ["few", "many", "one", "other"],
        });
      }
    }
  });
});

describe("translate", () => {
  it("puts parameters in and picks the plural form of the language", () => {
    const deleted = (language: "en" | "uk", count: number) =>
      translate(dictionaries, language, "builds.deletedMany", { count });
    expect(deleted("en", 3)).toBe("3 build(s) deleted");
    expect(deleted("uk", 1)).toBe("Видалено 1 збірку");
    expect(deleted("uk", 3)).toBe("Видалено 3 збірки");
    expect(deleted("uk", 5)).toBe("Видалено 5 збірок");
    expect(deleted("uk", 21)).toBe("Видалено 21 збірку");
    expect(
      translate(dictionaries, "uk", "projectList.createdToast", {
        name: "AOS",
      }),
    ).toBe("Проєкт AOS створено");
  });

  it("falls back to English for a text it has no translation of", () => {
    const partial = { en: { hello: "Hello {name}" }, uk: {} };
    expect(translate(partial, "uk", "hello", { name: "Dmytro" })).toBe(
      "Hello Dmytro",
    );
    // never a blank: an unknown key reads as itself
    expect(translate(partial, "uk", "unknown")).toBe("unknown");
  });
});

describe("initialLanguage", () => {
  it("starts in English until someone picks Ukrainian", () => {
    expect(initialLanguage(null)).toBe("en");
    expect(initialLanguage(undefined)).toBe("en");
    expect(initialLanguage("uk")).toBe("uk");
  });

  it("keeps the language picked before, and nothing else", () => {
    expect(initialLanguage("en")).toBe("en");
    expect(initialLanguage("de")).toBe("en");
    expect(initialLanguage("")).toBe("en");
  });
});

describe("numbers and dates", () => {
  it("formats numbers and dates the Ukrainian way", () => {
    expect(formatNumber(0.1, "uk")).toBe("0,1");
    expect(formatNumber(0.1, "en")).toBe("0.1");
    // no thousands separator, so sizes and counts read as before
    expect(formatNumber(1080, "en")).toBe("1080");
    // fixed decimals as toFixed gives them, with the language's mark
    expect(formatFixed(1.2, 2, "en")).toBe("1.20");
    expect(formatFixed(1.2, 1, "uk")).toBe("1,2");
    expect(
      formatDate("2026-10-27T12:00:00Z", "uk", {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    ).toMatch(/27 жовт\.? 2026/);
  });

  it("numbers a place in a list in either language", () => {
    expect([1, 2, 3, 4, 11, 21].map((n) => formatOrdinal(n, "en"))).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "21st",
    ]);
    expect(formatOrdinal(2, "uk")).toBe("2-м");
  });
});
