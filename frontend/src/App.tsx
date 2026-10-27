import React from "react";
import { SnackbarProvider, closeSnackbar } from "notistack";
import { Box, IconButton } from "@mui/material";
import { Close } from "@mui/icons-material";
import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";
import Header from "./components/Header";
import NavRail from "./components/NavRail";
import { BackupWarning } from "./components/BackupWarning";
import { theme } from "./theme";
import { useUserState } from "./contexts";
import {
  UserProvider,
  ProjectProvider,
  BuildProvider,
  TestRunProvider,
  SocketProvider,
  HelpProvider,
} from "./contexts";
import Router from "./Router";

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

function App() {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <SnackbarProvider
          maxSnack={3}
          // the build list pagination sits bottom left and the test run
          // pagination bottom right, so toasts go between the two
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          action={(key) => (
            <IconButton
              size="small"
              color="inherit"
              aria-label="Dismiss notification"
              onClick={() => closeSnackbar(key)}
              data-testid="dismissNotification"
            >
              <Close fontSize="small" />
            </IconButton>
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
      </ThemeProvider>
    </StyledEngineProvider>
  );
}

export default App;
