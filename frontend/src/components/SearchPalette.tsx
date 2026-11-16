import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, ButtonBase, Dialog, InputBase, Typography } from "@mui/material";
import { SearchOutlined } from "@mui/icons-material";
import { projectsService } from "../services";
import type { ScreenSuggestion } from "../types";
import { radius, tokens, type } from "../theme";
import { useT } from "../i18n";
import { routes } from "../constants";
import { isSearchable, nextActive } from "../_helpers/screenSearch.helper";
import { BetaChip } from "./BetaChip";

// suggestions follow the typing closely, but not every key
const TYPING_PAUSE_MS = 150;

const KIND_MARK: Record<ScreenSuggestion["kind"], string> = {
  text: "T",
  label: "A",
  id: "#",
  component: "◇",
};

const Key: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Box
    component="kbd"
    sx={{
      fontFamily: tokens.mono,
      fontSize: type.caption,
      px: 0.75,
      borderRadius: radius.control,
      border: `1px solid ${tokens.borderStrong}`,
      color: tokens.textSecondary,
      bgcolor: tokens.surface,
    }}
  >
    {children}
  </Box>
);

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  // the build `/` was pressed on: suggestions and the search look at its screens when asked
  buildId?: string | null;
}

/**
 * The search opened with `/` over any page (053, beta): texts, labels, ids and components of
 * the project's screens that hold what is typed, so nobody has to remember the selector syntax.
 * Enter opens every match on the search page.
 */
export const SearchPalette: React.FunctionComponent<Props> = ({
  open,
  onClose,
  projectId,
  buildId,
}) => {
  const { t } = useT();
  const navigate = useNavigate();
  const [typed, setTyped] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<ScreenSuggestion[]>([]);
  const [active, setActive] = React.useState(-1);
  const field = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setTyped("");
      setSuggestions([]);
      setActive(-1);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || !isSearchable(typed)) {
      setSuggestions([]);
      return;
    }
    let current = true;
    const timer = window.setTimeout(() => {
      projectsService
        .suggestScreens(projectId, typed)
        .then((found) => {
          if (!current) return;
          setSuggestions(found);
          setActive(-1);
        })
        .catch(() => current && setSuggestions([]));
    }, TYPING_PAUSE_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [open, typed, projectId]);

  const go = (query: string) => {
    if (!query.trim()) return;
    const params = new URLSearchParams({ q: query });
    if (buildId) params.set("build", buildId);
    onClose();
    navigate(`${routes.SEARCH_PAGE}/${projectId}?${params}`);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => nextActive(index, step, suggestions.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(
        active >= 0 && suggestions[active] ? suggestions[active].query : typed,
      );
    }
  };

  const texts = suggestions.filter(
    (item) => item.kind === "text" || item.kind === "label",
  );
  const elements = suggestions.filter(
    (item) => item.kind === "id" || item.kind === "component",
  );

  const option = (item: ScreenSuggestion) => {
    const index = suggestions.indexOf(item);
    const selector = item.kind === "id" || item.kind === "component";
    return (
      <ButtonBase
        key={`${item.kind}:${item.query}`}
        role="option"
        aria-selected={index === active}
        data-testid="searchSuggestion"
        onMouseEnter={() => setActive(index)}
        onClick={() => go(item.query)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          width: "100%",
          justifyContent: "flex-start",
          px: 1.5,
          py: 1,
          borderRadius: radius.control,
          bgcolor: index === active ? tokens.subtle : "transparent",
          textAlign: "left",
        }}
      >
        <Box
          aria-hidden
          sx={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: radius.control,
            display: "grid",
            placeItems: "center",
            fontSize: type.caption,
            fontWeight: 700,
            bgcolor:
              item.kind === "label" ? tokens.variableSoft : tokens.brandSoft,
            color: item.kind === "label" ? tokens.variable : tokens.brandDark,
          }}
        >
          {KIND_MARK[item.kind]}
        </Box>
        <Typography
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: selector ? type.small : type.body,
            fontFamily: selector ? tokens.mono : undefined,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: tokens.text,
          }}
        >
          {item.query}
        </Typography>
        <Typography
          sx={{
            fontSize: type.small,
            color: tokens.textMuted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {t("search.palette.screens", { count: item.screens })}
        </Typography>
      </ButtonBase>
    );
  };

  const section = (title: string, items: ScreenSuggestion[]) =>
    items.length > 0 && (
      <Box role="group" aria-label={title}>
        <Typography
          sx={{
            px: 1.5,
            pt: 1.25,
            pb: 0.5,
            fontSize: type.caption,
            fontWeight: 600,
            color: tokens.textMuted,
          }}
        >
          {title}
        </Typography>
        {items.map(option)}
      </Box>
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      // the field, not the dialog, takes the keys once it has opened
      TransitionProps={{ onEntered: () => field.current?.focus() }}
      PaperProps={
        {
          "data-testid": "searchPalette",
          sx: {
            alignSelf: "flex-start",
            mt: "12vh",
            borderRadius: radius.card,
          },
        } as object
      }
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          height: 60,
          px: 2,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <SearchOutlined sx={{ color: tokens.brand }} />
        <InputBase
          inputRef={field}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("search.placeholder")}
          inputProps={{
            "aria-label": t("search.label"),
            "data-testid": "searchPaletteInput",
            role: "combobox",
            "aria-expanded": suggestions.length > 0,
          }}
          sx={{ flex: 1, fontSize: type.title, fontWeight: 500 }}
        />
        <BetaChip />
        <Key>Esc</Key>
      </Box>
      <Box role="listbox" sx={{ p: 0.75, minHeight: 8 }}>
        {section(t("search.palette.texts"), texts)}
        {section(t("search.palette.elements"), elements)}
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2,
          py: 1.25,
          borderTop: `1px solid ${tokens.border}`,
          fontSize: type.caption,
          color: tokens.textMuted,
        }}
      >
        <Box sx={{ display: "inline-flex", gap: 0.5 }}>
          <Key>↑</Key>
          <Key>↓</Key>
        </Box>
        <Box sx={{ display: "inline-flex", gap: 0.75, alignItems: "center" }}>
          <Key>↵</Key>
          {t("search.palette.all")}
        </Box>
      </Box>
    </Dialog>
  );
};
