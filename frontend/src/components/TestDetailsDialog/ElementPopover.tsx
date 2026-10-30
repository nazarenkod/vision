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

  useActionKeys({ onAct, onUp, onDown, onClose, scope, busy });

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
            {sameSelector > 1 && (
              <Typography sx={{ fontSize: 12, color: tokens.textMuted }}>
                {t("select.onScreen", { count: sameSelector })}
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
              <ActionButtons
                scope={scope}
                busy={busy}
                onAct={onAct}
                compareLabel={t("select.compareSelected")}
              />
            </Box>
            <Box
              sx={{ p: 1.25, pt: 1, borderTop: `1px solid ${tokens.border}` }}
            >
              <ScopeToggle scope={scope} onScope={setScope} />
            </Box>
          </>
        )}
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
              sx={{ fontSize: 11.5, fontWeight: 500, color: tokens.textMuted }}
            >
              {t("select.addMoreShift")}
            </Box>
          </ButtonBase>
        </Box>
      </Paper>
    </Popper>
  );
};
