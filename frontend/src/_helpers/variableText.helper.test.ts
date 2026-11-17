import {
  expectedOf,
  fitsParts,
  leftOutFor,
  leftOutMarks,
  otherDiffers,
  textOnScreen,
  wordsOnly,
  partsOf,
  patternFor,
  placesIn,
  splitPieces,
  variableCount,
  variableSelector,
  variableShown,
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

describe("what a variable-text rule leaves out (spec 066)", () => {
  const button = { x: 100, y: 1000, width: 300, height: 100 };
  const text = { x: 200, y: 1020, width: 180, height: 60 };

  it("marks the text parts hatched, with no frame round the element", () => {
    const rule = {
      leftOut: [
        { side: "current" as const, element: button, areas: [text] },
        {
          side: "baseline" as const,
          element: button,
          areas: [button],
          reason: "resized" as const,
        },
      ],
    };
    // the hatch only, no frame round the element (REQ-072-07)
    expect(leftOutMarks(rule, "current")).toEqual([
      { rect: text, mark: "hatch", element: button },
    ]);
    expect(leftOutMarks(rule, "baseline")).toEqual([
      { rect: button, mark: "hatch", element: button },
    ]);
    expect(leftOutMarks({}, "current")).toBeNull();
    expect(leftOutFor(rule, "current", { ...button })?.areas).toEqual([text]);
    expect(leftOutFor(rule, "current", text)).toBeUndefined();
  });

  it("marks the found pieces of a merged element hatched", () => {
    const row = { x: 40, y: 400, width: 1000, height: 270 };
    const sum = { x: 880, y: 420, width: 100, height: 40 };
    const time = { x: 400, y: 480, width: 80, height: 30 };
    const rule = {
      leftOut: [
        {
          side: "current" as const,
          element: row,
          areas: [sum, time],
          located: true,
        },
      ],
    };
    expect(leftOutMarks(rule, "current")).toEqual([
      { rect: sum, mark: "hatch", element: row },
      { rect: time, mark: "hatch", element: row },
    ]);
  });

  it("tells a check of words only", () => {
    expect(wordsOnly(marking("Історія", "Історія"))).toBe(true);
    expect(wordsOnly(marking("Олена Петренко", "Олена", "Петренко"))).toBe(
      true,
    );
    expect(wordsOnly(marking("Привіт, Олена", "Олена"))).toBe(false);
    expect(wordsOnly(marking("₴ 1 250,00", "₴", "1 250,00"))).toBe(false);
    expect(
      wordsOnly(marking("11 серпня, 11:41", "11", "серпня", "11:41")),
    ).toBe(false);
    expect(wordsOnly([{ text: "Історія" }])).toBe(false);
    expect(wordsOnly([{ pattern: "\\p{L}+" }])).toBe(true);
    expect(wordsOnly([{ pattern: "\\d+" }])).toBe(false);
  });
});

describe("textOnScreen", () => {
  const rect = { x: 0, y: 0, width: 10, height: 10 };
  const tile = {
    index: 1,
    parent: null,
    selector: "text:Додати сервіс або шаблон",
    element: "View",
    bounds: rect,
    text: "Додати сервіс або шаблон",
    labelOnly: true,
  };
  const icon = {
    index: 2,
    parent: 1,
    selector: "id:plus",
    element: "Image",
    bounds: rect,
    text: "plus",
    labelOnly: true,
  };
  const label = {
    index: 3,
    parent: 1,
    selector: "text:Додати",
    element: "TextView",
    bounds: rect,
    text: "Додати",
  };
  const elsewhere = { ...label, index: 4, parent: null, selector: "text:Інше" };

  it("finds the one text drawn inside an element whose own text is a label", () => {
    expect(textOnScreen(tile, [tile, icon, label, elsewhere])).toBe(label);
  });

  it("finds nothing for an element with a drawn text or several texts inside", () => {
    expect(
      textOnScreen({ ...tile, labelOnly: undefined }, [tile, label]),
    ).toBeNull();
    const second = { ...label, index: 5, selector: "text:сервіс" };
    expect(textOnScreen(tile, [tile, label, second])).toBeNull();
  });
});

describe("variableCount", () => {
  // the bank's history: every row has the same id, its text only in the label
  const rows = [
    "На свою картку *7101 -5.03 UAH 11 серпня, 11:41",
    "Зі своєї картки *8353 +5.00 UAH 11 серпня, 11:25",
    "Зі своєї картки *1050 +1.01 UAH 17 серпня, 13:59",
  ].map((text) => ({ selector: "id:activity_list_item", text }));
  const parts = marking(
    "Зі своєї картки *1050 +1.01 UAH 17 серпня, 13:59",
    "1050",
    "+1.01",
    "17",
    "серпня",
    "13:59",
  );

  it("counts by id only the elements that keep the fixed text", () => {
    expect(variableCount("id:activity_list_item", parts, rows)).toBe(2);
    // nothing marked yet: every row with the id
    expect(variableCount("id:activity_list_item", [], rows)).toBe(3);
    expect(
      variableCount("xpath://*[@resource-id='list']/*[1]", parts, rows),
    ).toBeNull();
  });
});

describe("otherDiffers", () => {
  const row = "Зі своєї картки *1051 +1.05 UAH 17 серпня, 13:59";
  const baseline = "Зі своєї картки *1050 +1.01 UAH 17 серпня, 13:59";

  it("names the words of the other text that differ where nothing is marked", () => {
    expect(otherDiffers(marking(row, "13:59"), row, baseline)).toEqual({
      words: ["*1050", "+1.01"],
    });
    expect(
      otherDiffers(marking(row, "1051", "+1.05", "13:59"), row, baseline),
    ).toBeNull();
  });

  it("tells a marked value of another kind on the other text", () => {
    const updated = "Updated at 14:07";
    expect(
      otherDiffers(marking(updated, "14:07"), updated, "Updated at 6 pm"),
    ).toEqual({ value: "6 pm" });
  });
});

describe("variableShown", () => {
  it("shows the baseline value crossed out before the current one", () => {
    const parts = marking("Зі своєї картки 1051 UAH", "1051");
    expect(
      variableShown(
        parts,
        "Зі своєї картки 2122 UAH",
        "Зі своєї картки 3030 UAH",
      ),
    ).toEqual([
      { text: "Зі своєї картки ", place: false },
      { text: "2122", place: true, was: "3030" },
      { text: " UAH", place: false },
    ]);
    // without the baseline's text, the value the rule was made from
    expect(variableShown(parts, "Зі своєї картки 2122 UAH")[1]).toEqual({
      text: "2122",
      place: true,
      was: "1051",
    });
    // the same value is shown once
    expect(
      variableShown(
        parts,
        "Зі своєї картки 1051 UAH",
        "Зі своєї картки 1051 UAH",
      )[1],
    ).toEqual({ text: "1051", place: true });
  });
});
