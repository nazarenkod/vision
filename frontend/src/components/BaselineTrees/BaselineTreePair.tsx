import React from "react";
import { Alert, Box, Typography } from "@mui/material";
import { Baseline } from "../../types/baseline";
import { InspectorNode } from "../../types/insights";
import { useT } from "../../i18n";
import { radius, tokens, type } from "../../theme";
import { recordDate } from "../../_helpers/baselineHistory.helper";
import { nodeAt } from "../../_helpers/treeInspector.helper";
import {
  counterpart,
  pairCard,
  pairOutlines,
} from "../../_helpers/baselineTrees.helper";
import { ElementsTab } from "../TestDetailsDialog/ElementsTab";
import { treeOf, TreeLoad } from "../TestDetailsDialog/useInspectorTrees";
import { Point, TreeScreen } from "../TreeScreen";
import { PairSide, PairTrees } from "./useBaselineTrees";

const NARROW = "@media (max-width: 1023.98px)";
const NONE: TreeLoad = { status: "ready", tree: null };

interface Props {
  selected: Baseline;
  // none for the first baseline (REQ-079-08)
  previous?: Baseline;
  trees: PairTrees;
  // the chosen element by its key: one choice shows it in both versions (REQ-079-10)
  chosen?: string;
  onChoose: (key: string | undefined) => void;
  // the trees take the height they are given: the page on the whole window
  fill?: boolean;
}

/** Both versions of a baseline's pair, each screenshot beside its own UI tree, only to look at (079). */
export const BaselineTreePair: React.FunctionComponent<Props> = ({
  selected,
  previous,
  trees,
  chosen,
  onChoose,
  fill,
}) => {
  const { t, formatDate } = useT();
  const [pointed, setPointed] = React.useState<string>();

  const nodesOf = (side: PairSide): InspectorNode[] | undefined =>
    treeOf(trees[side])?.nodes;
  const versions: Array<{ side: PairSide; baseline: Baseline }> = [
    { side: "selected", baseline: selected },
    ...(previous ? [{ side: "previous" as const, baseline: previous }] : []),
  ];

  const chosenIn = (side: PairSide) => counterpart(nodesOf(side), chosen);
  const ready = versions.every(({ side }) => trees[side].status === "ready");
  // a link to an element neither version has (REQ-079-18)
  const notFound =
    !!chosen && ready && versions.every(({ side }) => !chosenIn(side));

  const title = (side: PairSide) =>
    side === "selected" ? t("baselines.selected") : t("baselines.previous");

  const version = ({ side, baseline }: (typeof versions)[number]) => {
    const nodes = nodesOf(side);
    const hover = (point: Point | null) =>
      setPointed(nodeAt(point, nodes ?? [])?.key);
    const pick = (point: Point) => {
      const node = nodeAt(point, nodes ?? []);
      if (node) onChoose(node.key);
    };
    return (
      <Box
        component="section"
        key={side}
        aria-label={title(side)}
        data-testid={`pairVersion-${side}`}
        sx={{
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          bgcolor: tokens.surface,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            height: 36,
            borderBottom: `1px solid ${tokens.border}`,
          }}
        >
          <Typography
            sx={{ fontSize: type.small, fontWeight: 600, color: tokens.text }}
          >
            {title(side)}
          </Typography>
          <Typography sx={{ fontSize: type.small, color: tokens.textMuted }}>
            {recordDate(baseline.createdAt, formatDate)}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: 2,
            p: 2,
            ...(fill ? { flex: 1, minHeight: 0 } : {}),
          }}
        >
          <Box
            sx={{
              flex: "1 1 200px",
              maxWidth: 360,
              minWidth: 0,
              display: "flex",
              justifyContent: "center",
              p: 1.5,
              borderRadius: radius.card,
              background: tokens.lightbox,
            }}
          >
            <TreeScreen
              title={title(side)}
              testId={`pairScreen-${side}`}
              caption={false}
              imageName={baseline.baselineName}
              outlines={pairOutlines(nodes, chosen, pointed)}
              onPoint={hover}
              onPick={pick}
            />
          </Box>
          <Box
            sx={{
              flex: "1 1 280px",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              ...(fill ? { alignSelf: "stretch", minHeight: 480 } : {}),
            }}
          >
            <ElementsTab
              viewOnly
              fill={fill}
              hasTree
              testRunId=""
              trees={{
                current: trees[side],
                baseline: NONE,
                retry: trees.retry,
              }}
              structure={null}
              report={null}
              side="current"
              onSideChange={() => undefined}
              chosen={chosenIn(side)?.index}
              onChoose={(index) =>
                onChoose(index === undefined ? undefined : nodes?.[index]?.key)
              }
              pointed={counterpart(nodes, pointed)?.index}
              onPoint={(index) =>
                setPointed(
                  index === undefined ? undefined : nodes?.[index]?.key,
                )
              }
            />
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      data-testid="baselineTreePair"
      sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}
    >
      {notFound && (
        <Alert severity="info" data-testid="pairNotFound" sx={{ py: 0 }}>
          {t("tree.notFound")}
        </Alert>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${versions.length}, minmax(0, 1fr))`,
          gap: "1px",
          bgcolor: tokens.border,
          border: `1px solid ${tokens.border}`,
          borderRadius: radius.card,
          overflow: "hidden",
          // a narrow window: one version under the other (REQ-079-20)
          [NARROW]: { gridTemplateColumns: "minmax(0, 1fr)" },
        }}
      >
        {versions.map(version)}
      </Box>
      <PairNodeCard
        selected={chosenIn("selected")}
        previous={previous ? chosenIn("previous") : undefined}
        hasPrevious={!!previous}
        dates={{
          selected: recordDate(selected.createdAt, formatDate),
          previous: previous ? recordDate(previous.createdAt, formatDate) : "",
        }}
      />
    </Box>
  );
};

/** The chosen element's attributes in both versions, side by side (REQ-079-14, 15). */
export const PairNodeCard: React.FunctionComponent<{
  selected?: InspectorNode;
  previous?: InspectorNode;
  hasPrevious: boolean;
  dates: Record<PairSide, string>;
}> = ({ selected, previous, hasPrevious, dates }) => {
  const { t } = useT();
  const any = selected ?? previous;
  const frame = {
    bgcolor: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: radius.card,
  };
  if (!any)
    return (
      <Typography
        variant="body2"
        color="textSecondary"
        data-testid="pairCardEmpty"
        sx={{ ...frame, p: 2 }}
      >
        {t("tree.pick")}
      </Typography>
    );

  const rows = pairCard(selected, previous);
  const columns: PairSide[] = hasPrevious
    ? ["selected", "previous"]
    : ["selected"];
  const cell = {
    px: 1,
    py: 0.75,
    borderTop: `1px solid ${tokens.border}`,
    font: `400 ${type.caption}px ${tokens.mono}`,
    overflowWrap: "anywhere" as const,
  };
  // a version without the element says so once, in its heading (REQ-079-15)
  const absent = (side: PairSide) =>
    !(side === "selected" ? selected : previous);
  const value = (side: PairSide, row: (typeof rows)[number]) => (
    <Box sx={{ ...cell, color: tokens.text }}>{row[side] ?? ""}</Box>
  );

  return (
    <Box component="section" data-testid="pairCard" sx={{ ...frame, p: 1 }}>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          gap: 1,
          px: 1,
          pb: 1,
        }}
      >
        <Typography sx={{ fontSize: type.body, fontWeight: 600 }}>
          {any.id ? `${any.name} #${any.id}` : any.name}
        </Typography>
        <Typography
          sx={{
            font: `400 ${type.caption}px ${tokens.mono}`,
            color: tokens.textMuted,
            overflowWrap: "anywhere",
          }}
        >
          {any.className}
        </Typography>
      </Box>
      {/* why it is not outlined on the screenshot (REQ-079-16) */}
      {columns.map((side) => {
        const node = side === "selected" ? selected : previous;
        return node?.hidden ? (
          <Typography
            key={side}
            variant="body2"
            color="textSecondary"
            data-testid={`pairHidden-${side}`}
            sx={{ px: 1, pb: 1 }}
          >
            {`${side === "selected" ? t("baselines.selected") : t("baselines.previous")}: ${t(`tree.hidden.${node.hidden}`)}`}
          </Typography>
        ) : null;
      })}
      <Box sx={{ overflowX: "auto" }}>
        <Box
          role="table"
          aria-label={t("baselines.attributes")}
          sx={{
            display: "grid",
            gridTemplateColumns: `minmax(120px, 0.6fr) repeat(${columns.length}, minmax(0, 1fr))`,
            minWidth: hasPrevious ? 520 : 320,
          }}
        >
          <Box
            sx={{
              px: 1,
              py: 0.75,
              fontSize: type.caption,
              fontWeight: 600,
              color: tokens.textMuted,
            }}
          >
            {t("baselines.attribute")}
          </Box>
          {columns.map((side) => (
            <Box
              key={side}
              data-testid={`pairCardHead-${side}`}
              sx={{
                px: 1,
                py: 0.75,
                fontSize: type.caption,
                fontWeight: 600,
                color: tokens.textMuted,
              }}
            >
              {`${side === "selected" ? t("baselines.selected") : t("baselines.previous")} · ${dates[side]}`}
              {absent(side) && (
                <Box
                  data-testid={`pairCardAbsent-${side}`}
                  sx={{
                    fontWeight: 400,
                    fontStyle: "italic",
                    color: tokens.textSecondary,
                  }}
                >
                  {t("baselines.notInVersion")}
                </Box>
              )}
            </Box>
          ))}
          {rows.map((row) => (
            <React.Fragment key={row.name}>
              <Box sx={{ ...cell, color: tokens.textSecondary }}>
                {row.name}
              </Box>
              {columns.map((side) => (
                <React.Fragment key={side}>{value(side, row)}</React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </Box>
      </Box>
    </Box>
  );
};
