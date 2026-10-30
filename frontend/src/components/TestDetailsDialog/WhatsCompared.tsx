import React from "react";
import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import {
  ChevronRightRounded,
  Close,
  WarningAmberRounded,
} from "@mui/icons-material";
import {
  CompareOnlyProblem,
  ScreenRule,
  StructureInfo,
} from "../../types/insights";
import {
  ComparedRow,
  CompareRow,
  foundOn,
  Overview,
} from "../../_helpers/whatsCompared.helper";
import { ComparedMap } from "./ComparedMap";
import { tokens } from "../../theme";
import { Text, useT } from "../../i18n";

export {
  areaMarkId,
  ruleMarkId,
  testAreaMarkId,
} from "../../_helpers/whatsCompared.helper";

interface WhatsComparedProps {
  structure: StructureInfo;
  overview: Overview;
  // opens the Areas menu with this drawn area chosen in it
  onOpenArea: (areaId: string) => void;
  // an area the test sent, lit on the screenshot until clicked again
  pinnedMark?: string;
  onPinMark: (id: string) => void;
  canEdit: boolean;
  busy: boolean;
  onRemove: (rule: ScreenRule) => void;
  // a compared element that is gone, new or found nothing, with Undo (REQ-030-41)
  onRemoveFromCompared: (rule: ScreenRule) => void;
  onUseElement: (areaId: string) => void;
  // what the pointer is over, to light it up on the screenshots (REQ-024-24)
  onPreview: (id: string | undefined) => void;
}

type Swatch = "compare" | "ignore" | "tolerate" | "gone" | "off";

const swatchSx = (swatch: Swatch) => {
  const base = {
    width: 14,
    height: 14,
    borderRadius: "3px",
    boxSizing: "border-box",
    flexShrink: 0,
  } as const;
  switch (swatch) {
    case "compare":
      return { ...base, border: `2px solid ${tokens.brand}` };
    case "gone":
      return { ...base, border: `2px dashed ${tokens.status.failed.fg}` };
    case "ignore":
      return {
        ...base,
        outline: `1.5px solid ${tokens.status.neutral.fg}`,
        outlineOffset: -1.5,
        background: `repeating-linear-gradient(135deg, ${tokens.status.neutral.bar} 0 2px, transparent 2px 5px)`,
      };
    case "tolerate":
      return { ...base, border: `1.5px dashed ${tokens.status.new.fg}` };
    case "off":
      return { ...base, border: `1px dashed ${tokens.borderStrong}` };
  }
};

const groupTitleSx = {
  fontSize: 11.5,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: tokens.textMuted,
} as const;

const rowSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.25,
  fontSize: 13.5,
  mx: -0.75,
  px: 0.75,
  minHeight: 30,
  borderRadius: "6px",
  "&:hover": { bgcolor: tokens.subtle },
  "&:hover .remove, & .remove:focus-visible": { opacity: 1 },
  "&:focus-visible": {
    outline: `2px solid ${tokens.brand}`,
    outlineOffset: -2,
  },
} as const;

const nameSx = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const Chip: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Box
    component="span"
    sx={{
      fontSize: 11.5,
      color: tokens.textSecondary,
      border: `1px solid ${tokens.borderStrong}`,
      borderRadius: "999px",
      px: 0.9,
      flexShrink: 0,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </Box>
);

const STATE_TONE = {
  same: "passed",
  changed: "changed",
  disappeared: "failed",
  appeared: "failed",
  resized: "failed",
  "nothing-found": "failed",
} as const;

const SOURCE_KEY = {
  screen: "compared.source.screen",
  project: "compared.source.project",
  drawn: "compared.source.drawn",
  test: "compared.source.test",
  testSetting: "compared.source.testSetting",
  projectSetting: "compared.source.projectSetting",
} as const;

const stateKey = {
  same: "compared.state.same",
  changed: "compared.state.changed",
  disappeared: "compared.state.disappeared",
  appeared: "compared.state.appeared",
  resized: "compared.state.resized",
  "nothing-found": "compared.state.nothingFound",
} as const;

export function describeProblem(problem: CompareOnlyProblem, t: Text): string {
  switch (problem.kind) {
    case "no-tree":
      return t("verdict.notAppliedWhy");
    case "one-tree":
      return t(
        problem.missing === "baseline"
          ? "compared.oneTree.baseline"
          : "compared.oneTree.current",
      );
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

/** "down 24 dp, left 8 dp" for an element compared at its new place. */
function moveText(shift: { dx: number; dy: number }, t: Text): string {
  return [
    shift.dy
      ? t(shift.dy > 0 ? "panel.down" : "panel.up", {
          count: Math.abs(shift.dy),
        })
      : "",
    shift.dx
      ? t(shift.dx > 0 ? "panel.right" : "panel.left", {
          count: Math.abs(shift.dx),
        })
      : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * What this screenshot is compared on, second in the Changes tab
 * (REQ-030-10…24, 40, 41): a summary with a map of the screen, then rows by
 * what they do, each saying where it comes from. What changes nothing — it
 * lies outside the chosen elements or found nothing — is folded away.
 */
export const WhatsCompared: React.FunctionComponent<WhatsComparedProps> = ({
  structure,
  overview,
  onOpenArea,
  pinnedMark,
  onPinMark,
  canEdit,
  busy,
  onRemove,
  onRemoveFromCompared,
  onUseElement,
  onPreview,
}) => {
  const { t } = useT();
  const [outsideOpen, setOutsideOpen] = React.useState(false);
  const suggestions = new Map(
    (structure.areaSuggestions ?? []).map((item) => [item.areaId, item]),
  );
  const problems = structure.compareOnly?.problems ?? [];
  const noTree = problems.some((problem) => problem.kind === "no-tree");
  const oneTree = problems.find((problem) => problem.kind === "one-tree");

  const { summary } = overview;
  const headline =
    summary.kind === "only"
      ? t("compared.only", { count: summary.count })
      : summary.kind === "none"
        ? t("compared.none")
        : summary.kind === "except"
          ? t("compared.except", { count: summary.count })
          : t("compared.whole");
  const help = noTree
    ? t("compared.noTreeHelp")
    : summary.kind === "only"
      ? t("compared.onlyHelp")
      : summary.kind === "none"
        ? t("compared.noneHelp")
        : summary.kind === "except"
          ? t("compared.exceptHelp")
          : t("compared.wholeHelp");

  const sourceText = (row: CompareRow) => t(SOURCE_KEY[row.source]);

  const rowName = (row: CompareRow) => {
    if (row.rule) return ruleName(row.rule, structure);
    if (row.area)
      return t("areas.area", {
        width: Math.round(row.area.width),
        height: Math.round(row.area.height),
      });
    return t("compared.systemBars");
  };

  const removeButton = (rule: ScreenRule) =>
    canEdit && (
      <IconButton
        className="remove"
        size="small"
        disabled={busy}
        aria-label={t("panel.removeRule")}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(rule);
        }}
        sx={{ opacity: 0, width: 24, height: 24, flexShrink: 0 }}
      >
        <Close sx={{ fontSize: 15 }} />
      </IconButton>
    );

  const row = (item: CompareRow, muted = false) => {
    const swatch: Swatch = muted
      ? "off"
      : item.action === "tolerate"
        ? "tolerate"
        : item.action === "compare"
          ? "compare"
          : "ignore";
    const reason =
      item.effect === "nothing-found"
        ? t("compared.reason.nothingFound")
        : item.effect === "no-tree"
          ? t("compared.reason.noTree")
          : null;
    const opens = item.kind === "area" || item.kind === "testArea";
    const open = () => {
      if (item.kind === "area" && item.area) onOpenArea(String(item.area.id));
      if (item.kind === "testArea") onPinMark(item.key);
    };
    const suggestion =
      item.kind === "area" && item.area
        ? suggestions.get(String(item.area.id))
        : undefined;
    const content = (
      <Box
        key={item.key}
        data-testid={
          item.kind === "rule"
            ? "elementRule"
            : item.kind === "area"
              ? "comparedArea"
              : item.kind === "testArea"
                ? "comparedTestArea"
                : "comparedSystemBars"
        }
        data-effect={item.effect}
        role={opens ? "button" : undefined}
        tabIndex={opens ? 0 : undefined}
        aria-pressed={
          item.kind === "testArea" ? pinnedMark === item.key : undefined
        }
        onClick={opens ? open : undefined}
        onKeyDown={
          opens
            ? (event: React.KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  open();
                }
              }
            : undefined
        }
        onMouseEnter={() => onPreview(item.key)}
        onMouseLeave={() => onPreview(undefined)}
        sx={{
          ...rowSx,
          cursor: opens ? "pointer" : "default",
          color: muted ? tokens.textMuted : tokens.text,
          bgcolor:
            item.kind === "testArea" && pinnedMark === item.key
              ? tokens.subtle
              : "transparent",
        }}
      >
        <Box sx={swatchSx(swatch)} />
        <Box component="span" sx={nameSx}>
          {rowName(item)}
        </Box>
        {item.action === "tolerate" && !muted && (
          <Box
            component="span"
            sx={{ fontSize: 12, fontWeight: 600, color: tokens.status.new.fg }}
          >
            ±{item.rule?.maxDiffPercent ?? 5}%
          </Box>
        )}
        {suggestion && canEdit && !muted && (
          <Tooltip
            title={t("areas.useElementHelp", { element: suggestion.element })}
          >
            <Button
              size="small"
              disabled={busy}
              sx={{ minWidth: 0, p: 0, fontSize: 12.5, flexShrink: 0 }}
              onClick={(event) => {
                event.stopPropagation();
                onUseElement(String(suggestion.areaId));
              }}
            >
              {t("areas.useElement")}
            </Button>
          </Tooltip>
        )}
        {reason && (
          <Box component="span" sx={{ fontSize: 12, flexShrink: 0 }}>
            {reason}
          </Box>
        )}
        <Chip>{sourceText(item)}</Chip>
        {item.rule && removeButton(item.rule)}
      </Box>
    );
    if (!item.rule) return content;
    const found = foundOn(item.rule);
    // selector and counts stay one hover away (REQ-019-02)
    return (
      <Tooltip
        key={item.key}
        placement="left"
        title={t("compared.found", {
          selector: item.rule.selector,
          current: found.current,
          baseline: found.baseline,
        })}
      >
        {content}
      </Tooltip>
    );
  };

  const anyProblem = overview.compared.some(
    (element) => element.state !== "same" && element.state !== "changed",
  );
  const comparedRow = (element: ComparedRow) => {
    const gone =
      element.state === "disappeared" || element.state === "nothing-found";
    const tone = tokens.status[STATE_TONE[element.state]];
    // with one tree nothing was followed, so there is nothing to say about a move
    const fact = oneTree
      ? null
      : element.shiftDp
        ? `${t("compared.foundBoth")} · ${moveText(element.shiftDp, t)}`
        : null;
    return (
      <Box
        key={element.key}
        data-testid="comparedElement"
        data-state={element.state}
      >
        <Tooltip
          placement="left"
          title={
            element.rule
              ? t("compared.found", {
                  selector: element.rule.selector,
                  current: foundOn(element.rule).current,
                  baseline: foundOn(element.rule).baseline,
                })
              : ""
          }
        >
          <Box
            onMouseEnter={() =>
              onPreview(element.rule ? `rule:${element.rule.id}` : undefined)
            }
            onMouseLeave={() => onPreview(undefined)}
            sx={rowSx}
          >
            <Box sx={swatchSx(gone ? "gone" : "compare")} />
            <Box component="span" sx={nameSx}>
              {element.element}
            </Box>
            {(anyProblem || element.state !== "same") && (
              <Box
                component="span"
                data-testid="comparedState"
                sx={{
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: "999px",
                  px: 0.9,
                  flexShrink: 0,
                  bgcolor: tone.bg,
                  color: tone.fg,
                }}
              >
                {t(stateKey[element.state])}
              </Box>
            )}
            {element.rule && <Chip>{t(SOURCE_KEY[element.rule.scope])}</Chip>}
            {element.rule && removeButton(element.rule)}
          </Box>
        </Tooltip>
        {fact && (
          <Box
            sx={{ fontSize: 12.5, color: tokens.textMuted, pl: 3, mt: -0.25 }}
          >
            {fact}
          </Box>
        )}
        {element.inside.length > 0 && (
          <Box sx={{ pl: 3 }}>
            {element.inside.map((item) => (
              <Box
                key={item.key}
                sx={{ display: "flex", flexDirection: "column" }}
              >
                {row(item)}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  // the rules to offer removing: one per rule, however many of its elements are gone
  const removable = [
    ...new Map(
      overview.compared
        .filter(
          (element) =>
            element.rule &&
            (element.state === "disappeared" ||
              element.state === "appeared" ||
              element.state === "nothing-found"),
        )
        .map((element) => [element.ruleId, element]),
    ).values(),
  ];

  const group = (title: string, rows: CompareRow[], testId: string) =>
    rows.length > 0 && (
      <Box
        data-testid={testId}
        sx={{ display: "flex", flexDirection: "column" }}
      >
        <Box sx={{ ...groupTitleSx, mb: 0.5 }}>
          {title} · {rows.length}
        </Box>
        {rows.map((item) => row(item))}
      </Box>
    );

  return (
    <Box
      component="section"
      data-testid="whatsCompared"
      aria-label={t("compared.title")}
      sx={{
        border: `1px solid ${tokens.border}`,
        borderRadius: "12px",
        px: 1.75,
        py: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Box sx={{ display: "flex", gap: 1.75 }}>
        {structure.size && (
          <ComparedMap
            size={structure.size}
            overview={overview}
            changes={structure.regions.map((item) => item.region)}
            label={t("compared.map", { summary: headline })}
          />
        )}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Box sx={groupTitleSx}>{t("compared.title")}</Box>
          <Typography
            data-testid="comparedSummary"
            sx={{ fontSize: 17, fontWeight: 650, lineHeight: 1.3 }}
          >
            {headline}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: tokens.textSecondary }}>
            {help}
          </Typography>
        </Box>
      </Box>

      {overview.compared.length > 0 && (
        <Box
          data-testid="comparedGroup"
          sx={{ display: "flex", flexDirection: "column" }}
        >
          <Box sx={{ ...groupTitleSx, mb: 0.5 }}>
            {t("compared.group.compared")} · {overview.compared.length}
          </Box>
          {overview.compared.map(comparedRow)}
        </Box>
      )}

      {oneTree && (
        <Box
          data-testid="compareOnlyProblem"
          sx={{
            display: "flex",
            gap: 1.25,
            fontSize: 13,
            lineHeight: 1.5,
            borderRadius: "8px",
            px: 1.5,
            py: 1.25,
            bgcolor: tokens.status.changed.bg,
            color: tokens.text,
          }}
        >
          <WarningAmberRounded
            sx={{ fontSize: 18, color: tokens.status.changed.fg, mt: 0.15 }}
          />
          <span>{describeProblem(oneTree, t)}</span>
        </Box>
      )}

      {removable.length > 0 && (
        <Box
          data-testid="compareOnlyProblem"
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            fontSize: 13,
            lineHeight: 1.5,
            borderRadius: "8px",
            px: 1.5,
            py: 1.25,
            bgcolor: tokens.status.failed.bg,
            color: tokens.text,
          }}
        >
          <span>{t("compared.problemHelp")}</span>
          {canEdit && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {removable.map((element) => (
                <Button
                  key={element.ruleId}
                  size="small"
                  variant="outlined"
                  disabled={busy}
                  data-testid="removeFromCompared"
                  onClick={() =>
                    element.rule && onRemoveFromCompared(element.rule)
                  }
                >
                  {t("compared.removeFromCompared")}
                  {removable.length > 1 ? `: ${element.element}` : ""}
                </Button>
              ))}
            </Box>
          )}
        </Box>
      )}

      {group(t("compared.group.ignored"), overview.ignored, "ignoredGroup")}
      {group(
        t("compared.group.tolerated"),
        overview.tolerated,
        "toleratedGroup",
      )}

      {overview.outside.length > 0 && (
        <Box
          data-testid="outsideGroup"
          sx={{
            borderTop: `1px solid ${tokens.border}`,
            pt: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            component="button"
            type="button"
            aria-expanded={outsideOpen}
            data-testid="outsideToggle"
            onClick={() => setOutsideOpen((open) => !open)}
            sx={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 1,
              minHeight: 28,
              borderRadius: "6px",
              "&:focus-visible": {
                outline: `2px solid ${tokens.brand}`,
                outlineOffset: 2,
              },
            }}
          >
            <ChevronRightRounded
              sx={{
                fontSize: 18,
                color: tokens.textMuted,
                transform: outsideOpen ? "rotate(90deg)" : "none",
                transition: "transform 200ms",
              }}
            />
            <Box component="span" sx={groupTitleSx}>
              {t("compared.group.outside")} · {overview.outside.length}
            </Box>
            {overview.only && (
              <Box
                component="span"
                sx={{ ml: "auto", fontSize: 12.5, color: tokens.textMuted }}
              >
                {t("compared.outsideHint")}
              </Box>
            )}
          </Box>
          {outsideOpen && (
            <Box sx={{ display: "flex", flexDirection: "column", pt: 0.5 }}>
              <Box sx={{ fontSize: 12.5, color: tokens.textMuted, mb: 0.5 }}>
                {overview.only
                  ? t("compared.outsideHelp")
                  : t("compared.nothingFoundHelp")}
              </Box>
              {overview.outside.map((item) => row(item, true))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
