import React from "react";
import { Card, CardContent, CardHeader, ToggleButton } from "@mui/material";
import {
  DarkModeOutlined,
  LightModeOutlined,
  MonitorOutlined,
} from "@mui/icons-material";
import { SlidingToggleGroup } from "./motion/SlidingToggleGroup";
import { useThemeMode } from "../contexts";
import { ThemePreference } from "../_helpers/themeMode.helper";
import { useT } from "../i18n";

/** System, Light or Dark for this browser (REQ-018-04). */
export const AppearanceCard: React.FunctionComponent = () => {
  const { preference, setPreference } = useThemeMode();
  const { t } = useT();
  return (
    <Card variant="outlined" data-testid="appearanceCard">
      <CardHeader
        title={t("profile.appearance")}
        subheader={t("profile.appearanceHelp")}
        subheaderTypographyProps={{ variant: "body2" }}
      />
      <CardContent sx={{ pt: 0 }}>
        <SlidingToggleGroup
          exclusive
          size="small"
          value={preference}
          aria-label={t("profile.appearance")}
          onChange={(event, value: ThemePreference | null) => {
            if (value) setPreference(value, event.currentTarget as Element);
          }}
        >
          <ToggleButton value="system" sx={{ gap: 0.75, px: 1.5 }}>
            <MonitorOutlined fontSize="small" /> {t("profile.system")}
          </ToggleButton>
          <ToggleButton value="light" sx={{ gap: 0.75, px: 1.5 }}>
            <LightModeOutlined fontSize="small" /> {t("profile.light")}
          </ToggleButton>
          <ToggleButton value="dark" sx={{ gap: 0.75, px: 1.5 }}>
            <DarkModeOutlined fontSize="small" /> {t("profile.dark")}
          </ToggleButton>
        </SlidingToggleGroup>
      </CardContent>
    </Card>
  );
};
