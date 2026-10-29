import {
  flippedPreference,
  isThemeHotkey,
  readPreference,
  resolveMode,
  revealCircle,
  THEME_STORAGE_KEY,
  writePreference,
} from "./themeMode.helper";

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
};

const key = (overrides: Partial<Parameters<typeof isThemeHotkey>[0]>) => ({
  key: "D",
  shiftKey: true,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  target: document.body,
  ...overrides,
});

describe("theme mode", () => {
  it("follows the system until the user picks a theme", () => {
    const storage = memory();
    expect(readPreference(storage)).toBe("system");
    expect(resolveMode(readPreference(storage), true)).toBe("dark");
    expect(resolveMode(readPreference(storage), false)).toBe("light");

    writePreference(storage, flippedPreference("dark"));
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe("light");
    // the system turning dark no longer changes the chosen theme
    expect(resolveMode(readPreference(storage), true)).toBe("light");

    writePreference(storage, "system");
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false);
    expect(resolveMode(readPreference(storage), true)).toBe("dark");
  });

  it("ignores broken or missing storage", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    expect(readPreference(throwing)).toBe("system");
    expect(() => writePreference(throwing, "dark")).not.toThrow();
    expect(readPreference(undefined)).toBe("system");
    expect(readPreference({ getItem: () => "purple" })).toBe("system");
  });

  it("toggles with Shift+D but not while typing", () => {
    expect(isThemeHotkey(key({}))).toBe(true);
    expect(isThemeHotkey(key({ key: "d" }))).toBe(true);
    expect(isThemeHotkey(key({ shiftKey: false, key: "d" }))).toBe(false);
    expect(isThemeHotkey(key({ metaKey: true }))).toBe(false);
    expect(
      isThemeHotkey(key({ target: document.createElement("input") })),
    ).toBe(false);
    expect(
      isThemeHotkey(key({ target: document.createElement("textarea") })),
    ).toBe(false);
  });
});

describe("revealCircle", () => {
  const screen = { width: 1440, height: 900 };

  it("ends with the soft edge past the farthest corner", () => {
    // the theme button in the top right corner: the farthest is bottom left
    const { feather, radius } = revealCircle(1380, 28, screen);
    expect(radius - feather).toBeGreaterThanOrEqual(Math.hypot(1380, 872));
  });

  it("starts a little open, so the click shows at once", () => {
    const { feather, from } = revealCircle(1380, 28, screen);
    expect(from).toBeGreaterThan(0);
    // the solid middle still grows from the button itself
    expect(from).toBeLessThan(feather);
  });

  it("keeps the edge soft enough to fade along a side, not flash", () => {
    expect(revealCircle(1380, 28, screen).feather).toBeGreaterThanOrEqual(180);
    // a small window still gets a soft edge, a huge one not a blur
    expect(revealCircle(10, 10, { width: 400, height: 300 }).feather).toBe(100);
    expect(revealCircle(0, 0, { width: 5000, height: 3000 }).feather).toBe(220);
  });
});
