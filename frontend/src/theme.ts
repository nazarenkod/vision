import { createTheme, Theme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";
import { ukUA as ukUAGrid } from "@mui/x-data-grid/locales";
import { GrowFromPointer } from "./components/motion/GrowFromPointer";

// Two themes (ADR-0015). Light (A) sits next to the company's other internal
// tools: white surfaces on a faintly green neutral ground, thin borders instead
// of shadows, one green for the main action. Dark (B) puts screenshots on a lit
// table and lets the interface step back. Colours that carry meaning live here,
// so a screen never picks its own.
export type ThemeMode = "light" | "dark";

type Status = { fg: string; bg: string; bar: string };
export type Palette = {
  ground: string;
  surface: string;
  subtle: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  brand: string;
  brandDark: string;
  brandSoft: string;
  // text and icons drawn on the brand colour
  brandInk: string;
  // reserved for visual differences, never used for anything else
  diff: string;
  diffSoft: string;
  // accessibility issues drawn over screenshots
  a11y: string;
  a11ySoft: string;
  a11yExisting: string;
  // the field screenshots lie on
  lightbox: string;
  scrim: string;
  shadowPop: string;
  shadowShot: string;
  status: {
    changed: Status;
    new: Status;
    failed: Status;
    passed: Status;
    neutral: Status;
  };
};

export const palettes: Record<ThemeMode, Palette> = {
  light: {
    ground: "#F5F7F6",
    surface: "#FFFFFF",
    subtle: "#F0F3F1",
    border: "#E2E7E4",
    borderStrong: "#CED6D1",
    text: "#101A14",
    textSecondary: "#3F4B45",
    textMuted: "#5B6861",
    brand: "#237A30",
    brandDark: "#1A5C24",
    brandSoft: "#E8F3EA",
    brandInk: "#FFFFFF",
    diff: "#C11574",
    diffSoft: "rgba(193, 21, 116, 0.12)",
    a11y: "#DC6803",
    a11ySoft: "rgba(220, 104, 3, 0.10)",
    a11yExisting: "#98A2B3",
    lightbox: "#F0F3F1",
    scrim: "rgba(8, 14, 11, 0.42)",
    shadowPop: "0 16px 40px -12px rgba(16, 24, 20, 0.28)",
    shadowShot: "0 1px 3px rgba(16, 24, 20, 0.14)",
    status: {
      changed: { fg: "#B54708", bg: "#FFF6E6", bar: "#F79009" },
      new: { fg: "#175CD3", bg: "#EFF8FF", bar: "#2E90FA" },
      failed: { fg: "#B42318", bg: "#FEF3F2", bar: "#F04438" },
      passed: { fg: "#067647", bg: "#ECFDF3", bar: "#47CD89" },
      neutral: { fg: "#475467", bg: "#F2F4F7", bar: "#98A2B3" },
    },
  },
  dark: {
    ground: "#0F1211",
    surface: "#151918",
    subtle: "#1C2220",
    border: "#272E2B",
    borderStrong: "#36403C",
    text: "#E5ECE8",
    textSecondary: "#B3BDB8",
    textMuted: "#929E98",
    brand: "#43C46A",
    brandDark: "#5BD27E",
    brandSoft: "#163021",
    brandInk: "#06140B",
    diff: "#F0529E",
    diffSoft: "rgba(240, 82, 158, 0.16)",
    a11y: "#F79009",
    a11ySoft: "rgba(247, 144, 9, 0.16)",
    a11yExisting: "#7D8984",
    lightbox: "radial-gradient(120% 90% at 50% 40%, #2A3330 0%, #171C1A 70%)",
    scrim: "rgba(0, 0, 0, 0.62)",
    shadowPop: "0 18px 50px -12px rgba(0, 0, 0, 0.7)",
    shadowShot:
      "0 0 0 1px rgba(255, 255, 255, 0.06), 0 14px 40px -12px rgba(140, 255, 180, 0.16)",
    status: {
      changed: { fg: "#FDB022", bg: "rgba(247, 144, 9, 0.14)", bar: "#F79009" },
      new: { fg: "#53B1FD", bg: "rgba(46, 144, 250, 0.14)", bar: "#2E90FA" },
      failed: { fg: "#F97066", bg: "rgba(240, 68, 56, 0.14)", bar: "#F04438" },
      passed: { fg: "#47CD89", bg: "rgba(71, 205, 137, 0.14)", bar: "#47CD89" },
      neutral: {
        fg: "#B3BDB8",
        bg: "rgba(255, 255, 255, 0.07)",
        bar: "#7D8984",
      },
    },
  },
};

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/** `status.changed.fg` → `--v-status-changed-fg` */
const variableName = (path: string[]) => `--v-${path.join("-")}`;

type Tokens = Omit<Palette, "status"> & {
  status: Palette["status"];
  mono: string;
};

function referTo(value: unknown, path: string[]): unknown {
  if (typeof value === "string") return `var(${variableName(path)})`;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
      key,
      referTo(inner, [...path, key]),
    ]),
  );
}

/**
 * What components put into `sx`: references to CSS variables, so the same
 * `tokens.border` works in both themes. Canvas and colour maths need real
 * values: take them from `palettes[mode]` (see `useTokens`).
 */
export const tokens: Tokens = {
  ...(referTo(palettes.light, []) as Palette),
  mono: MONO,
};

/** The CSS variables of one theme, for the global stylesheet. */
export function cssVariables(mode: ThemeMode): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (value: unknown, path: string[]) => {
    if (typeof value === "string") out[variableName(path)] = value;
    else
      Object.entries(value as Record<string, unknown>).forEach(([key, inner]) =>
        walk(inner, [...path, key]),
      );
  };
  walk(palettes[mode], []);
  return out;
}

/**
 * One motion system for both themes. Interface moves take 180–320 ms with a
 * fast start and a long soft stop; screenshots never move once shown.
 */
export const motion = {
  fast: 180,
  base: 220,
  nav: 240,
  slow: 320,
  // status bar fill, counters
  fill: 600,
  // a cascade of rows: each starts this much after the one before
  stagger: 34,
  // the last row of a cascade has to be in place by then
  cascadeEnd: 700,
  easing: "cubic-bezier(.16, 1, .3, 1)",
  // the theme circle: a soft edge that sets off at once and settles softly
  reveal: 700,
  revealEasing: "cubic-bezier(.3, .1, .5, 1)",
  exit: "cubic-bezier(.4, 0, 1, 1)",
  spring: "cubic-bezier(.34, 1.5, .64, 1)",
  ms: (value: number) => `${value}ms`,
};

export function createAppTheme(
  mode: ThemeMode,
  language: "en" | "uk" = "en",
): Theme {
  const theme = themeFor(mode);
  // MUI's own texts (pagination, "No options", the data grid) in Ukrainian
  return language === "uk" ? createTheme(theme, ukUAGrid) : theme;
}

function themeFor(mode: ThemeMode): Theme {
  const p = palettes[mode];
  return createTheme({
    palette: {
      mode,
      primary: {
        main: p.brand,
        dark: p.brandDark,
        light: p.brandSoft,
        contrastText: p.brandInk,
      },
      secondary: { main: p.textSecondary, contrastText: p.surface },
      success: { main: p.status.passed.fg },
      warning: { main: p.status.changed.fg },
      error: { main: p.status.failed.fg },
      info: { main: p.status.new.fg },
      background: { default: p.ground, paper: p.surface },
      text: { primary: p.text, secondary: p.textSecondary },
      divider: p.border,
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSize: 14,
      h4: { fontSize: 24, fontWeight: 650, letterSpacing: "-0.01em" },
      h5: { fontSize: 20, fontWeight: 650, letterSpacing: "-0.01em" },
      h6: { fontSize: 16, fontWeight: 650 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    transitions: {
      easing: {
        easeInOut: motion.easing,
        easeOut: motion.easing,
        easeIn: motion.exit,
        sharp: motion.easing,
      },
      duration: {
        shortest: motion.fast,
        shorter: motion.fast,
        short: motion.base,
        standard: motion.nav,
        complex: motion.slow,
        enteringScreen: motion.slow,
        leavingScreen: 200,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: tokens.ground, color: tokens.text },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: "default" },
        styleOverrides: {
          root: {
            backgroundColor: tokens.surface,
            borderBottom: `1px solid ${tokens.border}`,
            color: tokens.text,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
          elevation1: {
            boxShadow: "none",
            border: `1px solid ${tokens.border}`,
          },
          elevation8: {
            boxShadow: tokens.shadowPop,
            border: `1px solid ${tokens.border}`,
          },
          elevation24: { boxShadow: tokens.shadowPop },
        },
      },
      MuiCard: {
        defaultProps: { variant: "outlined" },
        styleOverrides: {
          root: { borderRadius: 12, borderColor: tokens.border },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: `background-color ${motion.base}ms ${motion.easing}, border-color ${motion.base}ms ${motion.easing}, color ${motion.base}ms ${motion.easing}, transform 120ms ${motion.easing}`,
            "&:active": { transform: "scale(.97)" },
          },
          outlined: {
            borderColor: tokens.borderStrong,
            color: tokens.text,
            "&:hover": {
              borderColor: tokens.brand,
              color: tokens.brand,
              backgroundColor: "transparent",
            },
          },
        },
      },
      MuiDialog: {
        defaultProps: { TransitionComponent: GrowFromPointer },
        styleOverrides: {
          paper: { borderRadius: 14, border: `1px solid ${tokens.border}` },
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: {
            "&:not(.MuiBackdrop-invisible)": { background: tokens.scrim },
          },
        },
      },
      MuiMenu: {
        styleOverrides: { paper: { borderRadius: 12 } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: { borderColor: tokens.borderStrong },
          root: {
            "&.Mui-focused": { boxShadow: `0 0 0 3px ${tokens.brandSoft}` },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: `background-color ${motion.base}ms ${motion.easing}`,
            "&.Mui-selected, &.Mui-selected:hover": {
              backgroundColor: tokens.brandSoft,
            },
            "&:hover": { backgroundColor: tokens.subtle },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: `background-color ${motion.base}ms ${motion.easing}`,
            "&.MuiTableRow-hover:hover": { backgroundColor: tokens.subtle },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: tokens.border },
          head: {
            backgroundColor: tokens.subtle,
            color: tokens.textMuted,
            fontWeight: 600,
            fontSize: 12.5,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 44 },
          indicator: {
            transition: `all ${motion.nav}ms ${motion.easing}`,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 44,
            textTransform: "none",
            fontWeight: 600,
            fontSize: 14,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: 12,
            backgroundColor: tokens.text,
            color: tokens.ground,
          },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: `1px solid ${tokens.border}`,
            backgroundColor: tokens.surface,
            "--DataGrid-rowBorderColor": tokens.border,
          },
          columnHeaders: { backgroundColor: tokens.subtle },
        },
      },
    },
  });
}

/** Kept for code and tests that render outside the theme switch. */
export const theme = createAppTheme("light");
