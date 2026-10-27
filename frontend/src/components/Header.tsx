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
import { LanguageSwitch, useT } from "../i18n";
import { ManualChecksDialog } from "./ManualChecksDialog";
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
  PhoneAndroid,
  GitHub,
  HelpOutline,
  People,
  Backup,
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
  const { t } = useT();
  const [manualChecksOpen, setManualChecksOpen] = React.useState(false);
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
      <MenuItem
        onClick={() => {
          handleMenuClose();
          setManualChecksOpen(true);
        }}
        style={styleMenuItem}
      >
        <IconButton size="small">
          <PhoneAndroid />
        </IconButton>
        {t("header.manualChecks")}
      </MenuItem>
      {BRAND.supportUrl && (
        <MenuItem onClick={closeMenuAndOpenLink} style={styleMenuItem}>
          <IconButton size="small">
            <GitHub />
          </IconButton>
          {t("header.reportProblem")}
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
          {t("header.users")}
        </MenuItem>
      )}
      {user?.role === "admin" && (
        <MenuItem
          component={Link}
          to={routes.BACKUPS_PAGE}
          onClick={handleMenuClose}
          style={styleMenuItem}
          data-testid="backupsMenuItem"
        >
          <IconButton size="small">
            <Backup />
          </IconButton>
          {t("header.backups")}
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
        {t("header.projects")}
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
        {t("header.profile")}
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
        {t("header.logout")}
      </MenuItem>
    </Menu>
  );

  return (
    <React.Fragment>
      <AppBar position="static">
        <Toolbar variant="dense" sx={{ minHeight: 56, gap: 1.5 }}>
          <Link
            to="/"
            aria-label={t("header.home", { brand: BRAND.name })}
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
          <LanguageSwitch />
          <IconButton
            onClick={(event: React.MouseEvent<HTMLElement>) =>
              setHelpMenuRef(event.currentTarget)
            }
            aria-label={t("header.help")}
            data-testid={HEADER_HELP_MENU_BUTTON_TEST_ID}
          >
            <HelpOutline />
          </IconButton>
          {loggedIn && (
            <IconButton
              onClick={(event: React.MouseEvent<HTMLElement>) =>
                setAvatarMenuRef(event.currentTarget)
              }
              aria-label={t("header.account")}
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
      <ManualChecksDialog
        open={manualChecksOpen}
        onClose={() => setManualChecksOpen(false)}
      />
    </React.Fragment>
  );
};

export default Header;
