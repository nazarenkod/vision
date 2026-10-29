import React from "react";
import { Box, Chip } from "@mui/material";
import { TestVariation } from "../types";
import { tokens } from "../theme";
import { MessageKey, useT } from "../i18n";

interface IProps {
  testVariation: TestVariation;
}

/** What identifies a baseline, on one line of quiet tags. */
export const TestVariationDetails: React.FunctionComponent<IProps> = ({
  testVariation,
}) => {
  const { t } = useT();
  const tags = (
    [
      ["baselines.tag.os", testVariation.os],
      ["baselines.tag.device", testVariation.device],
      ["baselines.tag.customTags", testVariation.customTags],
      ["baselines.tag.browser", testVariation.browser],
      ["baselines.tag.viewport", testVariation.viewport],
    ] as Array<[MessageKey, string | undefined]>
  ).filter(([, value]) => value);
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.75,
        alignItems: "center",
      }}
    >
      {tags.map(([name, value]) => (
        <Chip
          key={name}
          size="small"
          label={`${t(name)}: ${value}`}
          sx={{ borderRadius: 1.5, bgcolor: tokens.subtle }}
        />
      ))}
      <Chip
        size="small"
        label={testVariation.branchName}
        sx={{ borderRadius: 1.5, fontFamily: tokens.mono, fontSize: 11.5 }}
      />
    </Box>
  );
};
