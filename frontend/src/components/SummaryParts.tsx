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
          fontSize: 16,
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
  // [label, a count column: centred over its numbers]
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
      // under the middle of its header: short numbers under long headers read as one column
      textAlign: "center",
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
  onClick?: () => void;
}

/**
 * The numbers over the cards: one strip split into cells, not a row of big
 * boxes, so a few numbers do not leave most of the width empty. A cell that
 * opens nothing does not look clickable.
 */
export const Tiles: React.FunctionComponent<{
  tiles: TileProps[];
  testId?: string;
}> = ({ tiles, testId = "overview" }) => (
  <Box
    {...staggered(1)}
    sx={{
      display: "grid",
      gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`,
      bgcolor: tokens.surface,
      border: `1px solid ${tokens.border}`,
      borderRadius: 3,
      overflow: "hidden",
    }}
  >
    {tiles.map((tile, i) => (
      <ButtonBase
        key={tile.key}
        data-testid={`${testId}Tile-${tile.key}`}
        disabled={!tile.onClick}
        onClick={tile.onClick}
        title={tile.hint}
        sx={{
          px: 2,
          py: 1.25,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          gap: 0.25,
          minWidth: 0,
          textAlign: "left",
          borderLeft: i ? `1px solid ${tokens.border}` : 0,
          transition: `background-color ${motion.base}ms ${motion.easing}`,
          // a cell that opens nothing still shows its hints
          "&.Mui-disabled": { pointerEvents: "auto", cursor: "default" },
          ...(tile.onClick && { "&:hover": { bgcolor: tokens.subtle } }),
        }}
      >
        <Box
          component="span"
          sx={{
            fontSize: 22,
            fontWeight: 650,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            fontVariantNumeric: "tabular-nums",
            color: tile.value && tile.color ? tile.color : tokens.text,
          }}
        >
          {typeof tile.value === "number" ? (
            <CountUp value={tile.value} />
          ) : (
            tile.value
          )}
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: 12,
            fontWeight: 500,
            color: tokens.textSecondary,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tile.label}
          {tile.caption && (
            <>
              {" · "}
              <Box
                component="span"
                data-testid={`${testId}Caption-${tile.key}`}
                title={tile.captionTitle || undefined}
                sx={{ color: tokens.textMuted }}
              >
                {tile.caption}
              </Box>
            </>
          )}
        </Box>
      </ButtonBase>
    ))}
  </Box>
);
