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
  Typography,
} from "@mui/material";
import { ChevronRight, Search } from "@mui/icons-material";
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
  initialOpen,
  isMarked,
  keepWithAncestors,
  keyAction,
  marksByKey,
  matchesQuery,
  NodeMark,
  openTo,
  sameNode,
  visibleRows,
} from "../../_helpers/treeInspector.helper";
import { InspectorTrees, treeOf } from "./useInspectorTrees";

// rows have one height, so only those in view are drawn: a tree can hold thousands
const ROW = 28;
// rows drawn above and below the view, so a quick scroll shows no gap
const SPARE_ROWS = 12;
const PANEL_TREE_HEIGHT = 360;
// how long a copy button says Copied (REQ-060-24)
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

interface Props {
  // the check has a tree of its own; without one the tab explains how to send it (REQ-060-07)
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
  // the node a link named is not in the tree (REQ-060-34)
  notFound?: boolean;
  // the rule actions of Select elements, for a node they can act on (REQ-060-26, 27)
  canActOn?: (index: number) => boolean;
  onActions?: (index: number, anchor: { x: number; y: number }) => void;
  onFullScreen?: () => void;
  // the tree takes the height it is given instead of a fixed one: the inspector page
  fill?: boolean;
}

/** The check's UI tree beside the screenshot, as in Appium Inspector (060). */
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
  const [onlyMarked, setOnlyMarked] = React.useState(false);
  // what is unfolded, per tree: set when a tree first comes (REQ-060-05)
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

  const keep = React.useMemo(() => {
    if (!query.trim() && !onlyMarked) return null;
    return keepWithAncestors(
      nodes,
      (node) =>
        matchesQuery(node, query) &&
        (!onlyMarked || isMarked(marks.get(node.key))),
    );
  }, [nodes, query, onlyMarked, marks]);
  const rows = React.useMemo(
    () => visibleRows(nodes, open[side], keep),
    [nodes, open, side, keep],
  );

  const toggle = (index: number, unfold: boolean) =>
    setOpen((all) => {
      const next = new Set(all[side]);
      if (unfold) next.add(index);
      else next.delete(index);
      return { ...all, [side]: next };
    });

  // a node chosen on the screenshot: its way down is unfolded and its row brought into view (REQ-060-12)
  const listRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewHeight, setViewHeight] = React.useState(PANEL_TREE_HEIGHT);
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
    setViewHeight(list.clientHeight || PANEL_TREE_HEIGHT);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setViewHeight(list.clientHeight || PANEL_TREE_HEIGHT),
    );
    observer.observe(list);
    return () => observer.disconnect();
  }, [tree]);

  const first = Math.max(0, Math.floor(scrollTop / ROW) - SPARE_ROWS);
  const last = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewHeight) / ROW) + SPARE_ROWS,
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    const action = keyAction(event.key, rows, chosen, nodes);
    if (!action) return;
    event.preventDefault();
    if ("select" in action) onChoose(action.select);
    if ("open" in action) toggle(action.open, true);
    if ("fold" in action) toggle(action.fold, false);
  };

  const node = chosen === undefined ? undefined : nodes[chosen];

  const header = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Box
        sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}
      >
        <TextField
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
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
          }}
          sx={{ flex: "1 1 180px", minWidth: 0 }}
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
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={onlyMarked}
              onChange={(_, on) => setOnlyMarked(on)}
              inputProps={{ "aria-label": t("tree.onlyMarked") }}
              data-testid="treeOnlyMarked"
            />
          }
          label={
            <Typography variant="body2" color="textSecondary">
              {t("tree.onlyMarked")}
            </Typography>
          }
          sx={{ mr: 0 }}
        />
        {tree && (
          <Typography variant="caption" color="textSecondary">
            {t("tree.count", { count: nodes.length })}
          </Typography>
        )}
      </Box>
    </Box>
  );

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
            border: `1px solid ${tokens.border}`,
            borderRadius: radius.control,
            overflow: "auto",
            ...(fill
              ? { flex: 1, minHeight: 200 }
              : { height: PANEL_TREE_HEIGHT, flexShrink: 0 }),
            outline: "none",
            "&:focus-visible": { boxShadow: `0 0 0 2px ${tokens.brand}` },
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
              {rows.slice(first, last).map((row, i) => {
                const item = nodes[row.index];
                const mark = markOf(item);
                const isChosen = row.index === chosen;
                const isPointed = row.index === pointed;
                return (
                  <Box
                    key={row.index}
                    role="treeitem"
                    aria-level={row.depth + 1}
                    aria-selected={isChosen}
                    aria-expanded={row.hasChildren ? row.open : undefined}
                    data-testid="treeRow"
                    data-index={row.index}
                    onClick={() => onChoose(row.index)}
                    onMouseEnter={() => onPoint(row.index)}
                    sx={{
                      position: "absolute",
                      top: (first + i) * ROW,
                      left: 0,
                      right: 0,
                      height: ROW,
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      pl: `${4 + row.depth * 14}px`,
                      pr: 1,
                      cursor: "pointer",
                      fontSize: type.small,
                      whiteSpace: "nowrap",
                      bgcolor: isChosen
                        ? tokens.brandSoft
                        : isPointed
                          ? tokens.subtle
                          : "transparent",
                      transition: `background-color ${motion.fast}ms`,
                      opacity: item.bounds ? 1 : 0.6,
                    }}
                  >
                    {row.hasChildren ? (
                      <IconButton
                        size="small"
                        tabIndex={-1}
                        aria-label={t(row.open ? "tree.fold" : "tree.expand", {
                          name: item.name,
                        })}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggle(row.index, !row.open);
                        }}
                        sx={{ p: 0.25, color: tokens.textMuted }}
                      >
                        <ChevronRight
                          fontSize="small"
                          sx={{
                            transform: row.open ? "rotate(90deg)" : "none",
                            transition: `transform ${motion.fast}ms`,
                          }}
                        />
                      </IconButton>
                    ) : (
                      <Box sx={{ width: 24, flexShrink: 0 }} />
                    )}
                    <Box
                      component="span"
                      sx={{
                        fontWeight: isChosen ? 600 : 500,
                        color: tokens.text,
                      }}
                    >
                      {item.name}
                    </Box>
                    {item.id && (
                      <Box
                        component="span"
                        sx={{
                          font: `400 ${type.caption}px ${tokens.mono}`,
                          color: tokens.textSecondary,
                        }}
                      >
                        #{item.id}
                      </Box>
                    )}
                    {item.text && (
                      <Box
                        component="span"
                        sx={{
                          color: tokens.textMuted,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        “{item.text}”
                      </Box>
                    )}
                    <Box
                      sx={{
                        ml: "auto",
                        display: "flex",
                        gap: 0.5,
                        flexShrink: 0,
                      }}
                    >
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
              })}
            </Box>
          )}
        </Box>
        {node ? (
          <NodeCard
            key={`${side}:${node.index}`}
            testRunId={testRunId}
            side={side}
            node={node}
            nodes={nodes}
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
            onChoose={onChoose}
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
  nodes: InspectorNode[];
  // the same element on the baseline tree, for what it held there (REQ-060-18)
  baseline?: InspectorNode;
  // on the baseline tree: the same element now
  current?: InspectorNode;
  changes: StructuralChange[];
  problems: A11yReport["violations"];
  onChoose: (index: number) => void;
  onActions?: (index: number, anchor: { x: number; y: number }) => void;
}

const NodeCard: React.FunctionComponent<CardProps> = ({
  testRunId,
  side,
  node,
  nodes,
  baseline,
  changes,
  problems,
  onChoose,
  onActions,
}) => {
  const { t } = useT();
  const path: InspectorNode[] = [];
  for (
    let at: InspectorNode | undefined = node;
    at;
    at = at.parent === null ? undefined : nodes[at.parent]
  )
    path.unshift(at);
  const was = baselineValues(node, baseline);

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
      <Box
        component="nav"
        aria-label={t("tree.path")}
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0.25,
        }}
      >
        {path.map((step, i) => (
          <React.Fragment key={step.index}>
            {i > 0 && (
              <Box
                component="span"
                aria-hidden
                sx={{ color: tokens.textMuted, fontSize: type.caption }}
              >
                ›
              </Box>
            )}
            <Button
              size="small"
              onClick={() => onChoose(step.index)}
              sx={{
                minWidth: 0,
                px: 0.5,
                py: 0,
                fontSize: type.caption,
                fontWeight: step === node ? 600 : 400,
                color: step === node ? tokens.text : tokens.textMuted,
                textTransform: "none",
              }}
            >
              {step.id ? `${step.name}#${step.id}` : step.name}
            </Button>
          </React.Fragment>
        ))}
      </Box>
      <Box>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
          {node.id ? `${node.name} #${node.id}` : node.name}
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
        <Typography variant="subtitle2" component="h4" sx={{ mb: 0.75 }}>
          {t("tree.attributes")}
        </Typography>
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
          {node.attributes.map(([name, value]) => (
            <React.Fragment key={name}>
              <Box component="dt" sx={{ color: tokens.textMuted }}>
                {name}
              </Box>
              <Box
                component="dd"
                sx={{ m: 0, overflowWrap: "anywhere", color: tokens.text }}
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
      {onActions && (
        <Box>
          <Button
            variant="outlined"
            size="small"
            data-testid="nodeActions"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onActions(node.index, { x: rect.left, y: rect.bottom });
            }}
          >
            {t("tree.actions")}
          </Button>
        </Box>
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
