import React from "react";
import { SnackbarProvider, closeSnackbar } from "notistack";
import { Box, GlobalStyles, IconButton } from "@mui/material";
import { Close } from "@mui/icons-material";
import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";
import Header from "./components/Header";
import NavRail from "./components/NavRail";
import { BackupWarning } from "./components/BackupWarning";
import { createAppTheme, cssVariables, motion, tokens } from "./theme";
import { useUserState } from "./contexts";
import {
  UserProvider,
  ProjectProvider,
  BuildProvider,
  TestRunProvider,
  SocketProvider,
  HelpProvider,
  ThemeModeProvider,
  useThemeMode,
} from "./contexts";
import Router from "./Router";
import { LanguageProvider, useT } from "./i18n";

// Top bar, left rail for signed-in users, and the page filling the rest.
const Shell: React.FunctionComponent = () => {
  const { loggedIn } = useUserState();
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Header />
      <BackupWarning />
      <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
        {loggedIn && <NavRail />}
        <Box component="main" sx={{ flex: 1, minWidth: 0, overflow: "auto" }}>
          <Router />
        </Box>
      </Box>
    </Box>
  );
};

// Both themes' variables, keyframes every screen shares, and the one rule that
// switches all motion off when the system asks for less of it (REQ-018-26).
const globalStyles = {
  ":root": { ...cssVariables("light"), colorScheme: "light" },
  ":root[data-theme='dark']": { ...cssVariables("dark"), colorScheme: "dark" },
  body: { backgroundColor: tokens.ground, color: tokens.text },
  "::view-transition-old(root), ::view-transition-new(root)": {
    animation: "none",
    mixBlendMode: "normal",
  },
  // the theme circle with a soft edge (themeMode.context): without the
  // registered --v-reveal the declaration is invalid and nothing is masked
  "::view-transition-new(root)": {
    maskImage:
      "radial-gradient(circle at var(--v-reveal-at, 50% 50%), #000 calc(var(--v-reveal) - var(--v-reveal-feather, 0px)), transparent var(--v-reveal))",
  },
  "@keyframes v-rise": {
    from: { opacity: 0, transform: "translateY(8px)", filter: "blur(2px)" },
    to: { opacity: 1, transform: "none", filter: "none" },
  },
  "@keyframes v-fade": { from: { opacity: 0 }, to: { opacity: 1 } },
  "@keyframes v-grow": {
    from: { opacity: 0, transform: "scale(.9)" },
    to: { opacity: 1, transform: "none" },
  },
  "@keyframes v-fill": {
    from: { clipPath: "inset(0 100% 0 0)" },
    to: { clipPath: "inset(0 0 0 0)" },
  },
  "@keyframes v-shimmer": {
    from: { backgroundPosition: "200% 0" },
    to: { backgroundPosition: "-200% 0" },
  },
  ".v-enter": {
    animation: `v-rise ${motion.base}ms ${motion.easing} both`,
    animationDelay: "var(--v-delay, 0ms)",
  },
  "@media (prefers-reduced-motion: reduce)": {
    "*, *::before, *::after": {
      animationDuration: "1ms !important",
      animationIterationCount: "1 !important",
      animationDelay: "0ms !important",
      transitionDuration: "1ms !important",
      scrollBehavior: "auto !important",
    },
  },
};

// a component of its own: the snackbar's action is a render function, not one
const DismissButton: React.FunctionComponent<{ onClick: () => void }> = ({
  onClick,
}) => {
  const { t } = useT();
  return (
    <IconButton
      size="small"
      color="inherit"
      aria-label={t("common.dismissNotification")}
      onClick={onClick}
      data-testid="dismissNotification"
    >
      <Close fontSize="small" />
    </IconButton>
  );
};

const ThemedApp: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { mode } = useThemeMode();
  const { language } = useT();
  const theme = React.useMemo(
    () => createAppTheme(mode, language),
    [mode, language],
  );
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles styles={globalStyles} />
      {children}
    </ThemeProvider>
  );
};

function App() {
  return (
    <LanguageProvider>
      <StyledEngineProvider injectFirst>
        <ThemeModeProvider>
          <ThemedApp>
            <SnackbarProvider
              maxSnack={3}
              // the build list pagination sits bottom left and the test run
              // pagination bottom right, so toasts go between the two
              anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
              action={(key) => (
                <DismissButton onClick={() => closeSnackbar(key)} />
              )}
            >
              <UserProvider>
                <ProjectProvider>
                  <BuildProvider>
                    <TestRunProvider>
                      <SocketProvider>
                        <HelpProvider>
                          <Shell />
                        </HelpProvider>
                      </SocketProvider>
                    </TestRunProvider>
                  </BuildProvider>
                </ProjectProvider>
              </UserProvider>
            </SnackbarProvider>
          </ThemedApp>
        </ThemeModeProvider>
      </StyledEngineProvider>
    </LanguageProvider>
  );
}

export default App;
