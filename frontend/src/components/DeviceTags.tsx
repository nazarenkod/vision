import React from "react";
import { Box, Chip, SxProps, Theme, Tooltip } from "@mui/material";
import { AltRoute } from "@mui/icons-material";
import { tokens, type, radius } from "../theme";
import { useT } from "../i18n";
import type { Text } from "../i18n/dictionaries";
import {
  DeviceField,
  DeviceParts,
  deviceTagsOf,
} from "../_helpers/device.helper";
import { fittingTagCount } from "../_helpers/tagOverflow.helper";

const FIELD_NAME = {
  os: "review.attr.os",
  device: "review.attr.device",
  browser: "review.attr.browser",
  viewport: "review.attr.viewport",
} as const satisfies Record<DeviceField, string>;

interface Props {
  parts: DeviceParts;
  // the report has its own language and is printed: outlined, no tooltips
  print?: boolean;
  // a notch smaller, for a thumbnail that holds the OS and the model on one line
  dense?: boolean;
  text?: Text;
  testId?: string;
  sx?: SxProps<Theme>;
}

/**
 * The device as the test run table shows it: one grey tag per value, model first,
 * the name of each value in its tooltip (spec 037). Grey whatever the state
 * around it, so a selection is shown by what holds the tags, not the tags.
 */
export const DeviceTags: React.FunctionComponent<Props> = ({
  parts,
  print,
  dense,
  text,
  testId,
  sx,
}) => {
  const { t } = useT();
  const name = text ?? t;
  const tags = deviceTagsOf(parts);
  return (
    <Box
      component="span"
      data-testid={testId}
      sx={{
        display: "inline-flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 0.5,
        minWidth: 0,
        maxWidth: "100%",
        ...sx,
      }}
    >
      {tags.length === 0 && (
        <Box component="span" sx={{ color: tokens.textSecondary }}>
          —
        </Box>
      )}
      {tags.map((tag) =>
        print ? (
          <Box
            key={tag.field}
            component="span"
            title={name(FIELD_NAME[tag.field])}
            data-testid="deviceTag"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              height: 18,
              px: 0.75,
              borderRadius: radius.control,
              // a fill is lost when the page prints without backgrounds
              border: `1px solid ${tokens.borderStrong}`,
              fontSize: type.caption,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {tag.value}
          </Box>
        ) : (
          // describes rather than names the tag: its value stays what it reads as
          <Tooltip
            key={tag.field}
            title={name(FIELD_NAME[tag.field])}
            describeChild
          >
            <Chip
              component="span"
              size="small"
              label={tag.value}
              data-testid="deviceTag"
              sx={{
                maxWidth: "100%",
                ...(dense && {
                  height: 20,
                  fontSize: type.caption,
                  "& .MuiChip-label": { px: 0.75 },
                }),
              }}
            />
          </Tooltip>
        ),
      )}
    </Box>
  );
};

/**
 * The branch as a tag: the same grey chip as a device or a tag, with a branch
 * icon, in mono because a branch is a name from git (spec 046).
 */
export const BranchTag = React.forwardRef<
  HTMLSpanElement,
  {
    branch: string;
    testId?: string;
    sx?: SxProps<Theme>;
  } & Omit<React.HTMLAttributes<HTMLSpanElement>, "color" | "children">
>(function BranchTag({ branch, testId = "branchTag", sx, ...rest }, ref) {
  // a tooltip around it hands its listeners and ref down through here
  return (
    <Chip
      {...rest}
      ref={ref}
      component="span"
      size="small"
      icon={<AltRoute />}
      label={branch}
      data-testid={testId}
      sx={[
        {
          maxWidth: "100%",
          fontFamily: tokens.mono,
          fontSize: type.caption,
          "& .MuiChip-icon": {
            fontSize: type.caption,
            color: tokens.textMuted,
            ml: 0.75,
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
});

// MUI's gap of 0.5, in px, for the arithmetic
const TAG_GAP = 4;

/**
 * Tags in one line: as many as fit, from the first, then a grey "+N" whose
 * tooltip names the rest (REQ-046-31). A tag is never cut mid-word unless it is
 * the only one left. What fits depends on the font and the column's width, so
 * every tag is measured in an invisible copy of the line, and again whenever
 * the line or that copy changes size.
 */
export const TagOverflow: React.FunctionComponent<{
  tags: string[];
  testId?: string;
}> = ({ tags, testId = "tagOverflow" }) => {
  const { t } = useT();
  const box = React.useRef<HTMLDivElement>(null);
  const ruler = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(tags.length);
  const key = tags.join("\u0000");

  React.useLayoutEffect(() => {
    const element = box.current;
    const copy = ruler.current;
    if (!element || !copy) return;
    const fit = () => {
      const chips = Array.from(copy.children) as HTMLElement[];
      const more = chips.pop();
      setShown(
        fittingTagCount(
          chips.map((chip) => chip.getBoundingClientRect().width),
          element.getBoundingClientRect().width,
          TAG_GAP,
          more?.getBoundingClientRect().width ?? 0,
        ),
      );
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    // a web font arriving late widens the tags without resizing the cell
    observer.observe(copy);
    return () => observer.disconnect();
  }, [key]);

  const hidden = tags.slice(shown);
  return (
    <Box
      ref={box}
      data-testid={testId}
      sx={{
        position: "relative",
        display: "flex",
        flexWrap: "nowrap",
        alignItems: "center",
        gap: 0.5,
        width: "100%",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {tags.slice(0, shown).map((tag, index) => (
        <Chip
          key={`${index}-${tag}`}
          component="span"
          size="small"
          label={tag}
          title={tag}
          data-testid="overflowTag"
          // only a lone tag gives way, ending in an ellipsis
          sx={{ flexShrink: shown === 1 ? 1 : 0, minWidth: 0 }}
        />
      ))}
      {hidden.length > 0 && (
        <Tooltip title={hidden.join(", ")}>
          <Chip
            component="span"
            size="small"
            label={`+${hidden.length}`}
            aria-label={t("runs.moreTags", {
              count: hidden.length,
              tags: hidden.join(", "),
            })}
            data-testid="overflowTagsMore"
            sx={{ flexShrink: 0 }}
          />
        </Tooltip>
      )}
      <Box
        ref={ruler}
        aria-hidden
        data-testid="overflowRuler"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "flex",
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {tags.map((tag, index) => (
          <Chip
            key={`${index}-${tag}`}
            component="span"
            size="small"
            label={tag}
            sx={{ flexShrink: 0 }}
          />
        ))}
        <Chip
          component="span"
          size="small"
          label={`+${tags.length}`}
          sx={{ flexShrink: 0 }}
        />
      </Box>
    </Box>
  );
};
