import React from "react";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  Typography,
} from "@mui/material";
import TestStatusChip from "../TestStatusChip";
import noImage from "../../static/no-image.png";
import { CARD_SIZE_BY_DENSITY, TestRunDensity } from "./TestRunListControls";
import {
  groupStatusSummary,
  TestRunGroup,
} from "../../_helpers/testRunGroup.helper";
import { thumbnailFor } from "../../_helpers/testRunImage.helper";
import { tagValuesOf } from "../../_helpers/testRunTags.helper";
import { TestRun } from "../../types";
import { motion, tokens } from "../../theme";
import { staggered } from "../motion/Stagger";

/**
 * Wraps onto the next line and stops after a few, rather than cutting the text
 * off at the first: a narrow card holds neither a long screen name nor a row of
 * tags on one line, and an ellipsis after two words says nothing.
 */
const clampToLines = (lines: number) => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: lines,
  overflow: "hidden",
  overflowWrap: "anywhere",
});

const CAPTION_LINE_HEIGHT = 1.66;

// a button that reads as the caption text around it: inline so the row still
// wraps, and with the caption's letter-spacing, which a button resets to normal
const TAG_BUTTON = {
  display: "inline",
  font: "inherit",
  letterSpacing: "inherit",
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
  "&:hover": { textDecoration: "underline" },
};

/**
 * The same two-line box for a row that holds elements rather than plain text:
 * `-webkit-box` blockifies its children, which would stop the tags from
 * flowing and wrapping as text.
 */
const clipToLines = (lines: number) => ({
  display: "block",
  lineHeight: CAPTION_LINE_HEIGHT,
  maxHeight: `${lines * CAPTION_LINE_HEIGHT}em`,
  overflow: "hidden",
  overflowWrap: "anywhere",
});

export const TestRunGrid: React.FunctionComponent<{
  groups: TestRunGroup[];
  // a set rather than the array: a card looks its runs up on every render, and
  // a build of thousands can have every one of them selected
  selectedIdSet: Set<string>;
  density: TestRunDensity;
  showDiff: boolean;
  activeTags: string[];
  tagFieldsFor: (runCount: number) => Array<keyof TestRun>;
  onToggleGroup: (ids: string[]) => void;
  onToggleTag: (tag: string) => void;
  onOpen: (id: string) => void;
}> = ({
  groups,
  selectedIdSet,
  density,
  showDiff,
  activeTags,
  tagFieldsFor,
  onToggleGroup,
  onToggleTag,
  onOpen,
}) => (
  <Box
    display="grid"
    gridTemplateColumns={`repeat(auto-fill, minmax(${CARD_SIZE_BY_DENSITY[density].width}px, 1fr))`}
    gap={1.5}
    padding={2}
    data-testid="testRunGrid"
  >
    {groups.map(({ key, runs, representative }, index) => {
      const ids = runs.map((run) => run.id);
      const selectedCount = ids.filter((id) => selectedIdSet.has(id)).length;
      const tags = tagValuesOf(representative, tagFieldsFor(runs.length));

      return (
        <Card
          key={key}
          variant="outlined"
          data-testid="testRunCard"
          {...staggered(index, 24)}
          sx={{
            transition: `transform ${motion.base}ms ${motion.easing}, border-color ${motion.base}ms, box-shadow ${motion.base}ms`,
            "&:hover": {
              transform: "translateY(-2px)",
              borderColor: tokens.borderStrong,
              boxShadow: tokens.shadowShot,
            },
            "&:hover .cardSelect": { opacity: 1 },
          }}
        >
          {/* the checkbox sits over the image, outside the action area, so the
              picture keeps the full width of the card and a tick does not open
              the dialog */}
          <Box position="relative">
            <CardActionArea onClick={() => onOpen(representative.id)}>
              <Box
                component="img"
                src={thumbnailFor(representative, showDiff)}
                alt={representative.name}
                loading="lazy"
                decoding="async"
                onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
                  event.currentTarget.src = noImage;
                }}
                sx={{
                  display: "block",
                  width: "100%",
                  height: CARD_SIZE_BY_DENSITY[density].imageHeight,
                  objectFit: "contain",
                  objectPosition: "center",
                  boxSizing: "border-box",
                  p: 1,
                  // the lit table the screenshot lies on; its pixels stay as they are
                  background: tokens.lightbox,
                }}
              />
            </CardActionArea>
            <Checkbox
              size="small"
              checked={selectedCount === ids.length}
              indeterminate={selectedCount > 0 && selectedCount < ids.length}
              onChange={() => onToggleGroup(ids)}
              inputProps={{ "aria-label": `Select ${representative.name}` }}
              className="cardSelect"
              sx={{
                position: "absolute",
                top: 4,
                left: 4,
                padding: 0.25,
                borderRadius: 1,
                // legible over a screenshot of any colour; shown on hover or when ticked
                backgroundColor: tokens.surface,
                opacity: selectedCount ? 1 : 0,
                transition: `opacity ${motion.fast}ms`,
                "&:focus-within": { opacity: 1 },
                "&:hover": { backgroundColor: tokens.surface },
              }}
            />
            {runs.length > 1 && (
              <Chip
                size="small"
                label={runs.length}
                data-testid="groupCount"
                sx={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  backgroundColor: tokens.text,
                  color: tokens.ground,
                }}
              />
            )}
          </Box>
          <CardContent
            // body carries a global text-align: center, hence the explicit left.
            // Rules between the three lines read as a table; weight, colour and
            // size already tell them apart, so they only need even spacing.
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 0.75,
              paddingX: 1.25,
              paddingY: 1,
              textAlign: "left",
              borderTop: `1px solid ${tokens.border}`,
              "&:last-child": { paddingBottom: 1 },
            }}
          >
            <Typography
              variant="body2"
              fontWeight={600}
              width="100%"
              sx={clampToLines(2)}
              title={representative.name}
              data-testid="cardName"
            >
              {representative.name}
            </Typography>
            {/* the chip speaks for the representative, so a half-reviewed
                group has to say so somewhere */}
            <Box component="span" title={groupStatusSummary(runs) || undefined}>
              <TestStatusChip status={representative.status} />
            </Box>
            {/* tags as quiet text, not chips: five chips wrap over three lines
                on a narrow card and drown out the name and the status. Each one
                filters the list by itself, as a button rather than a span so
                the keyboard reaches it. */}
            <Typography
              variant="caption"
              color="text.secondary"
              width="100%"
              sx={clipToLines(2)}
              title={tags.join(" · ")}
              data-testid="cardTags"
            >
              {tags.map((tag, index) => {
                const filteringBy = activeTags.includes(tag);

                return (
                  <React.Fragment key={`${index}-${tag}`}>
                    {index > 0 && " · "}
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onToggleTag(tag)}
                      data-testid="cardTag"
                      sx={{
                        ...TAG_BUTTON,
                        color: filteringBy ? "primary.main" : "inherit",
                        fontWeight: filteringBy ? 600 : undefined,
                      }}
                    >
                      {tag}
                    </Box>
                  </React.Fragment>
                );
              })}
            </Typography>
          </CardContent>
        </Card>
      );
    })}
  </Box>
);
