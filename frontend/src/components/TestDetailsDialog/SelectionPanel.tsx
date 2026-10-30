import React from "react";
import { Box, Button, ButtonBase, IconButton, Paper } from "@mui/material";
import { Close } from "@mui/icons-material";
import {
  ElementRuleAction,
  PickableElement,
  RuleScope,
  ScreenRule,
} from "../../types/insights";
import { elementLabel } from "../../_helpers/elementPicking.helper";
import { tokens } from "../../theme";
import { useT } from "../../i18n";
import {
  ActionButtons,
  ScopeToggle,
  swatch,
  useActionKeys,
} from "./ElementActions";

interface SelectionPanelProps {
  // where it sits: at the bottom, or at the top when it would cover a selected element
  side: "bottom" | "top";
  // in the order they were selected; the number is the place here
  selected: Array<{
    element: PickableElement;
    // how many elements its selector takes on the screenshot
    count: number;
    rule?: ScreenRule;
  }>;
  offer: "act" | "remove" | "none";
  // the last click tried to add one past the limit (REQ-028-05)
  limit?: number;
  busy: boolean;
  onAct: (action: ElementRuleAction, scope: RuleScope) => void;
  onRemoveRules: () => void;
  onUnselect: (element: PickableElement) => void;
  onHover: (index: number | null) => void;
  onClear: () => void;
}

/**
 * Two or three elements selected at once: what they are, numbered as on the
 * screenshots, and one action for all, a rule each (REQ-028-10).
 */
export const SelectionPanel: React.FunctionComponent<SelectionPanelProps> = ({
  side,
  selected,
  offer,
  limit,
  busy,
  onAct,
  onRemoveRules,
  onUnselect,
  onHover,
  onClear,
}) => {
  const { t } = useT();
  const [scope, setScope] = React.useState<RuleScope>("screen");
  const [confirming, setConfirming] = React.useState(false);
  const rules = selected.flatMap((item) => (item.rule ? [item.rule] : []));
  const ruleIds = rules.map((rule) => rule.id).join(",");
  React.useEffect(() => setConfirming(false), [ruleIds]);
  useActionKeys({
    onAct: offer === "act" ? onAct : undefined,
    onClose: onClear,
    scope,
    busy,
  });
  const skipped = offer === "act" ? rules.length : 0;
  // a rule for every screen is asked about: it changes the whole project (REQ-028-32)
  const everyScreen = rules.some((rule) => rule.scope === "project");

  return (
    <Paper
      role="dialog"
      aria-label={t("select.selected", { count: selected.length })}
      data-testid="selectionPanel"
      data-side={side}
      // a press on it is not a press on the screenshot under it
      onMouseDown={(event) => event.stopPropagation()}
      sx={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        ...(side === "bottom" ? { bottom: 16 } : { top: 8 }),
        zIndex: 3,
        width: "min(680px, calc(100% - 32px))",
        borderRadius: "14px",
        boxShadow: tokens.shadowPop,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 2,
          pr: 1,
          pt: 1,
          pb: 0.75,
        }}
      >
        <Box sx={{ fontSize: 14.5, fontWeight: 600 }}>
          {t("select.selected", { count: selected.length })}
        </Box>
        <Box sx={{ fontSize: 12.5, color: tokens.textMuted, flexGrow: 1 }}>
          {t("selection.eachRule")}
        </Box>
        <Button
          size="small"
          onClick={onClear}
          data-testid="selectionClear"
          sx={{ color: tokens.textSecondary, fontWeight: 600 }}
        >
          {t("selection.clear")}
          <Box
            component="span"
            sx={{
              ml: 1,
              fontSize: 11,
              fontWeight: 500,
              color: tokens.textMuted,
            }}
          >
            Esc
          </Box>
        </Button>
      </Box>
      <Box
        sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, px: 2, pb: 1.25 }}
      >
        {selected.map(({ element, count, rule }, index) => {
          const name = elementLabel(element, t);
          return (
            <Box
              key={`${element.selector}:${element.bounds.x},${element.bounds.y}`}
              data-testid={`selectionItem-${index + 1}`}
              title={element.selector}
              onMouseEnter={() => onHover(index)}
              onMouseLeave={() => onHover(null)}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                maxWidth: 240,
                pl: 0.5,
                pr: 0.25,
                py: 0.25,
                borderRadius: "999px",
                border: `1px ${rule ? "dashed" : "solid"} ${tokens.border}`,
                bgcolor: rule ? "transparent" : tokens.subtle,
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  bgcolor: rule ? tokens.status.neutral.bar : tokens.brand,
                  color: tokens.brandInk,
                }}
              >
                {index + 1}
              </Box>
              {rule && <Box sx={swatch(rule.action, 12)} />}
              <Box
                component="span"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {count > 1 ? `${name} ×${count}` : name}
              </Box>
              <IconButton
                size="small"
                onClick={() => onUnselect(element)}
                aria-label={t("selection.unselect", { element: name })}
                data-testid={`selectionRemove-${index + 1}`}
                sx={{ width: 22, height: 22 }}
              >
                <Close sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          );
        })}
      </Box>
      {(skipped > 0 || limit) && (
        <Box
          sx={{
            px: 2,
            py: 0.75,
            fontSize: 12.5,
            color: tokens.status.changed.fg,
            bgcolor: tokens.status.changed.bg,
            borderTop: `1px solid ${tokens.border}`,
          }}
        >
          {limit ? (
            <span data-testid="selectionLimit">
              {t("selection.limit", { count: limit })}
            </span>
          ) : (
            <span data-testid="selectionSkipped">
              {t("selection.skipped", { count: skipped })}
            </span>
          )}
        </Box>
      )}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.75,
          borderTop: `1px solid ${tokens.border}`,
        }}
      >
        {offer === "act" && (
          <>
            <ActionButtons
              scope={scope}
              busy={busy}
              onAct={onAct}
              row
              compareLabel={t("selection.compareSelected")}
            />
            <Box sx={{ ml: "auto", minWidth: 210 }}>
              <ScopeToggle scope={scope} onScope={setScope} />
            </Box>
          </>
        )}
        {offer === "remove" && (
          <ButtonBase
            disabled={busy}
            data-testid="selectionRemoveRules"
            onClick={() =>
              everyScreen && !confirming ? setConfirming(true) : onRemoveRules()
            }
            sx={{
              borderRadius: "8px",
              px: 1.25,
              py: 1,
              font: "inherit",
              fontSize: 14,
              fontWeight: 600,
              color: confirming ? tokens.status.failed.fg : tokens.brand,
              "&:hover, &.Mui-focusVisible": { bgcolor: tokens.subtle },
            }}
          >
            {confirming
              ? t("select.confirmRemove")
              : t("selection.removeRules", { count: rules.length })}
          </ButtonBase>
        )}
        {offer === "none" && (
          <Box
            data-testid="selectionMixed"
            sx={{ px: 1, py: 0.75, fontSize: 13, color: tokens.textSecondary }}
          >
            {t("selection.mixed")}
          </Box>
        )}
      </Box>
    </Paper>
  );
};
