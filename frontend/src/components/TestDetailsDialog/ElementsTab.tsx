import React from "react";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  Switch,
  TextField,
  ToggleButton,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ChevronRight,
  ContentCopyOutlined,
  CropFreeOutlined,
  ImageOutlined,
  InputOutlined,
  KeyboardArrowDown,
  KeyboardArrowUp,
  LinkOutlined,
  Search,
  SmartButtonOutlined,
  TextFieldsOutlined,
  ToggleOnOutlined,
  UnfoldLessOutlined,
  UnfoldMoreOutlined,
  ViewListOutlined,
  ViewStreamOutlined,
  WebAssetOutlined,
} from "@mui/icons-material";
import {
  A11yReport,
  InspectorNode,
  NodeLocators,
  StructuralChange,
  StructureInfo,
  TreeSide,
} from "../../types/insights";
import { insightsService } from "../../services";
import { useT } from "../../i18n";
import { motion, radius, tokens, type } from "../../theme";
import { StatusPill, PillTone } from "../StatusPill";
import { SlidingToggleGroup } from "../motion/SlidingToggleGroup";
import { describeChange } from "../ChangeGroups";
import {
  baselineValues,
  foldedPath,
  indentPlan,
  initialOpen,
  isMarked,
  isShown,
  keepWithAncestors,
  keyAction,
  marksByKey,
  matchesQuery,
  NodeKind,
  nodeKind,
  NodeMark,
  oneLine,
  openTo,
  sameNode,
  splitId,
  splitMatch,
  stepMarked,
  visibleRows,
} from "../../_helpers/treeInspector.helper";
import { InspectorTrees, treeOf } from "./useInspectorTrees";

// rows have one height, so only those in view are drawn: a tree can hold thousands
const ROW = 30;
// rows drawn above and below the view, so a quick scroll shows no gap
const SPARE_ROWS = 12;
// a level's line sits under the chevron of the level above
const LINE_AT = 7;
// the place for a row's level number while the top levels are left out (REQ-063-09)
const DEPTH_SLOT = 26;
// the tree's height in the panel: dragged between these, kept in this browser (REQ-063-16)
const TREE_HEIGHT = { initial: 360, min: 160, max: 800, step: 24 };
const TREE_HEIGHT_KEY = "vision.treeHeight";
// how long a copy button says Copied (REQ-062-24)
const COPIED_MS = 2000;

const CHANGE_TONE: Record<StructuralChange["kind"], PillTone> = {
  text: "changed",
  label: "changed",
  state: "changed",
  added: "new",
  removed: "failed",
  resized: "neutral",
  moved: "neutral",
};

// one icon per kind of element, so a button reads apart from a text at a glance (REQ-063-07)
const KIND_ICON: Record<NodeKind, typeof CropFreeOutlined> = {
  button: SmartButtonOutlined,
  link: LinkOutlined,
  text: TextFieldsOutlined,
  input: InputOutlined,
  image: ImageOutlined,
  toggle: ToggleOnOutlined,
  list: ViewListOutlined,
  cell: ViewStreamOutlined,
  window: WebAssetOutlined,
  container: CropFreeOutlined,
};
const KIND_COLOR: Record<NodeKind, string> = {
  button: tokens.brand,
  link: tokens.brand,
  toggle: tokens.brand,
  input: tokens.text,
  text: tokens.textSecondary,
  image: tokens.status.new.fg,
  list: tokens.textMuted,
  cell: tokens.textMuted,
  window: tokens.textMuted,
  container: tokens.textMuted,
};

const readHeight = () => {
  try {
    const kept = Number(window.localStorage.getItem(TREE_HEIGHT_KEY));
    return kept >= TREE_HEIGHT.min && kept <= TREE_HEIGHT.max
      ? kept
      : TREE_HEIGHT.initial;
  } catch {
    return TREE_HEIGHT.initial;
  }
};
const keepHeight = (height: number) => {
  try {
    window.localStorage.setItem(TREE_HEIGHT_KEY, String(height));
  } catch {
    // a private window keeps no height: the default stays
  }
};
const clampHeight = (height: number) =>
  Math.round(Math.min(TREE_HEIGHT.max, Math.max(TREE_HEIGHT.min, height)));

/** A value with the part a search found marked. */
const Marked: React.FunctionComponent<{ value: string; query: string }> = ({
  value,
  query,
}) => {
  const { before, match, after } = splitMatch(value, query);
  if (!match) return <>{value}</>;
  return (
    <>
      {before}
      <Box
        component="mark"
        sx={{
          bgcolor: tokens.status.changed.bg,
          color: tokens.status.changed.fg,
          borderRadius: radius.control,
          px: "1px",
        }}
      >
        {match}
      </Box>
      {after}
    </>
  );
};

export const KindIcon: React.FunctionComponent<{
  node: InspectorNode;
  size?: number;
}> = ({ node, size = 16 }) => {
  const kind = nodeKind(node);
  const Icon = KIND_ICON[kind];
  return (
    <Icon
      aria-hidden
      data-kind={kind}
      sx={{ fontSize: size, flexShrink: 0, color: KIND_COLOR[kind] }}
    />
  );
};

const smallButton = {
  p: 0.5,
  borderRadius: radius.control,
  color: tokens.textSecondary,
} as const;

interface Props {
  // the check has a tree of its own; without one the tab explains how to send it (REQ-062-07)
  hasTree: boolean;
  testRunId: string;
  trees: InspectorTrees;
  structure: StructureInfo | null | undefined;
  report: A11yReport | null | undefined;
  side: TreeSide;
  onSideChange: (side: TreeSide) => void;
  // a node of the shown tree, by index
  chosen?: number;
  onChoose: (index: number | undefined) => void;
  pointed?: number;
  onPoint: (index: number | undefined) => void;
  // the node a link named is not in the tree (REQ-062-34)
  notFound?: boolean;
  // the rule actions of Select elements, for a node they can act on (REQ-062-26, 27)
  canActOn?: (index: number) => boolean;
  onActions?: (index: number, anchor: { x: number; y: number }) => void;
  onFullScreen?: () => void;
  // the tree takes the height it is given instead of a fixed one: the inspector page
  fill?: boolean;
}

/** The check's UI tree beside the screenshot, as in Appium Inspector (062, 063). */
export const ElementsTab: React.FunctionComponent<Props> = ({
  hasTree,
  testRunId,
  trees,
  structure,
  report,
  side,
  onSideChange,
  chosen,
  onChoose,
  pointed,
  onPoint,
  notFound,
  canActOn,
  onActions,
  onFullScreen,
  fill,
}) => {
  const { t } = useT();
  const load = trees[side];
  const tree = treeOf(load);
  const nodes = React.useMemo(() => tree?.nodes ?? [], [tree]);
  const other = treeOf(trees[side === "current" ? "baseline" : "current"]);
  const baselineNodes = treeOf(trees.baseline)?.nodes;

  const changes = React.useMemo(
    () => [...(structure?.changes ?? []), ...(structure?.invisible ?? [])],
    [structure],
  );
  const marks = React.useMemo(
    () => marksByKey(changes, report?.violations ?? []),
    [changes, report],
  );
  const markOf = (node: InspectorNode): NodeMark | undefined =>
    marks.get(node.key);

  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<
    "changed" | "a11y" | "clickable" | null
  >(null);
  // wrappers only lay the others out: hidden unless asked for (REQ-063-01)
  const [wrappers, setWrappers] = React.useState(false);
  const [match, setMatch] = React.useState(0);
  // what is unfolded, per tree: set when a tree first comes (REQ-062-05)
  const [open, setOpen] = React.useState<Record<TreeSide, Set<number>>>({
    current: new Set(),
    baseline: new Set(),
  });
  const seeded = React.useRef<Partial<Record<TreeSide, unknown>>>({});
  React.useEffect(() => {
    if (!tree || seeded.current[side] === tree) return;
    seeded.current[side] = tree;
    setOpen((all) => ({
      ...all,
      [side]: initialOpen(tree.nodes, (node) => isMarked(marks.get(node.key))),
    }));
  }, [tree, side, marks]);

  // a wrapper chosen by a link is shown with the others (REQ-063-19)
  React.useEffect(() => {
    if (chosen !== undefined && nodes[chosen]?.wrapper) setWrappers(true);
  }, [chosen, nodes]);

  const passesFilter = React.useCallback(
    (node: InspectorNode) => {
      const mark = marks.get(node.key);
      if (filter === "changed") return !!mark?.change;
      if (filter === "a11y") return !!mark?.a11y;
      if (filter === "clickable") return node.clickable;
      return true;
    },
    [filter, marks],
  );
  const keep = React.useMemo(() => {
    if (!query.trim() && !filter) return null;
    return keepWithAncestors(
      nodes,
      (node) =>
        isShown(node, wrappers) &&
        matchesQuery(node, query) &&
        passesFilter(node),
    );
  }, [nodes, query, filter, wrappers, passesFilter]);
  const rows = React.useMemo(
    () => visibleRows(nodes, open[side], keep, wrappers),
    [nodes, open, side, keep, wrappers],
  );

  // what the search finds, in tree order, to step through (REQ-063-11)
  const hits = React.useMemo(
    () =>
      query.trim()
        ? nodes
            .filter(
              (node) =>
                isShown(node, wrappers) &&
                matchesQuery(node, query) &&
                passesFilter(node),
            )
            .map((node) => node.index)
        : [],
    [nodes, query, wrappers, passesFilter],
  );
  const marked = React.useMemo(
    () =>
      nodes
        .filter(
          (node) => isShown(node, wrappers) && isMarked(marks.get(node.key)),
        )
        .map((node) => node.index),
    [nodes, wrappers, marks],
  );
  const counts = React.useMemo(
    () => ({
      changed: nodes.filter((node) => marks.get(node.key)?.change).length,
      a11y: nodes.filter((node) => marks.get(node.key)?.a11y).length,
      clickable: nodes.filter((node) => node.clickable).length,
    }),
    [nodes, marks],
  );

  const toggle = (index: number, unfold: boolean) =>
    setOpen((all) => {
      const next = new Set(all[side]);
      if (unfold) next.add(index);
      else next.delete(index);
      return { ...all, [side]: next };
    });
  const unfoldBranch = (index: number) =>
    setOpen((all) => {
      const next = new Set(all[side]);
      const stack = [index];
      while (stack.length) {
        const at = stack.pop() as number;
        next.add(at);
        nodes.forEach((node) => node.parent === at && stack.push(node.index));
      }
      return { ...all, [side]: next };
    });

  const stepHit = (direction: 1 | -1) => {
    if (!hits.length) return;
    const next = (match + direction + hits.length) % hits.length;
    setMatch(next);
    onChoose(hits[next]);
  };
  const stepChange = (direction: 1 | -1) => {
    const next = stepMarked(marked, chosen, direction);
    if (next !== undefined) onChoose(next);
  };

  // a node chosen on the screenshot: its way down is unfolded and its row brought into view (REQ-062-12)
  const listRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [height, setHeight] = React.useState(readHeight);
  const [viewHeight, setViewHeight] = React.useState(height);
  const [treeWidth, setTreeWidth] = React.useState(0);
  React.useEffect(() => {
    if (chosen === undefined || !nodes[chosen]) return;
    setOpen((all) => {
      const next = openTo(all[side], nodes, chosen);
      return next.size === all[side].size ? all : { ...all, [side]: next };
    });
  }, [chosen, nodes, side]);
  React.useEffect(() => {
    const list = listRef.current;
    const at = rows.findIndex((row) => row.index === chosen);
    if (!list || at < 0) return;
    const top = at * ROW;
    if (top < list.scrollTop || top + ROW > list.scrollTop + list.clientHeight)
      list.scrollTop = Math.max(0, top - list.clientHeight / 2);
  }, [chosen, rows]);
  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      setViewHeight(list.clientHeight || height);
      setTreeWidth(list.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [tree, height]);

  const first = Math.max(0, Math.floor(scrollTop / ROW) - SPARE_ROWS);
  const last = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewHeight) / ROW) + SPARE_ROWS,
  );

  const node = chosen === undefined ? undefined : nodes[chosen];
  // the level the chosen node lies on: its line is lit (REQ-063-06)
  const chosenRow = rows.find((row) => row.index === chosen);
  const litLevel = chosenRow?.parent ?? null;
  // a deep tree narrows its levels so every row's own part stays in view (REQ-063-09)
  const indent = React.useMemo(
    () =>
      indentPlan(
        treeWidth,
        rows.reduce((deepest, item) => Math.max(deepest, item.depth), 0),
      ),
    [treeWidth, rows],
  );

  const [copiedRow, setCopiedRow] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (copiedRow === null) return;
    const timer = setTimeout(() => setCopiedRow(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copiedRow]);
  const copySelector = (item: InspectorNode) => {
    if (!item.selector) return;
    navigator.clipboard?.writeText(item.selector).catch(() => undefined);
    setCopiedRow(item.index);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    // the comparison's own keys (A, X, E…) stay out of the tree's way
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (key === "/") {
      event.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (key === "n" || key === "N") {
      event.preventDefault();
      event.stopPropagation();
      stepChange(event.shiftKey ? -1 : 1);
      return;
    }
    if ((key === "c" || key === "C") && node) {
      event.preventDefault();
      event.stopPropagation();
      copySelector(node);
      return;
    }
    if (key === "*" && chosen !== undefined) {
      event.preventDefault();
      unfoldBranch(chosen);
      return;
    }
    const action = keyAction(key, rows, chosen, nodes);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    if ("select" in action) onChoose(action.select);
    if ("open" in action) toggle(action.open, true);
    if ("fold" in action) toggle(action.fold, false);
  };

  // the splitter between the tree and the card (REQ-063-16)
  const resizeFrom = React.useRef<{ y: number; height: number } | null>(null);
  const setTreeHeight = (next: number) => {
    const clamped = clampHeight(next);
    setHeight(clamped);
    keepHeight(clamped);
  };

  const chip = (
    key: "changed" | "a11y" | "clickable",
    label: string,
    dot: string,
  ) => {
    const on = filter === key;
    return (
      <Box
        component="button"
        type="button"
        key={key}
        aria-pressed={on}
        data-testid={`treeChip-${key}`}
        onClick={() => setFilter(on ? null : key)}
        sx={{
          height: 28,
          px: 1.25,
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          borderRadius: radius.pill,
          border: `1px solid ${on ? tokens.brand : tokens.borderStrong}`,
          bgcolor: on ? tokens.brandSoft : "transparent",
          color: on ? tokens.text : tokens.textSecondary,
          fontSize: type.caption,
          fontWeight: 500,
          fontFamily: "inherit",
          cursor: "pointer",
          transition: `background-color ${motion.fast}ms, border-color ${motion.fast}ms`,
        }}
      >
        <Box
          component="span"
          sx={{ width: 7, height: 7, borderRadius: radius.pill, bgcolor: dot }}
        />
        {label}
        <Box
          component="span"
          sx={{ color: tokens.textMuted, fontVariantNumeric: "tabular-nums" }}
        >
          {counts[key]}
        </Box>
      </Box>
    );
  };

  const header = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <TextField
          size="small"
          value={query}
          inputRef={searchRef}
          onChange={(event) => {
            setQuery(event.target.value);
            setMatch(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              stepHit(event.shiftKey ? -1 : 1);
            }
            // Esc clears the search; the comparison stays open (REQ-063-18)
            if (event.key === "Escape" && query) {
              event.preventDefault();
              event.stopPropagation();
              setQuery("");
            }
          }}
          placeholder={t("tree.search")}
          inputProps={{
            "aria-label": t("tree.search"),
            "data-testid": "treeSearch",
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" sx={{ color: tokens.textMuted }} />
              </InputAdornment>
            ),
            endAdornment: query.trim() ? (
              <InputAdornment position="end" sx={{ gap: 0.25 }}>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  data-testid="treeHits"
                  sx={{ fontVariantNumeric: "tabular-nums", mr: 0.5 }}
                >
                  {hits.length
                    ? t("tree.hitOf", {
                        at: Math.min(match, hits.length - 1) + 1,
                        count: hits.length,
                      })
                    : "0"}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={t("tree.prevHit")}
                  onClick={() => stepHit(-1)}
                  disabled={!hits.length}
                  sx={smallButton}
                >
                  <KeyboardArrowUp fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t("tree.nextHit")}
                  data-testid="treeNextHit"
                  onClick={() => stepHit(1)}
                  disabled={!hits.length}
                  sx={smallButton}
                >
                  <KeyboardArrowDown fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <SlidingToggleGroup
          size="small"
          exclusive
          value={side}
          onChange={(_, value) => value && onSideChange(value)}
          aria-label={t("tree.sides")}
        >
          <ToggleButton value="current" data-testid="treeCurrent">
            {t("tree.current")}
          </ToggleButton>
          <ToggleButton value="baseline" data-testid="treeBaseline">
            {t("tree.baseline")}
          </ToggleButton>
        </SlidingToggleGroup>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          flexWrap: "wrap",
        }}
      >
        {chip("changed", t("tree.chipChanged"), tokens.status.changed.bar)}
        {chip("a11y", t("tree.chipA11y"), tokens.a11y)}
        {chip("clickable", t("tree.chipClickable"), tokens.brand)}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t("tree.wrappersHelp")} disableInteractive>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={wrappers}
                onChange={(_, on) => setWrappers(on)}
                inputProps={{ "aria-label": t("tree.wrappers") }}
                data-testid="treeWrappers"
              />
            }
            label={
              <Typography variant="caption" color="textSecondary">
                {t("tree.wrappers")}
              </Typography>
            }
            sx={{ mr: 0 }}
          />
        </Tooltip>
      </Box>
    </Box>
  );

  const pathBar = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        minHeight: 36,
        pl: 1,
        pr: 0.5,
        borderBottom: `1px solid ${tokens.border}`,
        bgcolor: tokens.subtle,
      }}
    >
      <Box
        component="nav"
        aria-label={t("tree.path")}
        data-testid="treePath"
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 0.25,
          overflow: "hidden",
          whiteSpace: "nowrap",
          fontSize: type.caption,
        }}
      >
        {node ? (
          foldedPath(nodes, node.index).map((step, i) => {
            const sep = i > 0 && (
              <Box
                component="span"
                aria-hidden
                sx={{ color: tokens.textMuted }}
              >
                ›
              </Box>
            );
            if (step.kind === "more")
              return (
                <React.Fragment key={`more-${i}`}>
                  {sep}
                  <Box
                    component="span"
                    sx={{ color: tokens.textMuted, px: 0.5 }}
                  >
                    …
                  </Box>
                </React.Fragment>
              );
            const at = nodes[step.index];
            const isLast = step.kind === "node" && step.index === node.index;
            const label =
              step.kind === "wrappers"
                ? `⋯ ${step.count}`
                : at.id
                  ? `${at.name} #${splitId(at.id).name}`
                  : at.name;
            return (
              <React.Fragment key={`${step.kind}-${step.index}`}>
                {sep}
                <Box
                  component="button"
                  type="button"
                  title={
                    step.kind === "wrappers"
                      ? t("tree.wrappersHidden", { count: step.count })
                      : at.className
                  }
                  onClick={() => {
                    if (step.kind === "wrappers") setWrappers(true);
                    onChoose(step.index);
                  }}
                  sx={{
                    // the folded wrappers and the chosen node keep their width; names give way
                    flexShrink: isLast || step.kind === "wrappers" ? 0 : 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    border: 0,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: radius.control,
                    font: "inherit",
                    fontWeight: isLast ? 600 : 400,
                    color: isLast
                      ? tokens.text
                      : step.kind === "wrappers"
                        ? tokens.textMuted
                        : tokens.textSecondary,
                    bgcolor: isLast ? tokens.border : "transparent",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </Box>
              </React.Fragment>
            );
          })
        ) : (
          <Typography variant="caption" color="textSecondary">
            {t("tree.count", { count: nodes.length })}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          width: "1px",
          height: 18,
          bgcolor: tokens.borderStrong,
          mx: 0.25,
        }}
      />
      <Tooltip title={t("tree.prevChange")} disableInteractive>
        <span>
          <IconButton
            size="small"
            aria-label={t("tree.prevChange")}
            onClick={() => stepChange(-1)}
            disabled={!marked.length}
            sx={{ ...smallButton, color: tokens.status.changed.fg }}
          >
            <KeyboardArrowUp fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Typography
        variant="caption"
        color="textSecondary"
        data-testid="treeChangeAt"
        sx={{
          fontVariantNumeric: "tabular-nums",
          minWidth: 32,
          textAlign: "center",
        }}
      >
        {`${chosen !== undefined && marked.includes(chosen) ? marked.indexOf(chosen) + 1 : "–"}/${marked.length}`}
      </Typography>
      <Tooltip title={t("tree.nextChange")} disableInteractive>
        <span>
          <IconButton
            size="small"
            aria-label={t("tree.nextChange")}
            data-testid="treeNextChange"
            onClick={() => stepChange(1)}
            disabled={!marked.length}
            sx={{ ...smallButton, color: tokens.status.changed.fg }}
          >
            <KeyboardArrowDown fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t("tree.expandAll")} disableInteractive>
        <IconButton
          size="small"
          aria-label={t("tree.expandAll")}
          data-testid="treeExpandAll"
          onClick={() =>
            setOpen((all) => ({
              ...all,
              [side]: new Set(nodes.map((item) => item.index)),
            }))
          }
          sx={smallButton}
        >
          <UnfoldMoreOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={t("tree.collapseAll")} disableInteractive>
        <IconButton
          size="small"
          aria-label={t("tree.collapseAll")}
          data-testid="treeCollapseAll"
          onClick={() => setOpen((all) => ({ ...all, [side]: new Set() }))}
          sx={smallButton}
        >
          <UnfoldLessOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  const row = (item: (typeof rows)[number], top: number) => {
    const at = nodes[item.index];
    const mark = markOf(at);
    const isChosen = item.index === chosen;
    const isPointed = item.index === pointed;
    const { name: idName, component } = splitId(at.id);
    const text = oneLine(at.text);
    return (
      <Box
        key={item.index}
        role="treeitem"
        aria-level={item.depth + 1}
        aria-selected={isChosen}
        aria-expanded={item.hasChildren ? item.open : undefined}
        data-testid="treeRow"
        data-index={item.index}
        onClick={() => onChoose(item.index)}
        onMouseEnter={() => onPoint(item.index)}
        sx={{
          position: "absolute",
          top,
          left: 0,
          right: 0,
          height: ROW,
          display: "flex",
          alignItems: "center",
          pl: 0.75,
          pr: 1,
          cursor: "pointer",
          fontSize: type.small,
          whiteSpace: "nowrap",
          overflow: "hidden",
          bgcolor: isChosen
            ? tokens.brandSoft
            : isPointed
              ? tokens.subtle
              : "transparent",
          boxShadow: isChosen ? `inset 0 0 0 1px ${tokens.brand}` : "none",
          transition: `background-color ${motion.fast}ms`,
          opacity: at.bounds ? 1 : 0.6,
          "&:hover .rowCopy": { visibility: "visible" },
        }}
      >
        {indent.skip > 0 && (
          <Box
            component="span"
            data-testid="treeDepth"
            title={t("tree.level", { level: item.depth + 1 })}
            sx={{
              width: DEPTH_SLOT,
              flexShrink: 0,
              font: `500 ${type.caption}px ${tokens.mono}`,
              color: tokens.textMuted,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {item.depth + 1}
          </Box>
        )}
        {item.levels.slice(indent.skip).map((level) => {
          const lit = level === litLevel;
          const line = lit ? tokens.brand : tokens.border;
          return (
            <Box
              key={level}
              aria-hidden
              data-testid="treeLevel"
              sx={{
                flexShrink: 0,
                alignSelf: "stretch",
                width: indent.level,
                // narrow levels keep only the lit line: dense lines read as a hatch
                ...(indent.lines || lit
                  ? {
                      backgroundImage: `linear-gradient(${line}, ${line})`,
                      backgroundSize: "1px 100%",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: `${Math.min(LINE_AT, indent.level - 1)}px 0`,
                    }
                  : {}),
              }}
            />
          );
        })}
        {item.hasChildren ? (
          <IconButton
            size="small"
            tabIndex={-1}
            aria-label={t(item.open ? "tree.fold" : "tree.expand", {
              name: at.name,
            })}
            onClick={(event) => {
              event.stopPropagation();
              toggle(item.index, !item.open);
            }}
            sx={{ p: 0.25, color: tokens.textMuted, flexShrink: 0 }}
          >
            <ChevronRight
              sx={{
                fontSize: 16,
                transform: item.open ? "rotate(90deg)" : "none",
                transition: `transform ${motion.fast}ms`,
              }}
            />
          </IconButton>
        ) : (
          <Box sx={{ width: 22, flexShrink: 0 }} />
        )}
        <Box sx={{ mx: 0.5, display: "flex" }}>
          <KindIcon node={at} />
        </Box>
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            fontWeight: isChosen ? 600 : 500,
            color: at.wrapper ? tokens.textMuted : tokens.text,
            mr: 0.75,
          }}
        >
          <Marked value={at.name} query={query} />
        </Box>
        {idName && (
          <Box
            component="span"
            title={at.id}
            sx={{
              flex: "0 1 auto",
              minWidth: 24,
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              font: `400 ${type.caption}px ${tokens.mono}`,
              color: tokens.textSecondary,
              mr: 0.75,
            }}
          >
            #<Marked value={idName} query={query} />
          </Box>
        )}
        {component && (
          <Box
            component="span"
            data-testid="treeComponent"
            sx={{
              flexShrink: 0,
              font: `500 ${type.caption}px ${tokens.mono}`,
              color: tokens.variable,
              bgcolor: tokens.variableSoft,
              px: 0.75,
              borderRadius: radius.pill,
              mr: 0.75,
            }}
          >
            {component}
          </Box>
        )}
        <Box
          component="span"
          sx={{
            flex: "1 1 auto",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: tokens.textMuted,
          }}
        >
          {text && (
            <>
              “<Marked value={text} query={query} />”
            </>
          )}
        </Box>
        {item.skipped > 0 && (
          <Box
            component="span"
            data-testid="treeSkipped"
            title={t("tree.wrappersHidden", { count: item.skipped })}
            sx={{
              flexShrink: 0,
              ml: 0.75,
              font: `500 ${type.caption}px ${tokens.mono}`,
              color: tokens.textMuted,
              border: `1px dashed ${tokens.borderStrong}`,
              px: 0.5,
              borderRadius: radius.pill,
              lineHeight: "16px",
            }}
          >
            +{item.skipped}
          </Box>
        )}
        {at.selector && (
          <Tooltip
            title={
              copiedRow === item.index
                ? t("tree.copied")
                : t("tree.copySelector")
            }
            disableInteractive
          >
            <IconButton
              size="small"
              className="rowCopy"
              data-testid="rowCopy"
              aria-label={t("tree.copySelector")}
              onClick={(event) => {
                event.stopPropagation();
                copySelector(at);
              }}
              sx={{
                ...smallButton,
                ml: 0.5,
                flexShrink: 0,
                visibility:
                  isChosen || copiedRow === item.index ? "visible" : "hidden",
              }}
            >
              <ContentCopyOutlined sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
        {item.hasChildren && !item.open && (
          <Box
            component="span"
            title={t("tree.inside")}
            sx={{
              flexShrink: 0,
              ml: 0.75,
              fontSize: type.caption,
              color: tokens.textMuted,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {item.childCount}
          </Box>
        )}
        <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0, ml: 0.75 }}>
          {mark?.change && (
            <StatusPill
              tone={CHANGE_TONE[mark.change]}
              label={t(`tree.change.${mark.change}`)}
            />
          )}
          {!!mark?.a11y && (
            <StatusPill
              tone="changed"
              label={t("tree.a11y")}
              title={t("tree.a11yTitle")}
            />
          )}
        </Box>
      </Box>
    );
  };

  const body = () => {
    if (side === "current" && !hasTree)
      return (
        <Box
          data-testid="treeNone"
          sx={{ py: 3, display: "flex", flexDirection: "column", gap: 1 }}
        >
          <Typography variant="subtitle2">{t("tree.none")}</Typography>
          <Typography variant="body2" color="textSecondary">
            {t("tree.noneHelp")}
          </Typography>
        </Box>
      );
    if (load.status === "error")
      return (
        <Alert
          severity="error"
          data-testid="treeFailed"
          action={
            <Button size="small" onClick={trees.retry}>
              {t("tree.retry")}
            </Button>
          }
        >
          {t("tree.failed")}
        </Alert>
      );
    if (load.status !== "ready")
      return (
        <Box
          data-testid="treeLoading"
          role="status"
          sx={{ py: 2, display: "flex", flexDirection: "column", gap: 1 }}
        >
          <LinearProgress />
          <Typography variant="body2" color="textSecondary">
            {t("tree.loading")}
          </Typography>
        </Box>
      );
    if (!tree)
      return (
        <Typography
          variant="body2"
          color="textSecondary"
          data-testid="treeNone"
          sx={{ py: 2 }}
        >
          {side === "baseline" ? t("tree.noBaseline") : t("tree.none")}
        </Typography>
      );
    return (
      <>
        {!tree.positioned && (
          <Typography
            variant="body2"
            color="textSecondary"
            data-testid="treeUnpositioned"
            sx={{
              p: 1.25,
              borderRadius: radius.control,
              bgcolor: tokens.subtle,
            }}
          >
            {t("tree.unpositioned")}
          </Typography>
        )}
        {notFound && (
          <Alert severity="info" data-testid="treeNotFound" sx={{ py: 0 }}>
            {t("tree.notFound")}
          </Alert>
        )}
        <Box
          sx={{
            border: `1px solid ${tokens.border}`,
            borderRadius: radius.control,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            ...(fill ? { flex: 1, minHeight: 240 } : { flexShrink: 0 }),
          }}
        >
          {pathBar}
          <Box
            ref={listRef}
            role="tree"
            aria-label={t("tree.label")}
            tabIndex={0}
            data-testid="tree"
            onKeyDown={onKeyDown}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            onMouseLeave={() => onPoint(undefined)}
            sx={{
              position: "relative",
              // the rows never scroll sideways: text and ids give way, marks stay (REQ-063-09)
              overflowY: "auto",
              overflowX: "hidden",
              py: 0.5,
              ...(fill ? { flex: 1, minHeight: 0 } : { height }),
              outline: "none",
              "&:focus-visible": {
                boxShadow: `inset 0 0 0 2px ${tokens.brand}`,
              },
            }}
          >
            {rows.length === 0 ? (
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{ p: 2, textAlign: "center" }}
              >
                {t("tree.nothingFound")}
              </Typography>
            ) : (
              <Box sx={{ height: rows.length * ROW, position: "relative" }}>
                {rows
                  .slice(first, last)
                  .map((item, i) => row(item, (first + i) * ROW))}
              </Box>
            )}
          </Box>
        </Box>
        {!fill && (
          <Box
            role="separator"
            aria-orientation="horizontal"
            aria-label={t("tree.resize")}
            aria-valuenow={height}
            aria-valuemin={TREE_HEIGHT.min}
            aria-valuemax={TREE_HEIGHT.max}
            tabIndex={0}
            data-testid="treeResize"
            onPointerDown={(event) => {
              resizeFrom.current = { y: event.clientY, height };
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              const from = resizeFrom.current;
              if (from) setTreeHeight(from.height + event.clientY - from.y);
            }}
            onPointerUp={() => {
              resizeFrom.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setTreeHeight(height + TREE_HEIGHT.step);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setTreeHeight(height - TREE_HEIGHT.step);
              }
            }}
            sx={{
              height: 12,
              mt: -0.75,
              mb: -0.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "row-resize",
              touchAction: "none",
              outline: "none",
              "& > span": {
                width: 36,
                height: 4,
                borderRadius: radius.pill,
                bgcolor: tokens.borderStrong,
                transition: `background-color ${motion.fast}ms`,
              },
              "&:hover > span, &:focus-visible > span": {
                bgcolor: tokens.brand,
              },
            }}
          >
            <span />
          </Box>
        )}
        {node ? (
          <NodeCard
            key={`${side}:${node.index}`}
            testRunId={testRunId}
            side={side}
            node={node}
            baseline={
              side === "current" ? sameNode(node, baselineNodes) : undefined
            }
            current={
              side === "baseline" ? sameNode(node, other?.nodes) : undefined
            }
            changes={changes.filter((change) => change.key === node.key)}
            problems={(report?.violations ?? []).filter(
              (violation) => violation.nodeKey === node.key,
            )}
            onActions={canActOn?.(node.index) ? onActions : undefined}
          />
        ) : (
          <Typography variant="body2" color="textSecondary">
            {t("tree.pick")}
          </Typography>
        )}
      </>
    );
  };

  return (
    <Box
      data-testid="elementsTab"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        ...(fill ? { flex: 1, minHeight: 0 } : {}),
      }}
    >
      {onFullScreen && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: -0.5 }}>
          <Button
            size="small"
            data-testid="treeFullScreen"
            onClick={onFullScreen}
          >
            {t("tree.fullScreen")}
          </Button>
        </Box>
      )}
      {(hasTree || side === "baseline") && header}
      {body()}
    </Box>
  );
};

interface CardProps {
  testRunId: string;
  side: TreeSide;
  node: InspectorNode;
  // the same element on the baseline tree, for what it held there (REQ-062-18)
  baseline?: InspectorNode;
  // on the baseline tree: the same element now
  current?: InspectorNode;
  changes: StructuralChange[];
  problems: A11yReport["violations"];
  onActions?: (index: number, anchor: { x: number; y: number }) => void;
}

const NodeCard: React.FunctionComponent<CardProps> = ({
  testRunId,
  side,
  node,
  baseline,
  changes,
  problems,
  onActions,
}) => {
  const { t } = useT();
  const was = baselineValues(node, baseline);
  // empty attributes say nothing; shown on request (REQ-063-17)
  const [onlyFilled, setOnlyFilled] = React.useState(true);
  const attributes = node.attributes.filter(
    ([name, value]) => !onlyFilled || !!value || was.has(name),
  );
  const { name: idName, component } = splitId(node.id);

  const [locators, setLocators] = React.useState<
    NodeLocators | null | "failed"
  >(null);
  React.useEffect(() => {
    let live = true;
    insightsService
      .getLocators(testRunId, side, node.index)
      .then((found) => live && setLocators(found))
      .catch(() => live && setLocators("failed"));
    return () => {
      live = false;
    };
  }, [testRunId, side, node.index]);

  return (
    <Box
      component="section"
      aria-label={node.name}
      data-testid="nodeCard"
      sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0.5 }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: radius.control,
            bgcolor: tokens.subtle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <KindIcon node={node} size={20} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
              overflowWrap: "anywhere",
            }}
          >
            {idName ? `${node.name} #${idName}` : node.name}
            {component && (
              <Box
                component="span"
                sx={{
                  font: `500 ${type.caption}px ${tokens.mono}`,
                  color: tokens.variable,
                  bgcolor: tokens.variableSoft,
                  px: 0.75,
                  borderRadius: radius.pill,
                }}
              >
                {component}
              </Box>
            )}
          </Typography>
          <Typography
            sx={{
              font: `400 ${type.caption}px ${tokens.mono}`,
              color: tokens.textMuted,
              overflowWrap: "anywhere",
            }}
          >
            {node.className}
          </Typography>
        </Box>
        {onActions && (
          <Button
            variant="outlined"
            size="small"
            data-testid="nodeActions"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onActions(node.index, { x: rect.left, y: rect.bottom });
            }}
            sx={{ flexShrink: 0 }}
          >
            {t("tree.actions")}
          </Button>
        )}
      </Box>
      {node.hidden && (
        <Typography
          variant="body2"
          color="textSecondary"
          data-testid="nodeHidden"
        >
          {t(`tree.hidden.${node.hidden}`)}
        </Typography>
      )}
      {changes.map((change) => (
        <Alert
          key={`${change.kind}:${change.key}`}
          severity="warning"
          icon={false}
          sx={{ py: 0 }}
        >
          {describeChange(change, t)}
        </Alert>
      ))}
      {problems.map((problem) => (
        <Alert key={problem.id} severity="warning" icon={false} sx={{ py: 0 }}>
          <b>{problem.title}</b> {problem.message}
        </Alert>
      ))}
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 0.75,
          }}
        >
          <Typography variant="subtitle2" component="h4">
            {t("tree.attributes")}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={onlyFilled}
                onChange={(_, on) => setOnlyFilled(on)}
                inputProps={{ "aria-label": t("tree.onlyFilled") }}
                data-testid="treeOnlyFilled"
              />
            }
            label={
              <Typography variant="caption" color="textSecondary">
                {t("tree.onlyFilled")}
              </Typography>
            }
            sx={{ mr: 0 }}
          />
        </Box>
        <Box
          component="dl"
          data-testid="nodeAttributes"
          sx={{
            m: 0,
            display: "grid",
            gridTemplateColumns: "minmax(96px, max-content) minmax(0, 1fr)",
            columnGap: 1.5,
            rowGap: 0.5,
            font: `400 ${type.caption}px ${tokens.mono}`,
          }}
        >
          {attributes.map(([name, value]) => (
            <React.Fragment key={name}>
              <Box component="dt" sx={{ color: tokens.textMuted }}>
                {name}
              </Box>
              <Box
                component="dd"
                sx={{
                  m: 0,
                  overflowWrap: "anywhere",
                  whiteSpace: "pre-wrap",
                  color: tokens.text,
                }}
              >
                {was.has(name) ? (
                  <>
                    <Box
                      component="span"
                      sx={{
                        bgcolor: tokens.status.changed.bg,
                        borderRadius: radius.control,
                        px: 0.25,
                      }}
                    >
                      {value || "—"}
                    </Box>
                    <Box
                      sx={{ color: tokens.textMuted, fontFamily: "inherit" }}
                    >
                      {t("tree.inBaseline", { value: was.get(name) || "—" })}
                    </Box>
                  </>
                ) : (
                  value || "—"
                )}
              </Box>
            </React.Fragment>
          ))}
        </Box>
      </Box>
      {locators === "failed" ? (
        <Typography variant="body2" color="error">
          {t("tree.locatorsFailed")}
        </Typography>
      ) : (
        locators && (
          <>
            {locators.vision.length > 0 && (
              <LocatorGroup
                title={t("tree.forRules")}
                items={locators.vision}
                testId="visionLocators"
              />
            )}
            <LocatorGroup
              title={t("tree.forTests")}
              items={locators.test}
              testId="testLocators"
            />
          </>
        )
      )}
    </Box>
  );
};

const LocatorGroup: React.FunctionComponent<{
  title: string;
  items: NodeLocators["test"];
  testId: string;
}> = ({ title, items, testId }) => {
  const { t } = useT();
  const [copied, setCopied] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (copied === null) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Box
      data-testid={testId}
      sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}
    >
      <Typography variant="subtitle2" component="h4">
        {title}
      </Typography>
      {items.map((item, i) => (
        <Box
          key={`${item.kind}:${item.value}`}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            border: `1px solid ${tokens.border}`,
            borderRadius: radius.control,
            pl: 1.25,
            pr: 0.5,
            py: 0.5,
          }}
        >
          <Typography
            variant="caption"
            color="textSecondary"
            sx={{ flexShrink: 0, minWidth: 64 }}
          >
            {item.kind}
          </Typography>
          <Box
            component="code"
            title={item.value}
            sx={{
              flex: 1,
              minWidth: 0,
              font: `400 ${type.caption}px ${tokens.mono}`,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.value}
          </Box>
          {item.matches !== 1 && (
            <StatusPill
              tone="changed"
              label={t("tree.matches", { count: item.matches })}
            />
          )}
          <Button
            size="small"
            data-testid="copyLocator"
            onClick={() => {
              navigator.clipboard?.writeText(item.value).catch(() => undefined);
              setCopied(i);
            }}
            sx={{ flexShrink: 0, minWidth: 0 }}
          >
            {copied === i ? t("tree.copied") : t("tree.copy")}
          </Button>
        </Box>
      ))}
    </Box>
  );
};
