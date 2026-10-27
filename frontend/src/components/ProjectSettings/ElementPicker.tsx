import React from "react";
import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import { useT } from "../../i18n";
import { ElementOption, searchElements } from "./patterns";
import { hasSuggestions, useVocabulary } from "./vocabulary";

interface Props {
  id: string;
  value: string;
  onChange: (selector: string) => void;
  error?: string;
}

/**
 * The element a rule names: searched among the project's elements by id,
 * class or text, or typed as a selector when the project has no UI trees yet.
 */
export const ElementPicker: React.FunctionComponent<Props> = ({
  id,
  value,
  onChange,
  error,
}) => {
  const { t } = useT();
  const { vocabulary, loading } = useVocabulary();
  const [query, setQuery] = React.useState(value);
  const options = React.useMemo(
    () => (vocabulary ? searchElements(vocabulary, query) : []),
    [vocabulary, query],
  );

  return (
    <Autocomplete<ElementOption | string, false, false, true>
      id={id}
      freeSolo
      size="small"
      loading={loading}
      options={hasSuggestions(vocabulary) ? options : []}
      filterOptions={(items) => items}
      inputValue={query}
      onInputChange={(_, next, reason) => {
        if (reason === "reset") return;
        setQuery(next);
        onChange(next.trim());
      }}
      onChange={(_, picked) => {
        const selector =
          typeof picked === "string" ? picked : (picked?.selector ?? "");
        setQuery(selector);
        onChange(selector);
      }}
      getOptionLabel={(option) =>
        typeof option === "string" ? option : option.selector
      }
      renderOption={(props, option) =>
        typeof option === "string" ? null : (
          <Box component="li" {...props} key={option.selector}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                component="div"
                sx={{ fontFamily: "monospace", fontSize: 13 }}
              >
                {option.selector}
              </Typography>
              {option.description && (
                <Typography variant="caption" color="textSecondary">
                  {option.description}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" color="textSecondary" sx={{ ml: 2 }}>
              {t("mobile.onScreens", { count: option.screens })}
            </Typography>
          </Box>
        )
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("mobile.element")}
          placeholder={
            hasSuggestions(vocabulary)
              ? t("mobile.elementSearch")
              : "id:clock, class:MapView, text:/\\d+:\\d+/"
          }
          error={!!error}
          helperText={
            error ??
            (hasSuggestions(vocabulary)
              ? t("mobile.elementSearchHelp")
              : t("mobile.elementTypeHelp"))
          }
        />
      )}
      sx={{ flex: "1 1 280px" }}
    />
  );
};
