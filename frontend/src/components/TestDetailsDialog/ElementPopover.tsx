import React from "react";
import {
  Box,
  Button,
  ButtonBase,
  ClickAwayListener,
  IconButton,
  Paper,
  Popper,
  Tooltip,
  Typography,
} from "@mui/material";
import { Check, MoreHoriz } from "@mui/icons-material";
import {
  ElementRuleAction,
  LeftOut,
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
  shortAnchor,
} from "../../_helpers/elementPicking.helper";
import {
  fitsParts,
  hasPlace,
  markedFrom,
  otherDiffers,
  readable,
  partsOf,
  patternFor,
  placesIn,
  plainText,
  splitPieces,
  variableSelector,
  wordsOnly,
} from "../../_helpers/variableText.helper";
import { tokens, type, radius } from "../../theme";
import { useT, type MessageKey } from "../../i18n";
import {
  ActionButtons,
  ScopeToggle,
  swatch,
  useActionKeys,
} from "./ElementActions";

// why the whole element is not compared (REQ-066-06, REQ-071-10)
const LEFT_OUT_REASON: Record<NonNullable<LeftOut["reason"]>, MessageKey> = {
  "own-text": "select.leftOutOwnText",
  resized: "select.leftOutResized",
  unpaired: "select.leftOutUnpaired",
  "not-found-current": "select.leftOutNotFoundCurrent",
  "not-found-baseline": "select.leftOutNotFoundBaseline",
  timeout: "select.leftOutTimeout",
};

interface ElementPopoverProps {
  // where the element was clicked, in the window
  anchor: { x: number; y: number };
  // where the element is in the window: the popover stands beside it, not over it (REQ-067-01)
  elementRect?: () => DOMRect | undefined;
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
  countFor?: (selector: string, parts: TextPart[]) => number | null;
  onDrawArea?: () => void;
  // what the element's variable-text rule leaves out of the comparison here (REQ-066-06)
  leftOut?: LeftOut;
  // the one text drawn inside an element whose own text is a label, and moving to it (REQ-066-08, 09)
  shownText?: PickableElement;
  onShownText?: () => void;
  // open with the text in pieces: the marking moved here from the element around (REQ-066-09)
  startMarking?: boolean;
}

/**
 * What can be done with an element clicked on a screenshot, next to it
 * (REQ-024-03): ignore it, compare only it, allow small changes in it, on
 * this screen or every screen. The keys I, C and T do the same.
 */
export const ElementPopover: React.FunctionComponent<ElementPopoverProps> = ({
  anchor,
  elementRect,
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
  leftOut,
  shownText,
  onShownText,
  startMarking,
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
  } | null>(() =>
    startMarking && plainText(element.text ?? "")
      ? { marked: new Set<number>() }
      : null,
  );
  // another element: start over; the one it opened on keeps the marking moved to it (REQ-066-09)
  const opened = React.useRef(`${element.selector}|${element.index}`);
  React.useEffect(() => {
    if (opened.current === `${element.selector}|${element.index}`) return;
    opened.current = `${element.selector}|${element.index}`;
    setVariable(null);
  }, [element.selector, element.index]);
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
  // what the same element says differently on the other screenshot (REQ-072-04, 05)
  const differs =
    other && marked ? otherDiffers(parts, text, other.text) : null;
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

  const { x, y, width, height } = element.bounds;
  const virtualAnchor = React.useMemo(
    () => ({
      getBoundingClientRect: () =>
        elementRect?.() ?? (new DOMRect(anchor.x, anchor.y, 0, 0) as DOMRect),
    }),
    // a step up or down moves the popover to the new element's side
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchor.x, anchor.y, x, y, width, height],
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
  const choosing = !rule && !variable && variants.length > 1;
  // the ways to find it say how it is found; the title only names it (REQ-067-02)
  const title = choosing ? element.element : name;

  const ruleLabel = rule
    ? rule.action === "ignore"
      ? t("select.ruleIgnore")
      : rule.action === "compare"
        ? t("select.ruleCompare")
        : rule.action === "variable"
          ? t("select.ruleVariable")
          : t("select.ruleTolerate", { percent: rule.maxDiffPercent ?? 5 })
    : null;
  const count = selector && countFor ? countFor(selector, parts) : null;

  return (
    <Popper
      open
      anchorEl={virtualAnchor}
      placement={elementRect ? "right-start" : "right"}
      modifiers={[
        { name: "offset", options: { offset: [0, 14] } },
        {
          name: "flip",
          options: { fallbackPlacements: ["left-start", "bottom", "top"] },
        },
      ]}
      sx={{ zIndex: 1400 }}
    >
      <ClickAwayListener
        mouseEvent="onMouseDown"
        touchEvent="onTouchStart"
        onClickAway={(event) => {
          // the screenshots decide for themselves: a click there picks another
          // element or, beside every element, closes this (REQ-024-11)
          const target = event.target as Element | null;
          if (target?.closest?.(".konvajs-content")) return;
          onClose();
        }}
      >
        <Paper
          role="dialog"
          aria-label={name}
          data-testid="elementPopover"
          sx={{
            width: 300,
            borderRadius: radius.card,
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
                sx={{ fontSize: type.body, fontWeight: 600 }}
                title={element.selector}
                data-testid="elementTitle"
              >
                {title}
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
            {/* always there, as ↑ is, so the buttons beside it stay put (REQ-067-05) */}
            <Tooltip title={t("select.child")}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canGoDown}
                  onClick={onDown}
                  aria-label={t("select.child")}
                  data-testid="elementChild"
                  sx={{ fontSize: 13, width: 28, height: 28 }}
                >
                  ↓
                </IconButton>
              </span>
            </Tooltip>
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
              {variant.anchorMatch === "start"
                ? t("select.textAnchorStart", { text: variant.anchor })
                : t("select.textAnchor")}
            </Typography>
          )}
          {choosing && (
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
                      alignItems: "center",
                      gap: 1,
                      width: "100%",
                      borderRadius: radius.control,
                      px: 1,
                      py: 0.75,
                      font: "inherit",
                      fontSize: 13,
                      fontWeight: chosen ? 600 : 500,
                      color: chosen ? tokens.text : tokens.textSecondary,
                      bgcolor: chosen ? tokens.subtle : "transparent",
                      "&:hover, &.Mui-focusVisible": { bgcolor: tokens.subtle },
                    }}
                  >
                    <Check
                      aria-hidden
                      sx={{
                        fontSize: type.body,
                        color: tokens.brand,
                        visibility: chosen ? "visible" : "hidden",
                      }}
                    />
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
                      {relationTo(
                        { ...item, anchor: shortAnchor(item.anchor) },
                        t,
                      )}
                    </Box>
                    {/* one is what is expected; only more, or none, needs a look (REQ-067-04) */}
                    {item.count !== 1 && (
                      <Box
                        component="span"
                        data-testid="elementVariantCount"
                        sx={{
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                          fontSize: type.caption,
                          fontWeight: 600,
                          color: tokens.status.changed.fg,
                        }}
                      >
                        {t("select.found", { count: item.count })}
                      </Box>
                    )}
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
                    borderRadius: radius.control,
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
                      fontSize: type.caption,
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
                {shownText && onShownText && !variable.replaces && (
                  <Box
                    data-testid="variableShownText"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: tokens.textMuted,
                        flexGrow: 1,
                      }}
                    >
                      {t("select.shownText", { text: shownText.text ?? "" })}
                    </Typography>
                    <Button
                      size="small"
                      onClick={onShownText}
                      data-testid="variableMarkInIt"
                    >
                      {t("select.markInIt")}
                    </Button>
                  </Box>
                )}
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
                        {readable(piece.text).trim()}
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
                  {marked && wordsOnly(parts)
                    ? t("select.variableAnyWord")
                    : marked
                      ? t("select.variableRest")
                      : t("select.variableClick")}
                </Typography>
                {differs && other && (
                  <Typography
                    data-testid="variableOther"
                    sx={{
                      fontSize: 12,
                      lineHeight: 1.4,
                      color: tokens.status.changed.fg,
                      bgcolor: tokens.status.changed.bg,
                      borderRadius: radius.control,
                      px: 1.25,
                      py: 1,
                    }}
                  >
                    {"words" in differs
                      ? t("select.variableOtherWords", {
                          side: t(
                            other.side === "baseline"
                              ? "select.variableSideBaseline"
                              : "select.variableSideCurrent",
                          ),
                          words: differs.words
                            .map((word) => `«${readable(word).trim()}»`)
                            .join(", "),
                        })
                      : t("select.variableOtherValue", {
                          side: t(
                            other.side === "baseline"
                              ? "select.variableSideBaseline"
                              : "select.variableSideCurrent",
                          ),
                          value: readable(differs.value).trim(),
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
                        borderRadius: radius.control,
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
                  sx={{ fontSize: type.small }}
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
                          borderRadius: radius.control,
                          px: 0.5,
                        }}
                      >
                        {readable(segment.text)}
                      </Box>
                    ) : (
                      <span key={i}>{readable(segment.text)}</span>
                    ),
                  )}
                </Typography>
              )}
              {rule.action === "variable" && leftOut && (
                <Typography
                  data-testid="variableLeftOut"
                  sx={{ fontSize: 12, color: tokens.textMuted }}
                >
                  {leftOut.reason
                    ? t("select.leftOutWhole", {
                        reason: t(LEFT_OUT_REASON[leftOut.reason], {
                          value: leftOut.missing ?? "",
                        }),
                      })
                    : leftOut.located
                      ? t("select.leftOutPieces")
                      : t("select.leftOutText")}
                </Typography>
              )}
              {rule.action === "variable" &&
                rule.parts &&
                wordsOnly(rule.parts) && (
                  // a plain fact, not a warning: marking a whole word is how a word is left out (REQ-073-01)
                  <Typography
                    data-testid="variableWordsOnly"
                    sx={{ fontSize: 12, color: tokens.textMuted }}
                  >
                    {t("select.variableAnyWord")}
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
              {/* where the rule goes is chosen before what it does: an action saves at once (REQ-067-06) */}
              <Box sx={{ p: 1.25, pb: 0.5 }}>
                <ScopeToggle scope={scope} onScope={setScope} />
              </Box>
              <Box sx={{ p: 0.75, pt: 0 }}>
                <ActionButtons
                  scope={scope}
                  busy={busy}
                  onAct={act}
                  compareLabel={t("select.compareSelected")}
                  variableBlocked={
                    text ? undefined : t("select.variableNoText")
                  }
                />
              </Box>
            </>
          )}
          {!variable && (
            // a hint more than an action: one quiet line (REQ-067-07)
            <Box sx={{ p: 0.75, borderTop: `1px solid ${tokens.border}` }}>
              <ButtonBase
                onClick={onAddMore}
                data-testid="elementAddMore"
                sx={{
                  display: "flex",
                  gap: 1,
                  width: "100%",
                  borderRadius: radius.control,
                  px: 1.25,
                  py: 0.75,
                  font: "inherit",
                  fontSize: type.small,
                  fontWeight: 500,
                  color: tokens.textSecondary,
                  "&:hover, &.Mui-focusVisible": {
                    color: tokens.text,
                    bgcolor: tokens.subtle,
                  },
                }}
              >
                <Box component="span" sx={{ flexGrow: 1, textAlign: "left" }}>
                  {t("select.addMore")}
                </Box>
                <Box
                  component="span"
                  sx={{
                    fontSize: type.caption,
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
      </ClickAwayListener>
    </Popper>
  );
};
