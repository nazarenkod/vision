import { en } from "./en";
import { uk } from "./uk";
import {
  formatDate,
  formatNumber,
  initialLanguage,
  parseLocaleNumber,
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
    expect(translate(dictionaries, "en", "general.days", { count: 1 })).toBe(
      "1 day",
    );
    expect(translate(dictionaries, "uk", "general.days", { count: 1 })).toBe(
      "1 день",
    );
    expect(translate(dictionaries, "uk", "general.days", { count: 3 })).toBe(
      "3 дні",
    );
    expect(translate(dictionaries, "uk", "general.days", { count: 30 })).toBe(
      "30 днів",
    );
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
  it("starts in Ukrainian only for a Ukrainian browser", () => {
    expect(initialLanguage(null, ["uk-UA", "en"])).toBe("uk");
    expect(initialLanguage(null, ["uk"])).toBe("uk");
    expect(initialLanguage(null, ["en-US", "uk"])).toBe("en");
    expect(initialLanguage(null, ["ru"])).toBe("en");
    expect(initialLanguage(null, [])).toBe("en");
  });

  it("keeps the language picked before over the browser's", () => {
    expect(initialLanguage("en", ["uk-UA"])).toBe("en");
    expect(initialLanguage("uk", ["en-US"])).toBe("uk");
    expect(initialLanguage("de", ["en-US"])).toBe("en");
  });
});

describe("numbers and dates", () => {
  it("formats numbers and dates the Ukrainian way", () => {
    expect(formatNumber(0.1, "uk")).toBe("0,1");
    expect(formatNumber(0.1, "en")).toBe("0.1");
    expect(
      formatDate("2026-10-27T12:00:00Z", "uk", {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    ).toMatch(/27 жовт\.? 2026/);
  });

  it("reads a number typed with a comma or a point", () => {
    expect(parseLocaleNumber("0,1")).toBe(0.1);
    expect(parseLocaleNumber("0.1")).toBe(0.1);
    expect(parseLocaleNumber(" 30 ")).toBe(30);
    expect(parseLocaleNumber("abc")).toBeNaN();
    expect(parseLocaleNumber("")).toBeNaN();
  });
});
