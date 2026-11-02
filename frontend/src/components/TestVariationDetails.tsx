import React from "react";
import { Box, Chip, Tooltip } from "@mui/material";
import { TestVariation } from "../types";
import { tokens } from "../theme";
import { useT } from "../i18n";
import { DeviceTags } from "./DeviceTags";

interface IProps {
  testVariation: TestVariation;
}

/** What identifies a baseline, on one line of quiet tags. */
export const TestVariationDetails: React.FunctionComponent<IProps> = ({
  testVariation,
}) => {
  const { t } = useT();
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.5,
        alignItems: "center",
      }}
    >
      {/* the same grey tags as everywhere, named in their tooltips (spec 037) */}
      <DeviceTags parts={testVariation} />
      {testVariation.customTags && (
        <Tooltip title={t("review.attr.customTags")} describeChild>
          <Chip
            component="span"
            size="small"
            label={testVariation.customTags}
          />
        </Tooltip>
      )}
      <Chip
        size="small"
        label={testVariation.branchName}
        sx={{
          ml: 0.5,
          borderRadius: 1.5,
          fontFamily: tokens.mono,
          fontSize: 11.5,
        }}
      />
    </Box>
  );
};
