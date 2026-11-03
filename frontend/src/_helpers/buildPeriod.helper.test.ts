import { buildDuration, buildPeriod } from "./buildPeriod.helper";
import { DICTIONARIES } from "../i18n/dictionaries";
import { formatDate, translate } from "../i18n/translate";
import { Text } from "../i18n";

const ukrainian: Text = (key, params) =>
  translate(DICTIONARIES, "uk", key, params);
const inUkrainian = {
  t: ukrainian,
  formatDate: (value: string | number | Date, options?: object) =>
    formatDate(value, "uk", options),
};

describe("when the build ran", () => {
  it("shows the start and the end, the end without the date on the same day", () => {
    expect(
      buildPeriod(
        new Date(2026, 9, 29, 13, 57, 12),
        new Date(2026, 9, 29, 13, 57, 14),
        inUkrainian,
      ),
    ).toBe("29.10.2026, 13:57:12 – 13:57:14");
    expect(
      buildPeriod(
        new Date(2026, 9, 29, 23, 59, 0),
        new Date(2026, 9, 30, 0, 1, 0),
        inUkrainian,
      ),
    ).toBe("29.10.2026, 23:59:00 – 30.10.2026, 00:01:00");
  });

  it("shows the start alone until the build runs on", () => {
    const start = new Date(2026, 9, 29, 13, 57, 12);
    expect(buildPeriod(start, start, inUkrainian)).toBe("29.10.2026, 13:57:12");
    expect(buildPeriod(start, null, inUkrainian)).toBe("29.10.2026, 13:57:12");
  });
});

describe("how long the build ran", () => {
  const start = new Date(2026, 10, 2, 18, 46, 21);
  const after = (seconds: number) => new Date(start.getTime() + seconds * 1000);

  it("says hours and minutes, minutes and seconds, or seconds alone", () => {
    expect(buildDuration(start, after(214), ukrainian)).toBe("3 хв 34 с");
    expect(buildDuration(start, after(720), ukrainian)).toBe("12 хв");
    expect(buildDuration(start, after(3900), ukrainian)).toBe("1 год 5 хв");
    expect(buildDuration(start, after(7200), ukrainian)).toBe("2 год");
    expect(buildDuration(start, after(45), ukrainian)).toBe("45 с");
    expect(buildDuration(start, after(214))).toBe("3 min 34 s");
  });

  it("says nothing for a build that has not run on since it started", () => {
    expect(buildDuration(start, start)).toBeNull();
    expect(buildDuration(start, after(0.5))).toBeNull();
    expect(buildDuration(start, null)).toBeNull();
  });
});
