import React from "react";
import {
  Box,
  Divider,
  Menu,
  MenuItem,
  ToggleButton,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import {
  DarkModeOutlined,
  FlagOutlined,
  FolderOutlined,
  LightModeOutlined,
  Logout,
  MonitorOutlined,
  PaletteOutlined,
  PersonOutline,
  PhoneAndroid,
  Translate,
} from "@mui/icons-material";
import {
  logout,
  useThemeMode,
  useUserDispatch,
  useUserState,
} from "../contexts";
import { routes } from "../constants";
import { BRAND } from "../constants/brand";
import { labelOf, LanguageSwitch, useT } from "../i18n";
import { ThemePreference } from "../_helpers/themeMode.helper";
import { SlidingToggleGroup } from "./motion/SlidingToggleGroup";
import { ACCOUNT_MENU_ID, LOGOUT_BUTTON_TEST_ID } from "./SideNav.locators";
import { ManualChecksDialog } from "./ManualChecksDialog";
import { tokens, type, radius } from "../theme";

export const accountItemSx = {
  borderRadius: radius.control,
  minHeight: 38,
  gap: 1.25,
  px: 1.25,
  "& .MuiSvgIcon-root": { fontSize: 20, color: tokens.textMuted },
};

// rows with a switch carry an icon too, so every label starts on one line
// with Profile and Log out
const rowSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.25,
  minHeight: 40,
  px: 1.25,
  fontSize: type.body,
  "& > .MuiSvgIcon-root": { fontSize: 20, color: tokens.textMuted },
};

/**
 * Who is signed in, all projects, the profile, language, theme, manual checks
 * and Log out (REQ-060-20).
 */
export const AccountMenu: React.FunctionComponent<{
  anchorEl: HTMLElement | null;
  onClose: () => void;
}> = ({ anchorEl, onClose }) => {
  const { user } = useUserState();
  const authDispatch = useUserDispatch();
  const { preference, setPreference } = useThemeMode();
  const { t } = useT();
  const [manualChecksOpen, setManualChecksOpen] = React.useState(false);
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email;

  return (
    <>
      <Menu
        id={ACCOUNT_MENU_ID}
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { minWidth: 280, p: 0.75, ml: 1 } } }}
      >
        <Box sx={{ px: 1.25, pt: 0.75, pb: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
          <Typography variant="caption" sx={{ color: tokens.textMuted }}>
            {user?.email}
            {user?.role ? ` · ${labelOf(t, "role", user.role)}` : ""}
          </Typography>
        </Box>
        <Divider sx={{ mb: 0.75 }} />
        <MenuItem
          component={Link}
          to={routes.PROJECT_LIST_PAGE}
          onClick={onClose}
          sx={accountItemSx}
        >
          <FolderOutlined />
          {t("account.allProjects")}
        </MenuItem>
        <MenuItem
          component={Link}
          to={routes.PROFILE_PAGE}
          onClick={onClose}
          sx={accountItemSx}
        >
          <PersonOutline />
          {t("account.profile")}
        </MenuItem>
        <Box sx={rowSx}>
          <Translate />
          <Box component="span" sx={{ flex: 1 }}>
            {t("account.language")}
          </Box>
          <LanguageSwitch />
        </Box>
        <Box sx={rowSx} data-testid="themeMenuItem">
          <PaletteOutlined />
          <Box component="span" sx={{ flex: 1 }}>
            {t("account.theme")}
          </Box>
          <SlidingToggleGroup
            exclusive
            size="small"
            value={preference}
            aria-label={t("account.theme")}
            data-testid="themeToggle"
            onChange={(event, value: ThemePreference | null) => {
              if (value) setPreference(value, event.currentTarget as Element);
            }}
            sx={{ "& .MuiToggleButton-root": { px: 0.75, py: 0.25 } }}
          >
            <ToggleButton value="system" aria-label={t("profile.system")}>
              <MonitorOutlined fontSize="small" />
            </ToggleButton>
            <ToggleButton value="light" aria-label={t("profile.light")}>
              <LightModeOutlined fontSize="small" />
            </ToggleButton>
            <ToggleButton value="dark" aria-label={t("profile.dark")}>
              <DarkModeOutlined fontSize="small" />
            </ToggleButton>
          </SlidingToggleGroup>
        </Box>
        <Divider sx={{ my: 0.75 }} />
        <MenuItem
          onClick={() => {
            onClose();
            setManualChecksOpen(true);
          }}
          sx={accountItemSx}
        >
          <PhoneAndroid />
          {t("header.manualChecks")}
        </MenuItem>
        {BRAND.supportUrl && (
          <MenuItem
            onClick={() => {
              onClose();
              window.open(BRAND.supportUrl, "_blank", "noopener");
            }}
            sx={accountItemSx}
          >
            <FlagOutlined />
            {t("header.reportProblem")}
          </MenuItem>
        )}
        <Divider sx={{ my: 0.75 }} />
        <MenuItem
          onClick={() => {
            onClose();
            logout(authDispatch);
          }}
          data-testid={LOGOUT_BUTTON_TEST_ID}
          sx={accountItemSx}
        >
          <Logout />
          {t("account.logout")}
        </MenuItem>
      </Menu>
      <ManualChecksDialog
        open={manualChecksOpen}
        onClose={() => setManualChecksOpen(false)}
      />
    </>
  );
};
