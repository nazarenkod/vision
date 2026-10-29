import React from "react";
import { Box } from "@mui/material";
import { tokens } from "../theme";

/** A placeholder shaped like what is loading, with light passing over it. */
export const shimmer = {
  background: `linear-gradient(90deg, ${tokens.subtle} 0%, ${tokens.border} 50%, ${tokens.subtle} 100%)`,
  backgroundSize: "200% 100%",
  animation: "v-shimmer 1.4s linear infinite",
  borderRadius: 1.5,
};

export const SkeletonList: React.FunctionComponent = () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <Box height={1} overflow="auto" data-testid="skeletonList" aria-busy="true">
      {list.map((i) => (
        <Box
          key={i}
          sx={{
            p: 1.25,
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
            borderBottom: `1px solid ${tokens.border}`,
          }}
        >
          <Box sx={{ ...shimmer, height: 12, width: "60%" }} />
          <Box sx={{ ...shimmer, height: 9, width: "40%" }} />
          <Box sx={{ ...shimmer, height: 9, width: "80%" }} />
        </Box>
      ))}
    </Box>
  );
};
