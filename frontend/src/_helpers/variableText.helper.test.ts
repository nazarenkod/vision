import {
  expectedOf,
  fitsParts,
  partsOf,
  patternFor,
  placesIn,
  splitPieces,
  variableSelector,
} from "./variableText.helper";

const texts = (text: string) => splitPieces(text).map((piece) => piece.text);
const marking = (text: string, ...which: string[]) => {
  const pieces = splitPieces(text);
  const marked = new Set(
    pieces.flatMap((piece, i) => (which.includes(piece.text) ? [i] : [])),
  );
  return partsOf(text, pieces, marked);
};

describe("splitPieces", () => {
  it("splits a text into words, numbers with their separators and single signs", () => {
    expect(texts("Оновлено о 14:07")).toEqual(["Оновлено", "о", "14:07"]);
    expect(texts("₴ 12 480,50")).toEqual(["₴", "12 480,50"]);
    expect(texts("02.11.2026, 14:07")).toEqual(["02.11.2026", ",", "14:07"]);
    expect(texts("−245,90 ₴")).toEqual(["−245,90", "₴"]);
    expect(texts("Замовлення № 48213")).toEqual(["Замовлення", "№", "48213"]);
  });
});

describe("partsOf", () => {
  it("joins marked pieces with only spaces between into one place", () => {
    expect(marking("02.11, 14:07", "02.11", ",", "14:07")).toEqual([
      { pattern: "\\d+\\.\\d{2},\\s+\\d+:\\d{2}", sample: "02.11, 14:07" },
    ]);
    expect(
      marking("Платіж 1 250 ₴ зараховано 03.11", "1 250", "03.11"),
    ).toEqual([
      { text: "Платіж " },
      { pattern: "\\d{1,3}(?:\\s\\d{3})*", sample: "1 250" },
      { text: " ₴ зараховано " },
      { pattern: "\\d+\\.\\d{2}", sample: "03.11" },
    ]);
  });
});

describe("patternFor", () => {
  it("builds a pattern for a time, a date, an amount, a signed amount, a number and a word", () => {
    expect(patternFor("14:07")).toBe("\\d+:\\d{2}");
    expect(patternFor("02.11.2026")).toBe("\\d+\\.\\d{2}\\.\\d{4}");
    expect(patternFor("12 480,50")).toBe("\\d{1,3}(?:\\s\\d{3})*,\\d{2}");
    expect(patternFor("−245,90")).toBe("[+\\-−]?\\d+,\\d{2}");
    expect(patternFor("48213")).toBe("\\d+");
    expect(patternFor("Олена")).toBe("\\p{L}+");
  });

  it("accepts a value of the same shape and turns away a broken one", () => {
    const parts = marking("Оновлено о 14:07", "14:07");
    expect(fitsParts(parts, "Оновлено о 9:12")).toBe(true);
    expect(fitsParts(parts, "Оновлено о 23:59")).toBe(true);
    for (const broken of ["undefined", "NaN", "Invalid Date", "14:7", ""])
      expect(fitsParts(parts, `Оновлено о ${broken}`)).toBe(false);
    const amount = marking("₴ 12 480,50", "12 480,50");
    expect(fitsParts(amount, "₴ 99,00")).toBe(true);
    expect(fitsParts(amount, "₴ 1 250 000,00")).toBe(true);
    expect(fitsParts(amount, "₴ 12480,50")).toBe(false);
  });
});

describe("variableSelector", () => {
  const updated = marking("Оновлено о 14:07", "14:07");
  const whole = marking("02.11, 14:07", "02.11", ",", "14:07");

  it("finds by id, else by the text pattern, else by a path from an id", () => {
    expect(variableSelector({ selector: "id:tv_updated" }, updated)).toBe(
      "id:tv_updated",
    );
    const byText = variableSelector(
      { selector: "text:Оновлено о 14:07" },
      updated,
    );
    expect(byText).toBe("text:/^Оновлено\\s*о\\s*.*?$/u");
    // any value is found, so a broken one is reported instead of lost
    const regex = new RegExp((byText as string).slice(6, -2), "u");
    expect(regex.test("Оновлено о undefined")).toBe(true);
    expect(regex.test("Updated at 14:07")).toBe(false);
    expect(
      variableSelector(
        {
          selector: "text:02.11, 14:07",
          stableSelector: "xpath://*[@resource-id='app:id/row']/TextView[2]",
        },
        whole,
      ),
    ).toBe("xpath://*[@resource-id='app:id/row']/TextView[2]");
  });

  it("has no way to find a whole text without an id above it", () => {
    expect(variableSelector({ selector: "text:02.11, 14:07" }, whole)).toBe(
      null,
    );
  });
});

describe("placesIn", () => {
  it("splits a text into its fixed parts and the values in its places", () => {
    expect(
      placesIn(marking("Оновлено о 14:07", "14:07"), "Оновлено о 09:12"),
    ).toEqual([
      { text: "Оновлено о ", place: false },
      { text: "09:12", place: true },
    ]);
    expect(placesIn(marking("Оновлено о 14:07", "14:07"), "Updated")).toEqual([
      { text: "Updated", place: false },
    ]);
  });
});

describe("what is there now and what was expected", () => {
  it("shows a value that does not fit by the text around it, next to the one it was made from", () => {
    const parts = marking("Updated at 14:07", "14:07");
    expect(placesIn(parts, "Updated at undefined")).toEqual([
      { text: "Updated at ", place: false },
      { text: "undefined", place: true },
    ]);
    expect(expectedOf(parts)).toEqual([
      { text: "Updated at ", place: false },
      { text: "14:07", place: true, pattern: "\\d+:\\d{2}" },
    ]);
  });
});
