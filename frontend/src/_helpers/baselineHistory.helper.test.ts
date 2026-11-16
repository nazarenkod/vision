import { formatDate } from "../i18n/translate";
import { recordDate } from "./baselineHistory.helper";

describe("recordDate", () => {
  // a local time, so the test reads the same in any time zone
  const made = new Date(2026, 9, 12, 16, 5);

  it("puts the date and the time of a record in one line", () => {
    expect(
      recordDate(made, (value, options) => formatDate(value, "en", options)),
    ).toBe("Oct 12, 2026 · 16:05");
  });

  it("formats both parts in the interface language", () => {
    const text = recordDate(made, (value, options) =>
      formatDate(value, "uk", options),
    );
    expect(text).toMatch(/^12 жовт\.? 2026( р\.)? · 16:05$/);
  });
});
