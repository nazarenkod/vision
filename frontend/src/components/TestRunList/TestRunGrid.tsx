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
import { thumbnailFor } from "../../_helpers/testRunImage.helper";
import { tagValuesOf } from "../../_helpers/testRunTags.helper";
import { TestRun } from "../../types";
import { motion, tokens } from "../../theme";
import { staggered } from "../motion/Stagger";
import { useT } from "../../i18n";

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

// two rows of small chips (24px) and the gap between them
const TAG_ROWS_HEIGHT = 52;

export const TestRunGrid: React.FunctionComponent<{
  runs: TestRun[];
  // a set rather than the array: every card looks itself up on every render,
  // and a build of thousands can have every one of them selected
  selectedIdSet: Set<string>;
  density: TestRunDensity;
  showDiff: boolean;
  activeTags: string[];
  tagFields: Array<keyof TestRun>;
  onToggle: (id: string) => void;
  onToggleTag: (tag: string) => void;
  onOpen: (id: string) => void;
}> = ({
  runs,
  selectedIdSet,
  density,
  showDiff,
  activeTags,
  tagFields,
  onToggle,
  onToggleTag,
  onOpen,
}) => {
  const { t } = useT();
  return (
    <Box
      display="grid"
      gridTemplateColumns={`repeat(auto-fill, minmax(${CARD_SIZE_BY_DENSITY[density].width}px, 1fr))`}
      gap={1.5}
      padding={2}
      data-testid="testRunGrid"
    >
      {runs.map((run, index) => {
        const selected = selectedIdSet.has(run.id);
        const tags = tagValuesOf(run, tagFields);

        return (
          <Card
            key={run.id}
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
              <CardActionArea onClick={() => onOpen(run.id)}>
                <Box
                  component="img"
                  src={thumbnailFor(run, showDiff)}
                  alt={run.name}
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
                checked={selected}
                onChange={() => onToggle(run.id)}
                inputProps={{
                  "aria-label": t("runs.select", { name: run.name }),
                }}
                className="cardSelect"
                sx={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  padding: 0.25,
                  borderRadius: 1,
                  // legible over a screenshot of any colour; shown on hover or when ticked
                  backgroundColor: tokens.surface,
                  opacity: selected ? 1 : 0,
                  transition: `opacity ${motion.fast}ms`,
                  "&:focus-within": { opacity: 1 },
                  "&:hover": { backgroundColor: tokens.surface },
                }}
              />
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
                title={run.name}
                data-testid="cardName"
              >
                {run.name}
              </Typography>
              <TestStatusChip status={run.status} />
              {/* the same grey tags as the table and every other screen (spec 037),
                at most two rows so a narrow card still leads with the name and the
                status. Each one filters the list by itself; the filter shows in the
                Tag field above, the tag itself stays grey (REQ-037-04). */}
              <Box
                title={tags.join(" · ")}
                data-testid="cardTags"
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 0.5,
                  width: "100%",
                  maxHeight: TAG_ROWS_HEIGHT,
                  overflow: "hidden",
                }}
              >
                {tags.map((tag, index) => (
                  <Chip
                    key={`${index}-${tag}`}
                    size="small"
                    label={tag}
                    onClick={() => onToggleTag(tag)}
                    aria-pressed={activeTags.includes(tag)}
                    data-testid="cardTag"
                    sx={{ maxWidth: "100%" }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};
