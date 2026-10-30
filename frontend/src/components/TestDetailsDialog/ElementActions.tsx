import React from "react";
import { Box, ButtonBase, Tooltip } from "@mui/material";
import { ElementRuleAction, RuleScope } from "../../types/insights";
import { tokens } from "../../theme";
import { useT } from "../../i18n";

// what Allow takes here; another share goes through the full rule form
export const ALLOW_PERCENT = 5;

/** The mark a rule leaves on a screenshot, small: hatched, framed or dashed (REQ-024-20). */
export const swatch = (action: ElementRuleAction, size = 16) => {
  const base = {
    width: size,
    height: size,
    borderRadius: "4px",
    boxSizing: "border-box",
    flexShrink: 0,
  } as const;
  if (action === "ignore")
    return {
      ...base,
      outline: `1.5px solid ${tokens.status.neutral.fg}`,
      background: `repeating-linear-gradient(135deg, ${tokens.status.neutral.bar} 0 3px, transparent 3px 6px)`,
    };
  if (action === "compare")
    return { ...base, border: `2px solid ${tokens.brand}` };
  return { ...base, border: `1.5px dashed ${tokens.status.new.fg}` };
};

const ACTIONS: Array<{ action: ElementRuleAction; key: string }> = [
  { action: "ignore", key: "I" },
  { action: "compare", key: "C" },
  { action: "tolerate", key: "T" },
];

interface ActionButtonsProps {
  scope: RuleScope;
  busy: boolean;
  onAct: (action: ElementRuleAction, scope: RuleScope) => void;
  // in a row, as the selection panel has them, or one under another
  row?: boolean;
}

/** Ignore, Compare only, Allow: the same next to one element and for several. */
export const ActionButtons: React.FunctionComponent<ActionButtonsProps> = ({
  scope,
  busy,
  onAct,
  row,
}) => {
  const { t } = useT();
  const label = (action: ElementRuleAction) =>
    action === "ignore"
      ? t("select.ignore")
      : action === "compare"
        ? t("select.compare")
        : t("select.allow", { percent: ALLOW_PERCENT });
  return (
    <>
      {ACTIONS.map(({ action, key }) => {
        // compare only names the elements of one check (REQ-024-16)
        const blocked = action === "compare" && scope === "project";
        const button = (
          <ButtonBase
            key={action}
            disabled={busy || blocked}
            onClick={() => onAct(action, scope)}
            data-testid={`elementAction-${action}`}
            sx={{
              display: "flex",
              gap: 1.25,
              justifyContent: "flex-start",
              width: row ? "auto" : "100%",
              borderRadius: "8px",
              px: 1.25,
              py: 1,
              font: "inherit",
              fontSize: 14,
              fontWeight: 600,
              color: blocked ? tokens.textMuted : tokens.text,
              "&:hover, &.Mui-focusVisible": { bgcolor: tokens.subtle },
            }}
          >
            <Box sx={swatch(action)} />
            <Box component="span" sx={{ flexGrow: 1, textAlign: "left" }}>
              {label(action)}
            </Box>
            <Box
              component="span"
              sx={{ fontSize: 11, fontWeight: 500, color: tokens.textMuted }}
            >
              {key}
            </Box>
          </ButtonBase>
        );
        return blocked ? (
          <Tooltip key={action} title={t("select.compareOneScreen")}>
            <span>{button}</span>
          </Tooltip>
        ) : (
          button
        );
      })}
    </>
  );
};

/** This screen / All screens. */
export const ScopeToggle: React.FunctionComponent<{
  scope: RuleScope;
  onScope: (scope: RuleScope) => void;
}> = ({ scope, onScope }) => {
  const { t } = useT();
  const option = (value: RuleScope, label: string) => (
    <ButtonBase
      onClick={() => onScope(value)}
      aria-pressed={scope === value}
      sx={{
        flex: 1,
        borderRadius: "6px",
        py: 0.5,
        font: "inherit",
        fontSize: 12.5,
        fontWeight: scope === value ? 600 : 500,
        color: scope === value ? tokens.text : tokens.textSecondary,
        bgcolor: scope === value ? tokens.surface : "transparent",
        boxShadow: scope === value ? tokens.shadowShot : "none",
      }}
    >
      {label}
    </ButtonBase>
  );
  return (
    <Box
      sx={{
        display: "flex",
        bgcolor: tokens.subtle,
        borderRadius: "8px",
        p: "2px",
      }}
    >
      {option("screen", t("select.thisScreen"))}
      {option("project", t("select.allScreens"))}
    </Box>
  );
};

interface ActionKeys {
  onAct?: (action: ElementRuleAction, scope: RuleScope) => void;
  onUp?: () => void;
  onDown?: () => void;
  onClose: () => void;
  scope: RuleScope;
  busy: boolean;
}

/**
 * I, C and T act, Esc closes; ↑ and ↓ only where they are given, as they
 * step through one element's parents (REQ-024-04, REQ-028-15).
 */
export function useActionKeys(keys: ActionKeys) {
  const latest = React.useRef(keys);
  latest.current = keys;
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      const { onAct, onUp, onDown, onClose, scope, busy } = latest.current;
      const act: Record<string, ElementRuleAction> = {
        i: "ignore",
        c: "compare",
        t: "tolerate",
      };
      const key = event.key.toLowerCase();
      if (act[key] && onAct && !event.metaKey && !event.ctrlKey && !busy) {
        if (act[key] === "compare" && scope === "project") return;
        event.preventDefault();
        event.stopPropagation();
        onAct(act[key], scope);
      } else if (event.key === "ArrowUp" && onUp) {
        event.preventDefault();
        event.stopPropagation();
        onUp();
      } else if (event.key === "ArrowDown" && onDown) {
        event.preventDefault();
        event.stopPropagation();
        onDown();
      } else if (event.key === "Escape") {
        // the first Esc closes this; the next one leaves selecting
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
