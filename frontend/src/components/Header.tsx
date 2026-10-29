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
  Divider,
  Tooltip,
} from "@mui/material";
import { Link } from "react-router-dom";
import {
  useUserDispatch,
  useUserState,
  logout,
  useThemeMode,
} from "../contexts";
import { routes } from "../constants";
import GuidedTour from "./GuidedTour";
import { BRAND } from "../constants/brand";
import { BrandLockup } from "./BrandMark";
import { ManualChecksDialog } from "./ManualChecksDialog";
import { labelOf, LanguageSwitch, useT } from "../i18n";
import {
  HEADER_HELP_MENU_ID,
  HEADER_AVATAR_MENU_ID,
  HEADER_AVATAR_BUTTON_TEST_ID,
  HEADER_HELP_MENU_BUTTON_TEST_ID,
  HEADER_LOGOUT_BUTTON_TEST_ID,
} from "./Header.locators";
import {
  FolderOutlined,
  PersonOutline,
  PhoneAndroid,
  FlagOutlined,
  HelpOutline,
  PeopleOutline,
  BackupOutlined,
  Logout,
  DarkModeOutlined,
  LightModeOutlined,
} from "@mui/icons-material";
import { motion, tokens } from "../theme";

const menuPaper = {
  paper: { sx: { minWidth: 240, p: 0.75, mt: 0.5 } },
};
const itemSx = {
  borderRadius: 1.5,
  minHeight: 38,
  gap: 1.25,
  px: 1.25,
  "& .MuiSvgIcon-root": { fontSize: 20, color: tokens.textMuted },
};

const Header: FunctionComponent = () => {
  const [avatarMenuRef, setAvatarMenuRef] = React.useState<null | HTMLElement>(
    null,
  );

  const [helpMenuRef, setHelpMenuRef] = React.useState<null | HTMLElement>(
    null,
  );

  const { loggedIn, user } = useUserState();
  const { mode, toggle } = useThemeMode();
  const { t } = useT();
  const themeLabel = t(
    mode === "dark" ? "header.lightTheme" : "header.darkTheme",
  );
  const [manualChecksOpen, setManualChecksOpen] = React.useState(false);
  const authDispatch = useUserDispatch();

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
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      data-testid={HEADER_HELP_MENU_ID}
      keepMounted
      open={!!helpMenuRef}
      onClose={handleMenuClose}
      slotProps={menuPaper}
    >
      <MenuItem onClick={handleMenuClose} sx={{ ...itemSx, p: 0 }}>
        <GuidedTour />
      </MenuItem>
      <MenuItem
        onClick={() => {
          handleMenuClose();
          setManualChecksOpen(true);
        }}
        sx={itemSx}
      >
        <PhoneAndroid />
        {t("header.manualChecks")}
      </MenuItem>
      {BRAND.supportUrl && (
        <MenuItem onClick={closeMenuAndOpenLink} sx={itemSx}>
          <FlagOutlined />
          {t("header.reportProblem")}
        </MenuItem>
      )}
      <Divider sx={{ my: 0.75 }} />
      <Typography
        component="div"
        variant="caption"
        sx={{ px: 1.25, py: 0.5, color: tokens.textMuted }}
      >
        {BRAND.name} {getVRTVersion()}
      </Typography>
    </Menu>
  );

  const renderAvatarMenu = (
    <Menu
      anchorEl={avatarMenuRef}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      id={HEADER_AVATAR_MENU_ID}
      keepMounted
      open={!!avatarMenuRef}
      onClose={handleMenuClose}
      slotProps={menuPaper}
    >
      <Box sx={{ px: 1.25, pt: 0.75, pb: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>
          {[user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            user?.email}
        </Typography>
        <Typography variant="caption" sx={{ color: tokens.textMuted }}>
          {user?.email}
          {user?.role ? ` · ${labelOf(t, "role", user.role)}` : ""}
        </Typography>
      </Box>
      <Divider sx={{ mb: 0.75 }} />
      <MenuItem
        component={Link}
        to={routes.PROFILE_PAGE}
        onClick={handleMenuClose}
        sx={itemSx}
      >
        <PersonOutline />
        {t("header.profile")}
      </MenuItem>
      <MenuItem
        component={Link}
        to={routes.PROJECT_LIST_PAGE}
        onClick={handleMenuClose}
        sx={itemSx}
      >
        <FolderOutlined />
        {t("header.projects")}
      </MenuItem>
      {user?.role === "admin" && (
        <MenuItem
          component={Link}
          to={routes.USER_LIST_PAGE}
          onClick={handleMenuClose}
          sx={itemSx}
        >
          <PeopleOutline />
          {t("header.users")}
        </MenuItem>
      )}
      {user?.role === "admin" && (
        <MenuItem
          component={Link}
          to={routes.BACKUPS_PAGE}
          onClick={handleMenuClose}
          sx={itemSx}
          data-testid="backupsMenuItem"
        >
          <BackupOutlined />
          {t("header.backups")}
        </MenuItem>
      )}
      <MenuItem
        onClick={(event) => {
          handleMenuClose();
          toggle(event.currentTarget);
        }}
        sx={itemSx}
        data-testid="themeMenuItem"
      >
        {mode === "dark" ? <LightModeOutlined /> : <DarkModeOutlined />}
        {themeLabel}
        <Box
          component="kbd"
          sx={{
            ml: "auto",
            fontFamily: tokens.mono,
            fontSize: 11,
            color: tokens.textMuted,
          }}
        >
          ⇧D
        </Box>
      </MenuItem>
      <Divider sx={{ my: 0.75 }} />
      <MenuItem
        onClick={() => {
          handleMenuClose();
          logout(authDispatch);
        }}
        data-testid={HEADER_LOGOUT_BUTTON_TEST_ID}
        sx={itemSx}
      >
        <Logout />
        {t("header.logout")}
      </MenuItem>
    </Menu>
  );

  return (
    <React.Fragment>
      <AppBar position="static">
        <Toolbar variant="dense" sx={{ minHeight: 56, gap: 0.5 }}>
          <Link
            to="/"
            aria-label={t("header.home", { brand: BRAND.name })}
            style={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <BrandLockup markSize={28} wordSize={19} />
          </Link>
          <Box sx={{ flex: 1 }} />
          <LanguageSwitch />
          <Tooltip title={`${themeLabel} (⇧D)`}>
            <IconButton
              onClick={(event) => toggle(event.currentTarget)}
              aria-label={themeLabel}
              data-testid="themeToggle"
              sx={{
                color: tokens.textMuted,
                "& svg": {
                  transition: `transform ${motion.slow}ms ${motion.easing}`,
                },
                "&:hover svg": { transform: "rotate(-20deg)" },
              }}
            >
              {mode === "dark" ? <LightModeOutlined /> : <DarkModeOutlined />}
            </IconButton>
          </Tooltip>
          <IconButton
            onClick={(event: React.MouseEvent<HTMLElement>) =>
              setHelpMenuRef(event.currentTarget)
            }
            aria-label={t("header.help")}
            data-testid={HEADER_HELP_MENU_BUTTON_TEST_ID}
            sx={{ color: tokens.textMuted }}
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
