import React from "react";
import {
  Alert,
  Box,
  IconButton,
  Tooltip,
  Typography,
  Button,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import {
  CompareOnlyProblem,
  ElementRuleAction,
  ScreenRule,
  StructureInfo,
} from "../../types/insights";
import { IgnoreArea } from "../../types/ignoreArea";
import {
  foundOn,
  groupRules,
  summarize,
} from "../../_helpers/whatsCompared.helper";
import { tokens } from "../../theme";
import { Text, useT } from "../../i18n";

interface WhatsComparedProps {
  structure: StructureInfo;
  // drawn on this screenshot, and sent by the test with it
  areas: IgnoreArea[];
  testAreas: IgnoreArea[];
  // opens the Areas menu, with the area chosen when it can be edited there
  onOpenArea: (areaId: string | undefined) => void;
  canEdit: boolean;
  busy: boolean;
  onRemove: (rule: ScreenRule) => void;
  onUseElement: (areaId: string) => void;
  // what the pointer is over, to light it up on the screenshots (REQ-024-24)
  onPreview: (id: string | undefined) => void;
}

export const ruleMarkId = (ruleId: string) => `rule:${ruleId}`;
export const areaMarkId = (areaId: string) => `area:${areaId}`;

const swatch = (action: ElementRuleAction | "area") => {
  const base = {
    width: 14,
    height: 14,
    borderRadius: "3px",
    boxSizing: "border-box",
    flexShrink: 0,
  } as const;
  switch (action) {
    case "ignore":
      return {
        ...base,
        outline: `1.5px solid ${tokens.status.neutral.fg}`,
        background: `repeating-linear-gradient(135deg, ${tokens.status.neutral.bar} 0 3px, transparent 3px 6px)`,
      };
    case "compare":
      return { ...base, border: `2px solid ${tokens.brand}` };
    case "tolerate":
      return { ...base, border: `1.5px dashed ${tokens.status.new.fg}` };
    default:
      return {
        ...base,
        bgcolor: tokens.status.neutral.bg,
        border: `1px solid ${tokens.status.neutral.bar}`,
      };
  }
};

export function describeProblem(problem: CompareOnlyProblem, t: Text): string {
  switch (problem.kind) {
    case "no-tree":
      return t("compared.problem.noTree");
    case "nothing-found":
      return t("compared.problem.nothingFound", { selector: problem.selector });
    case "disappeared":
      return t("compared.problem.disappeared", { element: problem.element });
    case "appeared":
      return t("compared.problem.appeared", { element: problem.element });
    case "count":
      return t("compared.problem.count", {
        selector: problem.selector,
        baseline: problem.baseline,
        current: problem.current,
      });
    case "resized":
      return t("compared.problem.resized", { element: problem.element });
  }
}

/** The element a rule is about, as the reviewer would name it. */
function ruleName(rule: ScreenRule, structure: StructureInfo): string {
  const element = [
    ...(structure.elements ?? []),
    ...(structure.baselineElements ?? []),
  ].find((item) => item.selector === rule.selector);
  return element?.element ?? rule.selector;
}

/**
 * What this screenshot is compared on, first in the Changes tab
 * (REQ-024-22…24): one line, then the rules by what they do and the pixel
 * areas. Selectors and counts are in each row's tooltip (REQ-019-02).
 */
export const WhatsCompared: React.FunctionComponent<WhatsComparedProps> = ({
  structure,
  areas,
  testAreas,
  onOpenArea,
  canEdit,
  busy,
  onRemove,
  onUseElement,
  onPreview,
}) => {
  const { t } = useT();
  const summary = summarize(structure, areas.length + testAreas.length);
  const suggestions = new Map(
    (structure.areaSuggestions ?? []).map((item) => [item.areaId, item]),
  );

  const headline =
    summary.kind === "only"
      ? t("compared.only", { count: summary.elements })
      : summary.kind === "except"
        ? t("compared.except", { count: summary.elements })
        : t("compared.whole");

  const ruleRow = (rule: ScreenRule) => {
    const found = foundOn(rule);
    return (
      <Tooltip
        key={rule.id}
        placement="left"
        title={t("compared.found", {
          selector: rule.selector,
          current: found.current,
          baseline: found.baseline,
        })}
      >
        <Box
          data-testid="elementRule"
          onMouseEnter={() => onPreview(ruleMarkId(rule.id))}
          onMouseLeave={() => onPreview(undefined)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            fontSize: 13.5,
            mx: -0.75,
            px: 0.75,
            minHeight: 28,
            borderRadius: "6px",
            color:
              found.current || found.baseline ? tokens.text : tokens.textMuted,
            "&:hover": { bgcolor: tokens.subtle },
            "&:hover .remove, & .remove:focus-visible": { opacity: 1 },
          }}
        >
          <Box sx={swatch(rule.action)} />
          <Box
            component="span"
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {ruleName(rule, structure)}
          </Box>
          {rule.action === "tolerate" && (
            <Box
              component="span"
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: tokens.status.new.fg,
              }}
            >
              ±{rule.maxDiffPercent ?? 5}%
            </Box>
          )}
          {rule.scope === "project" && (
            <Box
              component="span"
              sx={{
                fontSize: 11,
                color: tokens.status.neutral.fg,
                border: `1px solid ${tokens.border}`,
                borderRadius: "999px",
                px: 0.9,
                flexShrink: 0,
              }}
            >
              {t("compared.allScreens")}
            </Box>
          )}
          {canEdit && (
            <IconButton
              className="remove"
              size="small"
              disabled={busy}
              aria-label={t("panel.removeRule")}
              onClick={() => onRemove(rule)}
              sx={{ ml: "auto", opacity: 0, width: 24, height: 24 }}
            >
              <Close sx={{ fontSize: 15 }} />
            </IconButton>
          )}
        </Box>
      </Tooltip>
    );
  };

  return (
    <Box
      component="section"
      data-testid="whatsCompared"
      sx={{
        border: `1px solid ${tokens.border}`,
        borderRadius: "12px",
        px: 1.75,
        py: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
      }}
    >
      <Typography
        data-testid="comparedSummary"
        sx={{ fontSize: 15, fontWeight: 600 }}
      >
        {headline}{" "}
        {summary.areas > 0 && (
          <Box
            component="span"
            sx={{ fontWeight: 400, color: tokens.textMuted }}
          >
            {t("compared.areas", { count: summary.areas })}
          </Box>
        )}
      </Typography>
      {(structure.compareOnly?.problems ?? []).map((problem, index) => (
        <Alert
          key={index}
          severity="warning"
          sx={{ py: 0 }}
          data-testid="compareOnlyProblem"
        >
          {describeProblem(problem, t)}
        </Alert>
      ))}
      {groupRules(structure.rules).flatMap((group) => group.rules.map(ruleRow))}
      {[
        ...areas.map((area) => ({ area, fromTest: false })),
        ...testAreas.map((area) => ({ area, fromTest: true })),
      ].map(({ area, fromTest }) => {
        const suggestion = fromTest
          ? undefined
          : suggestions.get(String(area.id));
        return (
          // an area is left out like an ignored element; a click opens it in the Areas menu
          <Box
            key={`${fromTest ? "test" : "own"}-${area.id}`}
            data-testid="comparedArea"
            role="button"
            tabIndex={0}
            onClick={() => onOpenArea(fromTest ? undefined : String(area.id))}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenArea(fromTest ? undefined : String(area.id));
              }
            }}
            onMouseEnter={() => onPreview(areaMarkId(area.id))}
            onMouseLeave={() => onPreview(undefined)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              fontSize: 13.5,
              mx: -0.75,
              px: 0.75,
              minHeight: 28,
              borderRadius: "6px",
              cursor: "pointer",
              color: tokens.text,
              "&:hover": { bgcolor: tokens.subtle },
              "&:focus-visible": {
                outline: `2px solid ${tokens.brand}`,
                outlineOffset: -2,
              },
            }}
          >
            <Box sx={swatch("ignore")} />
            <span>
              {t("areas.area", {
                width: Math.round(area.width),
                height: Math.round(area.height),
              })}
            </span>
            {fromTest && (
              <Box
                component="span"
                sx={{ ml: "auto", fontSize: 12, color: tokens.textMuted }}
              >
                {t("areas.fromTest")}
              </Box>
            )}
            {suggestion && canEdit && (
              <Tooltip
                title={t("areas.useElementHelp", {
                  element: suggestion.element,
                })}
              >
                <Button
                  size="small"
                  disabled={busy}
                  sx={{ ml: "auto", minWidth: 0, p: 0, fontSize: 12.5 }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onUseElement(String(area.id));
                  }}
                >
                  {t("areas.useElement")}
                </Button>
              </Tooltip>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
