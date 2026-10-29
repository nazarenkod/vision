import React from "react";
import { Box, Chip } from "@mui/material";
import { TestVariation } from "../types";
import { tokens } from "../theme";

interface IProps {
  testVariation: TestVariation;
}

/** What identifies a baseline, on one line of quiet tags. */
export const TestVariationDetails: React.FunctionComponent<IProps> = ({
  testVariation,
}) => {
  const tags = [
    ["OS", testVariation.os],
    ["Device", testVariation.device],
    ["Custom Tags", testVariation.customTags],
    ["Browser", testVariation.browser],
    ["Viewport", testVariation.viewport],
  ].filter(([, value]) => value);
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
          label={`${name}: ${value}`}
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
