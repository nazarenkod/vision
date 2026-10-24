import { createTheme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

// Restrained look that sits next to the company's other internal tools: white
// surfaces on a light neutral ground, thin borders instead of shadows, one green
// for the main action. Colours that carry meaning live here, so a screen never
// picks its own.
export const tokens = {
  ground: "#F6F7F9",
  surface: "#FFFFFF",
  subtle: "#F2F4F7",
  border: "#E4E7EC",
  borderStrong: "#D0D5DD",
  text: "#101828",
  textSecondary: "#475467",
  textMuted: "#667085",
  brand: "#237A30",
  brandDark: "#1A5C24",
  brandSoft: "#EDF7EE",
  // reserved for visual differences, never used for anything else
  diff: "#C11574",
  diffSoft: "rgba(193, 21, 116, 0.12)",
  // accessibility issues drawn over screenshots
  a11y: "#DC6803",
  a11ySoft: "rgba(220, 104, 3, 0.10)",
  a11yExisting: "#98A2B3",
  status: {
    changed: { fg: "#B54708", bg: "#FFFAEB", bar: "#F79009" },
    new: { fg: "#175CD3", bg: "#EFF8FF", bar: "#2E90FA" },
    failed: { fg: "#B42318", bg: "#FEF3F2", bar: "#F04438" },
    passed: { fg: "#067647", bg: "#ECFDF3", bar: "#47CD89" },
  },
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

export const theme = createTheme({
  palette: {
    primary: {
      main: tokens.brand,
      dark: tokens.brandDark,
      light: tokens.brandSoft,
      contrastText: "#FFFFFF",
    },
    secondary: { main: "#475467", contrastText: "#FFFFFF" },
    success: { main: "#067647" },
    warning: { main: "#B54708" },
    error: { main: "#B42318" },
    info: { main: "#175CD3" },
    background: { default: tokens.ground, paper: tokens.surface },
    text: { primary: tokens.text, secondary: tokens.textSecondary },
    divider: tokens.border,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: 14,
    h4: { fontSize: 24, fontWeight: 600 },
    h5: { fontSize: 20, fontWeight: 600 },
    h6: { fontSize: 16, fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: tokens.ground } },
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
        elevation1: { boxShadow: "none", border: `1px solid ${tokens.border}` },
      },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8 },
        outlined: { borderColor: tokens.borderStrong, color: tokens.text },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 44 } } },
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
        tooltip: { fontSize: 12, backgroundColor: tokens.text },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.border}`,
          backgroundColor: tokens.surface,
        },
        columnHeaders: { backgroundColor: "#F9FAFB" },
      },
    },
  },
});
