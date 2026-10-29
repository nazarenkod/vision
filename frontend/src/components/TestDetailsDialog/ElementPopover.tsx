import React from "react";
import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  Paper,
  Popper,
  Tooltip,
  Typography,
} from "@mui/material";
import { MoreHoriz } from "@mui/icons-material";
import {
  ElementRuleAction,
  PickableElement,
  RuleScope,
  ScreenRule,
  SelectorVariant,
} from "../../types/insights";
import {
  chosenVariant,
  elementLabel,
  relationTo,
} from "../../_helpers/elementPicking.helper";
import { tokens } from "../../theme";
import { useT } from "../../i18n";

// what Allow takes here; another share goes through the full rule form
export const ALLOW_PERCENT = 5;

interface ElementPopoverProps {
  // where the element was clicked, in the window
  anchor: { x: number; y: number };
  element: PickableElement;
  // Shift-clicked elements the action also applies to
  selectedCount: number;
  // how many elements the element's selector takes on its screenshot
  sameSelector: number;
  // the rule the element is already under, if any (REQ-024-09)
  rule?: ScreenRule;
  canGoUp: boolean;
  canGoDown: boolean;
  busy: boolean;
  onUp: () => void;
  onDown: () => void;
  onMore: () => void;
  onAct: (action: ElementRuleAction, scope: RuleScope) => void;
  // a nameless element can be found another way (REQ-027-15)
  onChooseVariant?: (variant: SelectorVariant) => void;
  onRemove: (rule: ScreenRule) => void;
  onClose: () => void;
}

const swatch = (action: ElementRuleAction) => {
  const base = {
    width: 16,
    height: 16,
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

/**
 * What can be done with an element clicked on a screenshot, next to it
 * (REQ-024-03): ignore it, compare only it, allow small changes in it, on
 * this screen or every screen. The keys I, C and T do the same.
 */
export const ElementPopover: React.FunctionComponent<ElementPopoverProps> = ({
  anchor,
  element,
  selectedCount,
  sameSelector,
  rule,
  canGoUp,
  canGoDown,
  busy,
  onUp,
  onDown,
  onMore,
  onAct,
  onRemove,
  onClose,
  onChooseVariant,
}) => {
  const { t } = useT();
  const [scope, setScope] = React.useState<RuleScope>("screen");
  const [confirming, setConfirming] = React.useState(false);
  React.useEffect(() => setConfirming(false), [rule?.id]);

  const virtualAnchor = React.useMemo(
    () => ({
      getBoundingClientRect: () =>
        new DOMRect(anchor.x, anchor.y, 0, 0) as DOMRect,
    }),
    [anchor.x, anchor.y],
  );

  const latest = React.useRef({ onAct, onUp, onDown, onClose, scope, busy });
  latest.current = { onAct, onUp, onDown, onClose, scope, busy };
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
      if (act[key] && !event.metaKey && !event.ctrlKey && !busy) {
        if (act[key] === "compare" && scope === "project") return;
        event.preventDefault();
        event.stopPropagation();
        onAct(act[key], scope);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        onUp();
      } else if (event.key === "ArrowDown") {
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

  const name = elementLabel(element, t);
  const variant = chosenVariant(element);
  const variants = element.variants ?? [];

  const ruleLabel = rule
    ? rule.action === "ignore"
      ? t("select.ruleIgnore")
      : rule.action === "compare"
        ? t("select.ruleCompare")
        : t("select.ruleTolerate", { percent: rule.maxDiffPercent ?? 5 })
    : null;

  const actionButton = (
    action: ElementRuleAction,
    label: string,
    key: string,
  ) => {
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
          width: "100%",
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
          {label}
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
  };

  const scopeButton = (value: RuleScope, label: string) => (
    <ButtonBase
      onClick={() => setScope(value)}
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
    <Popper
      open
      anchorEl={virtualAnchor}
      placement="right"
      modifiers={[{ name: "offset", options: { offset: [0, 14] } }]}
      sx={{ zIndex: 1400 }}
    >
      <Paper
        role="dialog"
        aria-label={name}
        data-testid="elementPopover"
        sx={{
          width: 256,
          borderRadius: "14px",
          boxShadow: tokens.shadowPop,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            pl: 1.75,
            pr: 1.25,
            py: 1.25,
            borderBottom: `1px solid ${tokens.border}`,
          }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              noWrap
              sx={{ fontSize: 14.5, fontWeight: 600 }}
              title={element.selector}
            >
              {name}
            </Typography>
            {(selectedCount > 1 || sameSelector > 1) && (
              <Typography sx={{ fontSize: 12, color: tokens.textMuted }}>
                {selectedCount > 1
                  ? t("select.selected", { count: selectedCount })
                  : t("select.onScreen", { count: sameSelector })}
              </Typography>
            )}
          </Box>
          <Tooltip title={t("select.parent")}>
            <span>
              <IconButton
                size="small"
                disabled={!canGoUp}
                onClick={onUp}
                aria-label={t("select.parent")}
                data-testid="elementParent"
                sx={{ fontSize: 13, width: 28, height: 28 }}
              >
                ↑
              </IconButton>
            </span>
          </Tooltip>
          {canGoDown && (
            <Tooltip title={t("select.child")}>
              <IconButton
                size="small"
                onClick={onDown}
                aria-label={t("select.child")}
                sx={{ fontSize: 13, width: 28, height: 28 }}
              >
                ↓
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t("select.more")}>
            <IconButton
              size="small"
              onClick={onMore}
              aria-label={t("select.more")}
              data-testid="elementMore"
              sx={{ width: 28, height: 28 }}
            >
              <MoreHoriz fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {variant?.anchorKind === "text" && (
          <Typography
            data-testid="elementTextAnchor"
            sx={{
              px: 1.75,
              py: 1,
              fontSize: 12,
              color: tokens.status.changed.fg,
              bgcolor: tokens.status.changed.bg,
              borderBottom: `1px solid ${tokens.border}`,
            }}
          >
            {t("select.textAnchor")}
          </Typography>
        )}
        {!rule && variants.length > 1 && (
          <Box
            role="radiogroup"
            aria-label={t("select.foundBy")}
            sx={{ p: 0.75, borderBottom: `1px solid ${tokens.border}` }}
          >
            {variants.map((item) => {
              const chosen = item.selector === variant?.selector;
              return (
                <ButtonBase
                  key={item.selector}
                  role="radio"
                  aria-checked={chosen}
                  title={item.selector}
                  onClick={() => onChooseVariant?.(item)}
                  data-testid={`elementVariant-${item.direction}`}
                  sx={{
                    display: "flex",
                    gap: 1,
                    width: "100%",
                    borderRadius: "8px",
                    px: 1.25,
                    py: 0.75,
                    font: "inherit",
                    fontSize: 13,
                    fontWeight: chosen ? 600 : 500,
                    color: chosen ? tokens.text : tokens.textSecondary,
                    bgcolor: chosen ? tokens.subtle : "transparent",
                    "&:hover, &.Mui-focusVisible": { bgcolor: tokens.subtle },
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      flexGrow: 1,
                      textAlign: "left",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {relationTo(item, t)}
                  </Box>
                  <Box
                    component="span"
                    sx={{ fontSize: 11, color: tokens.textMuted }}
                  >
                    {t("select.found", { count: item.count })}
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>
        )}
        {rule ? (
          <Box
            sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box sx={swatch(rule.action)} />
              <Typography sx={{ fontSize: 14, fontWeight: 600, flexGrow: 1 }}>
                {ruleLabel}
              </Typography>
              <Typography sx={{ fontSize: 12, color: tokens.textMuted }}>
                {rule.scope === "project"
                  ? t("select.allScreens")
                  : t("select.thisScreen")}
              </Typography>
            </Box>
            <Button
              size="small"
              color={confirming ? "error" : "primary"}
              variant={confirming ? "contained" : "text"}
              disabled={busy}
              data-testid="elementRemoveRule"
              sx={{ alignSelf: "flex-start" }}
              // a rule for every screen is asked about: it changes the whole project
              onClick={() =>
                rule.scope === "project" && !confirming
                  ? setConfirming(true)
                  : onRemove(rule)
              }
            >
              {confirming ? t("select.confirmRemove") : t("select.remove")}
            </Button>
          </Box>
        ) : (
          <>
            <Box sx={{ p: 0.75 }}>
              {actionButton("ignore", t("select.ignore"), "I")}
              {actionButton("compare", t("select.compareSelected"), "C")}
              {actionButton(
                "tolerate",
                t("select.allow", { percent: ALLOW_PERCENT }),
                "T",
              )}
            </Box>
            <Box
              sx={{ p: 1.25, pt: 1, borderTop: `1px solid ${tokens.border}` }}
            >
              <Box
                sx={{
                  display: "flex",
                  bgcolor: tokens.subtle,
                  borderRadius: "8px",
                  p: "2px",
                }}
              >
                {scopeButton("screen", t("select.thisScreen"))}
                {scopeButton("project", t("select.allScreens"))}
              </Box>
            </Box>
          </>
        )}
      </Paper>
    </Popper>
  );
};
