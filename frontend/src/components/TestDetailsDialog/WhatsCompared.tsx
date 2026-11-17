import React from "react";
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CheckRounded,
  Close,
  MoreHoriz,
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
  ignoreZoneGroups,
  Overview,
} from "../../_helpers/whatsCompared.helper";
import { expectedOf, variableShown } from "../../_helpers/variableText.helper";
import { ComparedMap } from "./ComparedMap";
import { tokens, type, radius } from "../../theme";
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
  // opens the rule's element with its rule, as a click on it does (REQ-073-15)
  onEditRule: (rule: ScreenRule) => void;
}

type Swatch = "compare" | "ignore" | "tolerate" | "variable" | "gone" | "off";

const swatchSx = (swatch: Swatch) => {
  const base = {
    width: 14,
    height: 14,
    borderRadius: radius.control,
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
    case "variable":
      return {
        ...base,
        outline: `1.5px solid ${tokens.variable}`,
        outlineOffset: -1.5,
        background: `repeating-linear-gradient(135deg, ${tokens.variable} 0 2px, transparent 2px 5px)`,
      };
    case "off":
      return { ...base, border: `1px dashed ${tokens.borderStrong}` };
  }
};

// set as a sentence: capitals shout over the rows they head (REQ-036-30)
const groupTitleSx = {
  fontSize: 13,
  fontWeight: 500,
  color: tokens.textMuted,
} as const;

const rowSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.25,
  fontSize: type.small,
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

const STATE_TONE = {
  same: "passed",
  changed: "changed",
  disappeared: "failed",
  appeared: "failed",
  resized: "failed",
  "nothing-found": "failed",
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
 * What this screen is compared on, under the changes (REQ-030-20…24, 40, 41;
 * spec 073): the map of the screen on the left, the rules by what they do on
 * the right, always open and without a summary that only repeats them.
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
  onEditRule,
}) => {
  const { t } = useT();
  // the variable-text row whose menu is open, and where
  const [menu, setMenu] = React.useState<{
    anchor: HTMLElement;
    item: CompareRow;
  }>();
  const suggestions = new Map(
    (structure.areaSuggestions ?? []).map((item) => [item.areaId, item]),
  );
  const problems = structure.compareOnly?.problems ?? [];
  const noTree = problems.some((problem) => problem.kind === "no-tree");
  const oneTree = problems.find((problem) => problem.kind === "one-tree");

  const { summary } = overview;
  const headline =
    summary.kind === "only"
      ? t("compared.only")
      : summary.kind === "none"
        ? t("compared.none")
        : summary.kind === "except"
          ? t("compared.except")
          : t("compared.whole");

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
        <Close sx={{ fontSize: type.title }} />
      </IconButton>
    );

  const row = (item: CompareRow, muted = false) => {
    const swatch: Swatch = muted
      ? "off"
      : item.action === "tolerate"
        ? "tolerate"
        : item.action === "compare"
          ? "compare"
          : item.action === "variable"
            ? "variable"
            : "ignore";
    const reason =
      item.rule?.problem === "pattern"
        ? t("compared.reason.pattern")
        : item.effect === "nothing-found"
          ? t("compared.reason.nothingFound")
          : item.effect === "no-tree"
            ? t("compared.reason.noTree")
            : item.effect === "overridden"
              ? t("compared.variable.overridden")
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
              sx={{ minWidth: 0, p: 0, fontSize: type.small, flexShrink: 0 }}
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
            {element.rule && removeButton(element.rule)}
          </Box>
        </Tooltip>
        {fact && (
          <Box
            sx={{
              fontSize: type.small,
              color: tokens.textMuted,
              pl: 3,
              mt: -0.25,
            }}
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

  // a text with its marked part: what it was and is now, and whether it holds (REQ-073-10…12)
  const variableRow = (item: CompareRow) => {
    const rule = item.rule as ScreenRule;
    const check = rule.check;
    const items = check?.items ?? [];
    const failed = items.filter((entry) => !entry.ok);
    const shown = failed[0] ?? items[0];
    const parts = rule.parts ?? [];
    const expected = expectedOf(parts);
    // the baseline's text of the element, when the rule finds one there
    const onBaseline = (structure.baselineElements ?? []).filter(
      (element) => element.selector === rule.selector && !!element.text,
    );
    const before = onBaseline.length === 1 ? onBaseline[0].text : undefined;
    const bad = !!check && (check.gone || failed.length > 0);
    const failing = bad && !!shown && !shown.ok;
    // what it says now; without a text on the snapshot, what it said when the check was made.
    // A value that broke the rule needs no old one beside it: "expected" says it (REQ-073-12)
    const segments: Array<{ text: string; place: boolean; was?: string }> =
      shown && !failing
        ? variableShown(parts, shown.text, before)
        : shown
          ? variableShown(parts, shown.text, shown.text)
          : expected;

    const others = items.filter((entry) => entry !== shown);
    const note = !check
      ? t("compared.variable.notChecked")
      : check.gone
        ? t("compared.variable.goneLine")
        : failing
          ? t("compared.variable.expectedLine", {
              text: expected.map((segment) => segment.text).join(""),
            })
          : "";
    return (
      <Box
        key={item.key}
        data-testid="variableRule"
        data-state={!check ? "unchecked" : bad ? "failed" : "fits"}
        onMouseEnter={() => onPreview(item.key)}
        onMouseLeave={() => onPreview(undefined)}
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.25,
          px: 1.25,
          py: 1,
          borderRadius: radius.control,
          fontSize: type.body,
          lineHeight: 1.5,
          bgcolor: bad ? tokens.status.failed.bg : tokens.subtle,
          outline: bad ? `1px solid ${tokens.status.failed.fg}` : "none",
          outlineOffset: -1,
        }}
      >
        <Box sx={{ ...swatchSx(bad ? "gone" : "variable"), mt: 0.4 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* the whole text: the value that changed is the point, it must not be cut off */}
          <Box
            component="span"
            data-testid="variableNow"
            sx={{ overflowWrap: "anywhere" }}
          >
            {segments.map((segment, i) =>
              segment.place ? (
                <React.Fragment key={i}>
                  {segment.was && (
                    <Box
                      component="del"
                      data-testid="variableWas"
                      sx={{ color: tokens.textMuted }}
                    >
                      {segment.was}
                    </Box>
                  )}
                  {segment.was && " "}
                  <Box
                    component="span"
                    sx={{
                      fontWeight: 600,
                      color: failing
                        ? tokens.status.failed.fg
                        : tokens.variable,
                    }}
                  >
                    {segment.text || " "}
                  </Box>
                </React.Fragment>
              ) : (
                <span key={i}>{segment.text}</span>
              ),
            )}
          </Box>
          {note && (
            <Box
              data-testid="variableExpected"
              sx={{
                fontSize: type.small,
                color: tokens.textMuted,
                overflowWrap: "anywhere",
              }}
            >
              {note}
            </Box>
          )}
          {others.length > 0 && (
            <Box
              sx={{
                fontSize: type.small,
                color: tokens.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {[
                ...others.slice(0, 2).map((entry) => entry.text),
                ...(others.length > 2
                  ? [t("compared.variable.more", { count: others.length - 2 })]
                  : []),
              ].join(" · ")}
            </Box>
          )}
        </Box>
        {check && !bad && (
          <Tooltip title={t("compared.variable.holds")}>
            <CheckRounded
              data-testid="variableHolds"
              aria-label={t("compared.variable.holds")}
              sx={{
                fontSize: type.section,
                color: tokens.status.passed.fg,
                mt: 0.25,
                flexShrink: 0,
              }}
            />
          </Tooltip>
        )}
        {canEdit && (
          <IconButton
            size="small"
            data-testid="variableMenu"
            aria-label={t("compared.variable.menu")}
            aria-haspopup="menu"
            disabled={busy}
            onClick={(event) => setMenu({ anchor: event.currentTarget, item })}
            sx={{ width: 26, height: 26, flexShrink: 0, mt: -0.25 }}
          >
            <MoreHoriz sx={{ fontSize: type.section }} />
          </IconButton>
        )}
      </Box>
    );
  };

  const group = (title: string, rows: CompareRow[], testId: string) =>
    rows.length > 0 && (
      <Box
        data-testid={testId}
        sx={{ display: "flex", flexDirection: "column" }}
      >
        <Box sx={{ ...groupTitleSx, mb: 0.5 }}>{title}</Box>
        {rows.map((item) => row(item))}
      </Box>
    );

  const zoneTitle = {
    test: t("compared.zones.test"),
    project: t("compared.zones.project"),
    manual: t("compared.zones.manual"),
  } as const;

  return (
    <Box
      component="section"
      data-testid="whatsCompared"
      aria-label={t("compared.title")}
      sx={{
        display: "grid",
        gridTemplateColumns: structure.size
          ? "auto minmax(0, 1fr)"
          : "minmax(0, 1fr)",
        columnGap: 2.5,
        alignItems: "start",
      }}
    >
      {structure.size && (
        <ComparedMap
          size={structure.size}
          overview={overview}
          changes={structure.regions.map((item) => item.region)}
          label={t("compared.map", { summary: headline })}
          width={104}
        />
      )}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.25,
          minWidth: 0,
        }}
      >
        {noTree && (
          <Typography
            sx={{ fontSize: type.small, color: tokens.textSecondary }}
          >
            {t("compared.noTreeHelp")}
          </Typography>
        )}

        {overview.compared.length > 0 && (
          <Box
            data-testid="comparedGroup"
            sx={{ display: "flex", flexDirection: "column" }}
          >
            <Box sx={{ ...groupTitleSx, mb: 0.5 }}>
              {t("compared.group.compared")}
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
              borderRadius: radius.control,
              px: 1.5,
              py: 1.25,
              bgcolor: tokens.status.changed.bg,
              color: tokens.text,
            }}
          >
            <WarningAmberRounded
              sx={{
                fontSize: type.title,
                color: tokens.status.changed.fg,
                mt: 0.15,
              }}
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
              borderRadius: radius.control,
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

        {overview.variable.length > 0 && (
          <Box
            data-testid="variableGroup"
            sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}
          >
            <Box sx={groupTitleSx}>{t("compared.group.variable")}</Box>
            {overview.variable.map(variableRow)}
          </Box>
        )}

        {overview.ignored.length > 0 && (
          <Box
            data-testid="ignoredGroup"
            sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}
          >
            <Box sx={groupTitleSx}>{t("compared.group.ignored")}</Box>
            {ignoreZoneGroups(overview.ignored).map(({ group, rows }) => (
              <Box
                key={group}
                data-testid="ignoreZones"
                data-group={group}
                sx={{ display: "flex", flexDirection: "column" }}
              >
                <Box
                  sx={{
                    fontSize: type.caption,
                    color: tokens.textMuted,
                    mb: 0.25,
                  }}
                >
                  {zoneTitle[group]}
                </Box>
                {rows.map((item) => row(item))}
              </Box>
            ))}
          </Box>
        )}

        {group(
          t("compared.group.tolerated"),
          overview.tolerated,
          "toleratedGroup",
        )}

        {overview.outside.length > 0 && (
          <Box
            data-testid="outsideGroup"
            sx={{ display: "flex", flexDirection: "column" }}
          >
            <Tooltip
              placement="left"
              title={
                overview.only
                  ? t("compared.outsideHelp")
                  : t("compared.nothingFoundHelp")
              }
            >
              <Box sx={{ ...groupTitleSx, mb: 0.5, alignSelf: "flex-start" }}>
                {t("compared.group.outside")}
              </Box>
            </Tooltip>
            {overview.outside.map((item) => row(item, true))}
          </Box>
        )}
      </Box>

      <Menu
        anchorEl={menu?.anchor}
        open={!!menu}
        onClose={() => setMenu(undefined)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          data-testid="variableEdit"
          onClick={() => {
            if (menu?.item.rule) onEditRule(menu.item.rule);
            setMenu(undefined);
          }}
        >
          {t("compared.variable.edit")}
        </MenuItem>
        <MenuItem
          data-testid="variableShow"
          onClick={() => {
            if (menu) onPinMark(menu.item.key);
            setMenu(undefined);
          }}
        >
          {t("compared.variable.show")}
        </MenuItem>
        <MenuItem
          data-testid="variableRemove"
          sx={{ color: tokens.status.failed.fg }}
          onClick={() => {
            if (menu?.item.rule) onRemove(menu.item.rule);
            setMenu(undefined);
          }}
        >
          {t("panel.removeRule")}
        </MenuItem>
      </Menu>
    </Box>
  );
};
