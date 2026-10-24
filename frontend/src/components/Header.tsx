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
import { BRAND } from "../constants/brand";
import { BrandMark } from "./BrandMark";
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
    window.open(BRAND.supportUrl, "_blank", "noopener");
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
      {BRAND.supportUrl && (
        <MenuItem onClick={closeMenuAndOpenLink} style={styleMenuItem}>
          <IconButton size="small">
            <GitHub />
          </IconButton>
          Report a problem
        </MenuItem>
      )}
      <hr />
      <MenuItem
        style={{
          justifyContent: "center",
        }}
        disabled
      >
        {BRAND.name} {getVRTVersion()}
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
            aria-label={`${BRAND.name} home`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <BrandMark size={32} />
            <Typography component="span" sx={{ fontWeight: 700, fontSize: 16 }}>
              {BRAND.name}
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
