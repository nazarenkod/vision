// The pieces the build's summary tabs are made of (Overview, Accessibility):
// tiles of numbers over cards with tables, so the tabs read as one page.
import React from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { motion, tokens } from "../theme";
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
      borderRadius: 3,
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
          fontSize: 14,
          fontWeight: 650,
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
  cells: Array<[string, boolean?]>;
}> = ({ columns, cells }) => (
  <Box
    sx={{
      ...rowSx(columns, false),
      minHeight: 32,
      borderTop: 0,
      bgcolor: tokens.subtle,
      fontSize: 11.5,
      fontWeight: 600,
      color: tokens.textSecondary,
    }}
  >
    {cells.map(([label, right], i) => (
      <span key={i} style={right ? { textAlign: "right" } : undefined}>
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

/** A count in a table; nothing to count shows as a dash, so the counts stand out. */
export const Num: React.FunctionComponent<{
  value: number;
  color?: string;
  testId?: string;
}> = ({ value, color, testId = "overviewNum" }) => (
  <Box
    component="span"
    data-testid={testId}
    sx={{
      textAlign: "right",
      fontFamily: tokens.mono,
      fontSize: 12,
      fontVariantNumeric: "tabular-nums",
      fontWeight: value ? 600 : 400,
      color: value ? (color ?? tokens.text) : tokens.textMuted,
    }}
  >
    {value || "—"}
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

/** A device as the tables name it: the model, and under it what else tells it apart. */
export const DeviceCell: React.FunctionComponent<{
  name: string;
  detail: string;
}> = ({ name, detail }) => (
  <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
    <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
      {name || "—"}
    </Typography>
    <Typography noWrap sx={{ fontSize: 11.5, color: tokens.textSecondary }}>
      {detail}
    </Typography>
  </Box>
);

export interface TileProps {
  key: string;
  value: number;
  label: string;
  // what the number does not say, such as the progress of the review
  caption?: string;
  captionTitle?: string;
  // what the label leaves out, shown on hover
  hint?: string;
  // the number's colour when it is not zero
  color?: string;
  onClick?: () => void;
}

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
        sx={{
          bgcolor: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: 3,
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
          sx={{
            fontSize: 24,
            fontWeight: 650,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            fontVariantNumeric: "tabular-nums",
            color: tile.value && tile.color ? tile.color : tokens.text,
          }}
        >
          <CountUp value={tile.value} />
        </Box>
        <Box component="span" sx={{ fontSize: 12.5, fontWeight: 500 }}>
          {tile.label}
        </Box>
        {tile.caption && (
          <Box
            component="span"
            data-testid={`${testId}Caption-${tile.key}`}
            title={tile.captionTitle || undefined}
            sx={{
              fontSize: 11.5,
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
