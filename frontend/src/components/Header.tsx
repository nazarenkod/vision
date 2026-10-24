import React, { FunctionComponent } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
} from "@mui/material";
import { Link } from "react-router-dom";
import { useUserDispatch, useUserState, logout } from "../contexts";
import { routes } from "../constants";
import GuidedTour from "./GuidedTour";
import {
  HEADER_HELP_MENU_ID,
  HEADER_AVATAR_MENU_ID,
  HEADER_AVATAR_BUTTON_TEST_ID,
  HEADER_HELP_MENU_BUTTON_TEST_ID,
  HEADER_LOGOUT_BUTTON_TEST_ID,
} from "./Header.locators";
import {
  AllInbox,
  Face,
  GitHub,
  HelpOutline,
  People,
  SettingsPower,
} from "@mui/icons-material";

const Header: FunctionComponent = () => {
  const [avatarMenuRef, setAvatarMenuRef] = React.useState<null | HTMLElement>(
    null,
  );

  const [helpMenuRef, setHelpMenuRef] = React.useState<null | HTMLElement>(
    null,
  );

  const { loggedIn, user } = useUserState();
  const authDispatch = useUserDispatch();

  const styleMenuItem = {
    display: "flex",
    alignItems: "center",
  };

  const handleMenuClose = () => {
    setAvatarMenuRef(null);
    setHelpMenuRef(null);
  };

  const closeMenuAndOpenLink = () => {
    handleMenuClose();
    window.open(
      "https://github.com/Visual-Regression-Tracker/Visual-Regression-Tracker/issues/new",
      "_blank",
    );
  };

  const getVRTVersion = (): string => {
    return window._env_.VRT_VERSION;
  };

  const renderHelpMenu = (
    <Menu
      anchorEl={helpMenuRef}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      data-testid={HEADER_HELP_MENU_ID}
      keepMounted
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      open={!!helpMenuRef}
      onClose={handleMenuClose}
    >
      <MenuItem onClick={handleMenuClose}>
        <GuidedTour />
      </MenuItem>
      <MenuItem onClick={closeMenuAndOpenLink} style={styleMenuItem}>
        <IconButton size="small">
          <GitHub />
        </IconButton>
        Open an issue in GitHub
      </MenuItem>
      <hr />
      <MenuItem
        style={{
          justifyContent: "center",
        }}
        disabled
      >
        VRT Version : {getVRTVersion()}
      </MenuItem>
    </Menu>
  );

  const renderAvatarMenu = (
    <Menu
      anchorEl={avatarMenuRef}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      id={HEADER_AVATAR_MENU_ID}
      keepMounted
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      open={!!avatarMenuRef}
      onClose={handleMenuClose}
    >
      {user?.role === "admin" && (
        <MenuItem
          component={Link}
          to={routes.USER_LIST_PAGE}
          onClick={handleMenuClose}
          style={styleMenuItem}
        >
          <IconButton size="small">
            <People />
          </IconButton>
          Users
        </MenuItem>
      )}
      <MenuItem
        component={Link}
        to={routes.PROJECT_LIST_PAGE}
        onClick={handleMenuClose}
        style={styleMenuItem}
      >
        <IconButton size="small">
          <AllInbox />
        </IconButton>
        Projects
      </MenuItem>
      <MenuItem
        component={Link}
        to={routes.PROFILE_PAGE}
        onClick={handleMenuClose}
        style={styleMenuItem}
      >
        <IconButton size="small">
          <Face />
        </IconButton>
        Profile
      </MenuItem>
      <MenuItem
        onClick={() => {
          handleMenuClose();
          logout(authDispatch);
        }}
        data-testid={HEADER_LOGOUT_BUTTON_TEST_ID}
      >
        <IconButton size="small">
          <SettingsPower />
        </IconButton>
        Logout
      </MenuItem>
    </Menu>
  );

  return (
    <React.Fragment>
      <AppBar position="static">
        <Toolbar variant="dense" sx={{ minHeight: 56, gap: 1.5 }}>
          <Link
            to="/"
            aria-label="Visual Tracker home"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "9px",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <rect x="2.5" y="4" width="7" height="12" rx="1.5" />
                <rect x="10.5" y="4" width="7" height="12" rx="1.5" />
                <path d="M12.5 10h3" />
              </svg>
            </Box>
            <Typography component="span" sx={{ fontWeight: 700, fontSize: 16 }}>
              Visual Tracker
            </Typography>
          </Link>
          <Box sx={{ flex: 1 }} />
          <IconButton
            onClick={(event: React.MouseEvent<HTMLElement>) =>
              setHelpMenuRef(event.currentTarget)
            }
            aria-label="Help"
            data-testid={HEADER_HELP_MENU_BUTTON_TEST_ID}
          >
            <HelpOutline />
          </IconButton>
          {loggedIn && (
            <IconButton
              onClick={(event: React.MouseEvent<HTMLElement>) =>
                setAvatarMenuRef(event.currentTarget)
              }
              aria-label="Account"
              data-testid={HEADER_AVATAR_BUTTON_TEST_ID}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: 13,
                  fontWeight: 600,
                  bgcolor: "primary.light",
                  color: "primary.main",
                }}
              >{`${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`}</Avatar>
            </IconButton>
          )}
        </Toolbar>
      </AppBar>
      {renderAvatarMenu}
      {renderHelpMenu}
    </React.Fragment>
  );
};

export default Header;
