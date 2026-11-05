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
  LightModeOutlined,
  Logout,
  MonitorOutlined,
  PersonOutline,
} from "@mui/icons-material";
import {
  logout,
  useThemeMode,
  useUserDispatch,
  useUserState,
} from "../contexts";
import { routes } from "../constants";
import { labelOf, LanguageSwitch, useT } from "../i18n";
import { ThemePreference } from "../_helpers/themeMode.helper";
import { SlidingToggleGroup } from "./motion/SlidingToggleGroup";
import { ACCOUNT_MENU_ID, LOGOUT_BUTTON_TEST_ID } from "./SideNav.locators";
import { tokens, type, radius } from "../theme";

export const accountItemSx = {
  borderRadius: radius.control,
  minHeight: 38,
  gap: 1.25,
  px: 1.25,
  "& .MuiSvgIcon-root": { fontSize: 20, color: tokens.textMuted },
};

const rowSx = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  minHeight: 40,
  px: 1.25,
  fontSize: type.body,
};

/** Who is signed in, the profile, language, theme and Log out (REQ-046-23). */
export const AccountMenu: React.FunctionComponent<{
  anchorEl: HTMLElement | null;
  onClose: () => void;
}> = ({ anchorEl, onClose }) => {
  const { user } = useUserState();
  const authDispatch = useUserDispatch();
  const { preference, setPreference } = useThemeMode();
  const { t } = useT();
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email;

  return (
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
        to={routes.PROFILE_PAGE}
        onClick={onClose}
        sx={accountItemSx}
      >
        <PersonOutline />
        {t("account.profile")}
      </MenuItem>
      <Box sx={rowSx}>
        <Box component="span" sx={{ flex: 1 }}>
          {t("account.language")}
        </Box>
        <LanguageSwitch />
      </Box>
      <Box sx={rowSx} data-testid="themeMenuItem">
        <Box component="span" sx={{ flex: 1 }}>
          {t("account.theme")}
          <Box
            component="kbd"
            sx={{
              ml: 0.75,
              fontFamily: tokens.mono,
              fontSize: type.caption,
              color: tokens.textMuted,
            }}
          >
            ⇧D
          </Box>
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
          logout(authDispatch);
        }}
        data-testid={LOGOUT_BUTTON_TEST_ID}
        sx={accountItemSx}
      >
        <Logout />
        {t("account.logout")}
      </MenuItem>
    </Menu>
  );
};
