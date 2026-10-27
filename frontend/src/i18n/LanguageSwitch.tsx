import React from "react";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useT } from "./LanguageProvider";
import { Language } from "./translate";

/** EN | UK, in the header and on the login page. */
export const LanguageSwitch: React.FunctionComponent = () => {
  const { language, setLanguage, t } = useT();

  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={language}
      aria-label={t("language.label")}
      data-testid="languageSwitch"
      onChange={(_, value: Language | null) => value && setLanguage(value)}
      sx={{
        "& .MuiToggleButton-root": {
          px: 1,
          py: 0.25,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.5,
        },
      }}
    >
      <ToggleButton value="en" aria-label="English" title="English">
        EN
      </ToggleButton>
      <ToggleButton value="uk" aria-label="Українська" title="Українська">
        UK
      </ToggleButton>
    </ToggleButtonGroup>
  );
};
