import React from "react";
import { Box } from "@mui/material";
import { Rect } from "../../types/insights";
import { Overview } from "../../_helpers/whatsCompared.helper";
import { tokens } from "../../theme";

interface ComparedMapProps {
  size: { width: number; height: number };
  overview: Overview;
  // changed spots on the checkpoint
  changes: Rect[];
  // what the map shows, for screen readers
  label: string;
  width?: number;
}

type Layer = "keep" | "ignore" | "tolerate" | "change";

const layerSx = (layer: Layer) => {
  switch (layer) {
    case "keep":
      return {
        bgcolor: tokens.surface,
        outline: `1.5px solid ${tokens.brand}`,
        outlineOffset: -1.5,
      };
    case "ignore":
      return {
        background: `repeating-linear-gradient(135deg, ${tokens.status.neutral.bar} 0 1.5px, transparent 1.5px 4px)`,
      };
    case "tolerate":
      return { border: `1.5px dashed ${tokens.status.new.bar}` };
    case "change":
      return {
        bgcolor: tokens.status.changed.bg,
        outline: `1.5px solid ${tokens.status.changed.bar}`,
        outlineOffset: -1.5,
      };
  }
};

/**
 * The screenshot in miniature, to scale (REQ-030-11): what is compared, what
 * is left out, what may change and what did. With Compare only everything
 * outside the chosen elements is dimmed, as on the screenshots themselves.
 */
export const ComparedMap: React.FunctionComponent<ComparedMapProps> = ({
  size,
  overview,
  changes,
  label,
  width = 86,
}) => {
  if (!size.width || !size.height) return null;
  // a very tall screenshot (a long scroll) would push the summary away
  const height = Math.min(Math.round((width * size.height) / size.width), 220);
  const place = (rect: Rect) => ({
    left: `${(rect.x / size.width) * 100}%`,
    top: `${(rect.y / size.height) * 100}%`,
    width: `${(rect.width / size.width) * 100}%`,
    height: `${(rect.height / size.height) * 100}%`,
  });

  const applying = [
    ...overview.ignored,
    ...overview.tolerated,
    ...overview.compared.flatMap((element) => element.inside),
  ];
  const layers: Array<{ layer: Layer; rect: Rect }> = [
    ...overview.keep.map((rect) => ({ layer: "keep" as const, rect })),
    ...applying.flatMap((row) =>
      row.rects.map((rect) => ({
        layer:
          row.action === "tolerate"
            ? ("tolerate" as const)
            : ("ignore" as const),
        rect,
      })),
    ),
    ...changes.map((rect) => ({ layer: "change" as const, rect })),
  ];

  return (
    <Box
      role="img"
      aria-label={label}
      data-testid="comparedMap"
      sx={{
        position: "relative",
        flexShrink: 0,
        width,
        height,
        borderRadius: "8px",
        overflow: "hidden",
        border: `1.5px solid ${overview.only ? tokens.borderStrong : tokens.brand}`,
        // dimmed where nothing is compared
        bgcolor: overview.only ? tokens.ground : tokens.subtle,
      }}
    >
      {layers.map(({ layer, rect }, index) => (
        <Box
          key={index}
          data-layer={layer}
          sx={{
            position: "absolute",
            boxSizing: "border-box",
            borderRadius: "2px",
            ...place(rect),
            ...layerSx(layer),
          }}
        />
      ))}
    </Box>
  );
};
