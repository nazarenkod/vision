import React from "react";
import { Box, Chip, SxProps, Theme, Tooltip } from "@mui/material";
import { tokens } from "../theme";
import { useT } from "../i18n";
import type { Text } from "../i18n/dictionaries";
import {
  DeviceField,
  DeviceParts,
  deviceTagsOf,
} from "../_helpers/device.helper";

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
              borderRadius: 9,
              // a fill is lost when the page prints without backgrounds
              border: `1px solid ${tokens.borderStrong}`,
              fontSize: 11,
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
                  fontSize: 11.5,
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
