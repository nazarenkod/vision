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
  TextPart,
} from "../../types/insights";
import {
  chosenVariant,
  elementLabel,
  relationTo,
} from "../../_helpers/elementPicking.helper";
import {
  fitsParts,
  hasPlace,
  markedFrom,
  partsOf,
  patternFor,
  placesIn,
  plainText,
  splitPieces,
  variableSelector,
} from "../../_helpers/variableText.helper";
import { tokens } from "../../theme";
import { useT } from "../../i18n";
import {
  ActionButtons,
  ScopeToggle,
  swatch,
  useActionKeys,
} from "./ElementActions";

interface ElementPopoverProps {
  // where the element was clicked, in the window
  anchor: { x: number; y: number };
  element: PickableElement;
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
  // more elements join with the next clicks (REQ-028-01)
  onAddMore: () => void;
  // a variable-text rule, in place of the rule it replaces if any (spec 033)
  onVariable: (rule: {
    parts: TextPart[];
    scope: RuleScope;
    selector: string;
    replaces?: ScreenRule;
  }) => void;
  // the same element on the other screenshot, to warn when its text will not fit (REQ-033-08)
  other?: { side: "baseline" | "current"; text: string };
  // how many elements a selector finds on this screenshot, where that can be told
  countFor?: (selector: string) => number | null;
  onDrawArea?: () => void;
}

/**
 * What can be done with an element clicked on a screenshot, next to it
 * (REQ-024-03): ignore it, compare only it, allow small changes in it, on
 * this screen or every screen. The keys I, C and T do the same.
 */
export const ElementPopover: React.FunctionComponent<ElementPopoverProps> = ({
  anchor,
  element,
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
  onAddMore,
  onVariable,
  other,
  countFor,
  onDrawArea,
}) => {
  const { t } = useT();
  const [scope, setScope] = React.useState<RuleScope>("screen");
  const [confirming, setConfirming] = React.useState(false);
  React.useEffect(() => setConfirming(false), [rule?.id]);

  // marking the part of the text that changes (spec 033)
  const text = plainText(element.text ?? "");
  const pieces = React.useMemo(() => splitPieces(text), [text]);
  const [variable, setVariable] = React.useState<{
    marked: Set<number>;
    replaces?: ScreenRule;
  } | null>(null);
  React.useEffect(() => setVariable(null), [element.selector, element.index]);
  const startVariable = (replaces?: ScreenRule) => {
    if (!text) return;
    setVariable({
      replaces,
      marked:
        replaces?.action === "variable" && replaces.parts
          ? markedFrom(replaces.parts, text)
          : new Set(),
    });
  };
  const parts = variable ? partsOf(text, pieces, variable.marked) : [];
  const marked = !!variable && hasPlace(parts);
  const selector = marked ? variableSelector(element, parts) : null;
  const otherFits = !other || !marked || fitsParts(parts, other.text);
  const canSave = marked && !!selector && fitsParts(parts, text) && !busy;
  const save = () => {
    if (!variable || !canSave || !selector) return;
    onVariable({
      parts,
      scope: variable.replaces?.scope ?? scope,
      selector,
      replaces: variable.replaces,
    });
  };
  const toggle = (index: number) =>
    setVariable((current) => {
      if (!current) return current;
      const next = new Set(current.marked);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...current, marked: next };
    });
  const act = (action: ElementRuleAction, actScope: RuleScope) =>
    action === "variable" ? startVariable() : onAct(action, actScope);

  const virtualAnchor = React.useMemo(
    () => ({
      getBoundingClientRect: () =>
        new DOMRect(anchor.x, anchor.y, 0, 0) as DOMRect,
    }),
    [anchor.x, anchor.y],
  );

  useActionKeys({
    onAct: variable ? undefined : act,
    onUp,
    onDown,
    onClose: variable ? () => setVariable(null) : onClose,
    onEnter: variable ? save : undefined,
    scope,
    busy,
  });

  const name = elementLabel(element, t);
  const variant = chosenVariant(element);
  const variants = element.variants ?? [];

  const ruleLabel = rule
    ? rule.action === "ignore"
      ? t("select.ruleIgnore")
      : rule.action === "compare"
        ? t("select.ruleCompare")
        : rule.action === "variable"
          ? t("select.ruleVariable")
          : t("select.ruleTolerate", { percent: rule.maxDiffPercent ?? 5 })
    : null;
  const count = selector && countFor ? countFor(selector) : null;

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
            {(variable ? (count ?? 0) : sameSelector) > 1 && (
              <Typography sx={{ fontSize: 12, color: tokens.textMuted }}>
                {t("select.onScreen", {
                  count: variable ? (count ?? 0) : sameSelector,
                })}
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
        {!variable && variant?.anchorKind === "text" && (
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
        {!rule && !variable && variants.length > 1 && (
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
        {variable ? (
          <>
            <Box sx={{ p: 0.75, pb: 0 }}>
              <ButtonBase
                onClick={() => setVariable(null)}
                aria-label={t("select.variableBack")}
                data-testid="variableBack"
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
                  color: tokens.text,
                  bgcolor: tokens.subtle,
                }}
              >
                <Box
                  component="span"
                  sx={{ color: tokens.textMuted, width: 16 }}
                >
                  ←
                </Box>
                <Box sx={swatch("variable")} />
                <Box component="span" sx={{ flexGrow: 1, textAlign: "left" }}>
                  {t("select.variable")}
                </Box>
                <Box
                  component="span"
                  sx={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: tokens.textMuted,
                  }}
                >
                  V
                </Box>
              </ButtonBase>
            </Box>
            <Box
              sx={{
                px: 1.75,
                py: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
              }}
            >
              <Box
                role="group"
                aria-label={t("select.variableClick")}
                sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
              >
                {pieces.map((piece, index) => {
                  const on = variable.marked.has(index);
                  const button = (
                    <ButtonBase
                      key={index}
                      aria-pressed={on}
                      data-testid="variablePiece"
                      onClick={() => toggle(index)}
                      sx={{
                        border: `1px solid ${on ? tokens.variable : tokens.border}`,
                        bgcolor: on ? tokens.variableSoft : tokens.surface,
                        color: on ? tokens.variable : tokens.text,
                        borderRadius: "6px",
                        px: 0.875,
                        py: 0.375,
                        font: "inherit",
                        fontSize: 13,
                        fontWeight: on ? 600 : 500,
                        "&.Mui-focusVisible": {
                          outline: `2px solid ${tokens.brand}`,
                          outlineOffset: 1,
                        },
                      }}
                    >
                      {piece.text}
                    </ButtonBase>
                  );
                  // the pattern is one hover away, not a line of its own (REQ-033-06)
                  return on ? (
                    <Tooltip
                      key={index}
                      title={t("select.variablePattern", {
                        pattern: patternFor(piece.text),
                      })}
                    >
                      {button}
                    </Tooltip>
                  ) : (
                    button
                  );
                })}
              </Box>
              <Typography
                data-testid="variableHint"
                sx={{ fontSize: 12, color: tokens.textMuted }}
              >
                {marked ? t("select.variableRest") : t("select.variableClick")}
              </Typography>
              {!otherFits && other && (
                <Typography
                  data-testid="variableOther"
                  sx={{
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: tokens.status.changed.fg,
                    bgcolor: tokens.status.changed.bg,
                    borderRadius: "8px",
                    px: 1.25,
                    py: 1,
                  }}
                >
                  {t("select.variableOther", {
                    side: t(
                      other.side === "baseline"
                        ? "select.variableSideBaseline"
                        : "select.variableSideCurrent",
                    ),
                    text: other.text,
                  })}
                </Typography>
              )}
              {marked && !selector && (
                <Box
                  data-testid="variableNoAnchor"
                  sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                >
                  <Typography
                    sx={{
                      fontSize: 12,
                      lineHeight: 1.4,
                      color: tokens.status.changed.fg,
                      bgcolor: tokens.status.changed.bg,
                      borderRadius: "8px",
                      px: 1.25,
                      py: 1,
                    }}
                  >
                    {t("select.variableNoAnchor")}
                  </Typography>
                  {canGoUp && (
                    <Button
                      size="small"
                      onClick={onUp}
                      sx={{ alignSelf: "flex-start" }}
                    >
                      ↑ {t("select.parent")}
                    </Button>
                  )}
                  {onDrawArea && (
                    <Button
                      size="small"
                      onClick={onDrawArea}
                      sx={{ alignSelf: "flex-start" }}
                    >
                      {t("select.drawArea")}
                    </Button>
                  )}
                </Box>
              )}
            </Box>
            <Box
              sx={{
                p: 1.25,
                pt: 1,
                borderTop: `1px solid ${tokens.border}`,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Box sx={{ flexGrow: 1 }}>
                {variable.replaces ? (
                  <Typography sx={{ fontSize: 12, color: tokens.textMuted }}>
                    {variable.replaces.scope === "project"
                      ? t("select.allScreens")
                      : t("select.thisScreen")}
                  </Typography>
                ) : (
                  <ScopeToggle scope={scope} onScope={setScope} />
                )}
              </Box>
              <Button
                size="small"
                variant="contained"
                disableElevation
                disabled={!canSave}
                onClick={save}
                data-testid="variableSave"
              >
                {t("select.variableSave")}
              </Button>
            </Box>
          </>
        ) : rule ? (
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
            {rule.action === "variable" && rule.parts && text && (
              <Typography
                sx={{ fontSize: 13.5 }}
                data-testid="variableRuleText"
              >
                {placesIn(rule.parts, text).map((segment, i) =>
                  segment.place ? (
                    <Box
                      key={i}
                      component="span"
                      sx={{
                        fontWeight: 600,
                        color: tokens.variable,
                        bgcolor: tokens.variableSoft,
                        borderRadius: "4px",
                        px: 0.5,
                      }}
                    >
                      {segment.text}
                    </Box>
                  ) : (
                    <span key={i}>{segment.text}</span>
                  ),
                )}
              </Typography>
            )}
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {text &&
                (rule.action === "variable" || rule.action === "ignore") && (
                  <Button
                    size="small"
                    disabled={busy}
                    data-testid="variableStart"
                    onClick={() => startVariable(rule)}
                  >
                    {rule.action === "variable"
                      ? t("select.change")
                      : t("select.checkText")}
                  </Button>
                )}
              <Button
                size="small"
                color={confirming ? "error" : "primary"}
                variant={confirming ? "contained" : "text"}
                disabled={busy}
                data-testid="elementRemoveRule"
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
          </Box>
        ) : (
          <>
            <Box sx={{ p: 0.75 }}>
              <ActionButtons
                scope={scope}
                busy={busy}
                onAct={act}
                compareLabel={t("select.compareSelected")}
                variableBlocked={text ? undefined : t("select.variableNoText")}
              />
            </Box>
            <Box
              sx={{ p: 1.25, pt: 1, borderTop: `1px solid ${tokens.border}` }}
            >
              <ScopeToggle scope={scope} onScope={setScope} />
            </Box>
          </>
        )}
        {!variable && (
          <Box sx={{ p: 1.25, pt: 0 }}>
            <ButtonBase
              onClick={onAddMore}
              data-testid="elementAddMore"
              sx={{
                display: "flex",
                gap: 1,
                width: "100%",
                borderRadius: "8px",
                border: `1px dashed ${tokens.borderStrong}`,
                px: 1.25,
                py: 0.75,
                font: "inherit",
                fontSize: 13,
                fontWeight: 600,
                color: tokens.text,
                "&:hover, &.Mui-focusVisible": {
                  borderColor: tokens.brand,
                  bgcolor: tokens.brandSoft,
                },
              }}
            >
              <Box component="span" sx={{ flexGrow: 1, textAlign: "left" }}>
                {t("select.addMore")}
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: tokens.textMuted,
                }}
              >
                {t("select.addMoreShift")}
              </Box>
            </ButtonBase>
          </Box>
        )}
      </Paper>
    </Popper>
  );
};
