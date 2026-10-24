import React from "react";
import { Box } from "@mui/material";

/** The product's mark: two screens side by side, the second one checked. */
export const BrandMark: React.FunctionComponent<{ size?: number }> = ({
  size = 32,
}) => (
  <Box
    sx={{
      width: size,
      height: size,
      borderRadius: `${Math.round(size * 0.28)}px`,
      bgcolor: "primary.main",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <svg
      width={size * 0.62}
      height={size * 0.62}
      viewBox="0 0 20 20"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="2.5" y="4" width="7" height="12" rx="1.5" />
      <rect x="10.5" y="4" width="7" height="12" rx="1.5" />
      <path d="M12.5 10h3" />
    </svg>
  </Box>
);
