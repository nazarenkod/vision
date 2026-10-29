import React from "react";
import { ToggleButton } from "@mui/material";
import { SlidingToggleGroup } from "../components/motion/SlidingToggleGroup";
import { tokens } from "../theme";
import { useT } from "./LanguageProvider";
import { Language } from "./translate";

/** EN | UK in the header, on every page including the login page. */
export const LanguageSwitch: React.FunctionComponent = () => {
  const { language, setLanguage, t } = useT();

  return (
    <SlidingToggleGroup
      size="small"
      exclusive
      value={language}
      aria-label={t("language.label")}
      data-testid="languageSwitch"
      onChange={(_, value: Language | null) => value && setLanguage(value)}
      sx={{
        mr: 0.5,
        "& .MuiToggleButton-root": {
          px: 0.875,
          py: 0.25,
          fontFamily: tokens.mono,
          fontSize: 11.5,
          fontWeight: 600,
          lineHeight: 1.6,
          color: tokens.textMuted,
          borderColor: tokens.border,
        },
        "& .MuiToggleButton-root.Mui-selected": { color: tokens.text },
      }}
    >
      <ToggleButton value="en" aria-label="English" title="English">
        EN
      </ToggleButton>
      <ToggleButton value="uk" aria-label="Українська" title="Українська">
        UK
      </ToggleButton>
    </SlidingToggleGroup>
  );
};
