import {
  createAppTheme,
  cssVariables,
  motion,
  palettes,
  Palette,
  ThemeMode,
  tokens,
} from "./theme";

const MODES: ThemeMode[] = ["light", "dark"];

// WCAG relative luminance of an opaque colour
const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
type Rgba = [number, number, number, number];
function parse(colour: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(colour);
  if (!rgba) throw new Error(`not a colour: ${colour}`);
  const [r, g, b, a = "1"] = rgba[1].split(",").map((part) => part.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
}
/** A translucent colour as it looks over an opaque one. */
function over(top: string, bottom: string): Rgba {
  const [r, g, b, a] = parse(top);
  const [R, G, B] = parse(bottom);
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
}
const luminance = ([r, g, b]: Rgba) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function contrast(text: string, background: Rgba): number {
  const a = luminance(parse(text));
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function leaves(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, inner]) => leaves(inner, path ? `${path}.${key}` : key),
  );
}

describe("theme", () => {
  it("every token has a light and a dark value", () => {
    const light = leaves(palettes.light).map(([path]) => path);
    const dark = leaves(palettes.dark).map(([path]) => path);
    expect(dark).toEqual(light);
    for (const mode of MODES) {
      for (const [path, value] of leaves(palettes[mode])) {
        expect([path, value.trim().length > 0]).toEqual([path, true]);
      }
    }
    // components refer to the variables, so the same token works in both themes
    expect(tokens.border).toBe("var(--v-border)");
    expect(tokens.status.changed.fg).toBe("var(--v-status-changed-fg)");
    expect(Object.keys(cssVariables("dark"))).toEqual(
      Object.keys(cssVariables("light")),
    );
    expect(cssVariables("dark")["--v-status-changed-fg"]).toBe(
      palettes.dark.status.changed.fg,
    );
  });

  it("text on every surface has at least 4.5:1 in both themes", () => {
    for (const mode of MODES) {
      const p: Palette = palettes[mode];
      const surfaces = [p.ground, p.surface, p.subtle].map((s) => over(s, s));
      const texts = [p.text, p.textSecondary, p.textMuted, p.brand];
      for (const surface of surfaces) {
        for (const text of texts) {
          expect([mode, text, contrast(text, surface) >= 4.5]).toEqual([
            mode,
            text,
            true,
          ]);
        }
      }
      // status pills: their text on their own tint over a card
      for (const [name, status] of Object.entries(p.status)) {
        const pill = over(status.bg, p.surface);
        expect([mode, name, contrast(status.fg, pill) >= 4.5]).toEqual([
          mode,
          name,
          true,
        ]);
      }
      // the main button: its label on the brand colour
      expect(contrast(p.brandInk, parse(p.brand))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps magenta for differences and orange for accessibility in both themes", () => {
    const hue = (colour: string) => {
      const [r, g, b] = parse(colour).map((v) => v / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      if (!d) return 0;
      const h =
        max === r
          ? ((g - b) / d) % 6
          : max === g
            ? (b - r) / d + 2
            : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const mode of MODES) {
      const p = palettes[mode];
      expect(hue(p.diff)).toBeGreaterThan(300);
      expect(hue(p.diff)).toBeLessThan(345);
      expect(hue(p.a11y)).toBeGreaterThan(20);
      expect(hue(p.a11y)).toBeLessThan(45);
      // nothing else borrows the difference colour
      const others = leaves(p).filter(
        ([path]) => !path.startsWith("diff") && path !== "diff",
      );
      expect(others.map(([, value]) => value)).not.toContain(p.diff);
    }
  });

  it("motion durations stay between 180 and 320 ms with one easing", () => {
    for (const duration of [
      motion.fast,
      motion.base,
      motion.nav,
      motion.slow,
    ]) {
      expect(duration).toBeGreaterThanOrEqual(180);
      expect(duration).toBeLessThanOrEqual(320);
    }
    for (const mode of MODES) {
      const theme = createAppTheme(mode);
      expect(theme.transitions.easing.easeInOut).toBe(motion.easing);
      expect(theme.transitions.easing.easeOut).toBe(motion.easing);
      // MUI's palette holds the real colours of the same table
      expect(theme.palette.primary.main).toBe(palettes[mode].brand);
      expect(theme.palette.background.default).toBe(palettes[mode].ground);
    }
  });
});
