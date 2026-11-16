// The pieces the build's summary tabs are made of (Overview, Accessibility):
// tiles of numbers over cards with tables, so the tabs read as one page.
import React from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { motion, tokens, type, radius } from "../theme";
import { CountUp } from "./motion/useCountUp";
import { staggered } from "./motion/Stagger";

export const Card: React.FunctionComponent<{
  // tables whose first column names them go without one
  title?: string;
  index: number;
  children: React.ReactNode;
  testId?: string;
  id?: string;
}> = ({ title, index, children, testId, id }) => (
  <Box
    component="section"
    id={id}
    data-testid={testId}
    {...staggered(index)}
    sx={{
      bgcolor: tokens.surface,
      border: `1px solid ${tokens.border}`,
      borderRadius: radius.card,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      // the header row's fill follows the corners when there is no title
      overflow: "hidden",
    }}
  >
    {title && (
      <Typography
        component="h3"
        sx={{
          px: 2,
          py: 1.5,
          fontSize: 16,
          fontWeight: 600,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        {title}
      </Typography>
    )}
    {children}
  </Box>
);

export const rowSx = (columns: string, clickable: boolean) => ({
  display: "grid",
  gridTemplateColumns: columns,
  alignItems: "center",
  gap: 1.5,
  px: 2,
  minHeight: 48,
  // two-line names keep the same air as one-line rows
  py: 0.75,
  width: "100%",
  // header rows are plain boxes, the others buttons: the same box model for both
  boxSizing: "border-box" as const,
  textAlign: "left" as const,
  borderTop: `1px solid ${tokens.border}`,
  fontSize: 13,
  transition: `background-color ${motion.base}ms ${motion.easing}`,
  "& > *": { minWidth: 0 },
  ...(clickable && { "&:hover": { bgcolor: tokens.subtle } }),
});

export const Head: React.FunctionComponent<{
  columns: string;
  // [label, a count column: centred over its numbers]
  cells: Array<[string, boolean?]>;
}> = ({ columns, cells }) => (
  <Box
    sx={{
      ...rowSx(columns, false),
      minHeight: 32,
      borderTop: 0,
      bgcolor: tokens.subtle,
      fontSize: type.caption,
      fontWeight: 600,
      color: tokens.textSecondary,
    }}
  >
    {cells.map(([label, count], i) => (
      <span key={i} style={count ? { textAlign: "center" } : undefined}>
        {label}
      </span>
    ))}
  </Box>
);

/** A row that opens something; a plain row when it does not. */
export const Row: React.FunctionComponent<{
  columns: string;
  onClick?: () => void;
  children: React.ReactNode;
  label?: string;
  testId?: string;
}> = ({ columns, onClick, children, label, testId }) =>
  onClick ? (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      sx={rowSx(columns, true)}
    >
      {children}
    </ButtonBase>
  ) : (
    <Box data-testid={testId} sx={rowSx(columns, false)}>
      {children}
    </Box>
  );

/**
 * A count in a table; nothing to count is faint, so the counts stand out: a
 * dash, or a faint 0 where the table should read as numbers (Overview, 039).
 */
export const Num: React.FunctionComponent<{
  value: number;
  color?: string;
  testId?: string;
  zero?: string;
}> = ({ value, color, testId = "overviewNum", zero = "—" }) => (
  <Box
    component="span"
    data-testid={testId}
    sx={{
      // under the middle of its header: short numbers under long headers read as one column
      textAlign: "center",
      fontSize: type.small,
      fontVariantNumeric: "tabular-nums",
      fontWeight: value ? 600 : 400,
      color: value ? (color ?? tokens.text) : tokens.textMuted,
      opacity: value ? 1 : 0.6,
    }}
  >
    {value || zero}
  </Box>
);

/** A row's name: checks are named in sentences, so two lines before it is cut, all of it on hover. */
export const NameCell: React.FunctionComponent<{
  name: string;
  strong?: boolean;
}> = ({ name, strong = true }) => (
  <Typography
    title={name}
    sx={{
      fontSize: 13,
      fontWeight: strong ? 600 : 500,
      lineHeight: 1.35,
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
      overflowWrap: "anywhere",
    }}
  >
    {name}
  </Typography>
);

export interface TileProps {
  key: string;
  // a count rolls up to its value; a share or a time shows as it is
  value: number | string;
  label: string;
  // what the number does not say, such as the progress of the review
  caption?: string;
  captionTitle?: string;
  // what the label leaves out, shown on hover
  hint?: string;
  // the number's colour when it is not zero
  color?: string;
  // what the tile means, as a small dot or icon before its label; the number stays in the text colour (046)
  marker?: React.ReactNode;
  // a word after the number, smaller: "2 new"
  unit?: string;
  // nothing to see: no fill, a dashed border and a grey number, so the tiles with something stand out (039)
  quiet?: boolean;
  onClick?: () => void;
}

/** A tile's marker: a small dot in the colour of what it counts. */
export const TileDot: React.FunctionComponent<{ color: string }> = ({
  color,
}) => (
  <Box
    component="span"
    data-testid="tileDot"
    sx={{ width: 8, height: 8, borderRadius: radius.pill, bgcolor: color }}
  />
);

/** A row of numbers over the cards; a tile that opens nothing does not look clickable. */
export const Tiles: React.FunctionComponent<{
  tiles: TileProps[];
  testId?: string;
}> = ({ tiles, testId = "overview" }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`,
      gap: 1.25,
    }}
  >
    {tiles.map((tile, i) => (
      <ButtonBase
        key={tile.key}
        data-testid={`${testId}Tile-${tile.key}`}
        disabled={!tile.onClick}
        onClick={tile.onClick}
        title={tile.hint}
        {...staggered(i + 1)}
        data-quiet={tile.quiet || undefined}
        sx={{
          bgcolor: tile.quiet ? "transparent" : tokens.surface,
          border: `1px ${tile.quiet ? "dashed" : "solid"} ${tokens.border}`,
          borderRadius: radius.card,
          px: 1.75,
          py: 1.25,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          // numbers and labels on one line across the tiles, captions or not
          justifyContent: "flex-start",
          gap: 0.125,
          minWidth: 0,
          transition: `border-color ${motion.base}ms, transform ${motion.base}ms ${motion.easing}`,
          // a tile that opens nothing still shows its hints
          "&.Mui-disabled": { pointerEvents: "auto", cursor: "default" },
          ...(tile.onClick && {
            "&:hover": {
              borderColor: tokens.brand,
              transform: "translateY(-1px)",
            },
          }),
        }}
      >
        <Box
          component="span"
          data-testid={`${testId}Value-${tile.key}`}
          sx={{
            fontSize: type.page,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            fontVariantNumeric: "tabular-nums",
            color: tile.quiet
              ? tokens.textMuted
              : tile.value && tile.color
                ? tile.color
                : tokens.text,
          }}
        >
          {typeof tile.value === "number" ? (
            <CountUp value={tile.value} />
          ) : (
            tile.value
          )}
          {tile.unit && (
            <Box
              component="span"
              data-testid={`${testId}Unit-${tile.key}`}
              sx={{
                ml: 0.75,
                fontSize: type.small,
                fontWeight: 500,
                letterSpacing: 0,
                color: tokens.textSecondary,
              }}
            >
              {tile.unit}
            </Box>
          )}
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: type.small,
            fontWeight: 500,
            color: tile.quiet ? tokens.textSecondary : undefined,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          {/* a zero has nothing to mark: it steps back whole */}
          {tile.marker && !tile.quiet && (
            <Box
              component="span"
              data-testid={`${testId}Marker-${tile.key}`}
              sx={{ display: "inline-flex", color: tokens.textSecondary }}
            >
              {tile.marker}
            </Box>
          )}
          {tile.label}
        </Box>
        {tile.caption && (
          <Box
            component="span"
            data-testid={`${testId}Caption-${tile.key}`}
            title={tile.captionTitle || undefined}
            sx={{
              fontSize: type.caption,
              color: tokens.textSecondary,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tile.caption}
          </Box>
        )}
      </ButtonBase>
    ))}
  </Box>
);
