import React from "react";
import { Box, ToggleButton, Typography } from "@mui/material";
import { SlidingToggleGroup } from "./motion/SlidingToggleGroup";
import { useThemeMode } from "../contexts";
import { ThemePreference } from "../_helpers/themeMode.helper";
import { Language, useT } from "../i18n";
import { FormCard } from "./FormCard";
import { tokens, type } from "../theme";

const groupLabel = (id: string, text: string) => (
  <Typography id={id} sx={{ fontSize: type.small, fontWeight: 600, mb: 0.75 }}>
    {text}
  </Typography>
);

/**
 * The interface language and System, Light or Dark (REQ-018-04), for this
 * browser. Both apply at once, so the card has nothing to save.
 */
export const AppearanceCard: React.FunctionComponent = () => {
  const { preference, setPreference } = useThemeMode();
  const { t, language, setLanguage } = useT();
  const toggleSx = { px: 1.75, fontSize: type.small };
  return (
    <FormCard
      data-testid="appearanceCard"
      title={t("profile.languageAndTheme")}
    >
      <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <div>
          {groupLabel("profileLanguageLabel", t("profile.language"))}
          <SlidingToggleGroup
            exclusive
            size="small"
            value={language}
            aria-labelledby="profileLanguageLabel"
            data-testid="profileLanguage"
            onChange={(_, value: Language | null) =>
              value && setLanguage(value)
            }
          >
            <ToggleButton value="en" sx={toggleSx}>
              English
            </ToggleButton>
            <ToggleButton value="uk" sx={toggleSx}>
              Українська
            </ToggleButton>
          </SlidingToggleGroup>
        </div>
        <div>
          {groupLabel("profileThemeLabel", t("profile.theme"))}
          <SlidingToggleGroup
            exclusive
            size="small"
            value={preference}
            aria-labelledby="profileThemeLabel"
            onChange={(event, value: ThemePreference | null) => {
              if (value) setPreference(value, event.currentTarget as Element);
            }}
          >
            <ToggleButton value="system" sx={toggleSx}>
              {t("profile.system")}
            </ToggleButton>
            <ToggleButton value="light" sx={toggleSx}>
              {t("profile.light")}
            </ToggleButton>
            <ToggleButton value="dark" sx={toggleSx}>
              {t("profile.dark")}
            </ToggleButton>
          </SlidingToggleGroup>
        </div>
      </Box>
      <Typography sx={{ fontSize: type.small, color: tokens.textMuted }}>
        {t("profile.appearanceHelp")}
      </Typography>
    </FormCard>
  );
};
