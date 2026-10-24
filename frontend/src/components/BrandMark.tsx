import React from "react";
import { Box } from "@mui/material";

/** The product's mark: an eye. */
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
      <path d="M1.5 10C3.8 5.8 6.7 4 10 4s6.2 1.8 8.5 6c-2.3 4.2-5.2 6-8.5 6s-6.2-1.8-8.5-6Z" />
      <circle cx="10" cy="10" r="2.8" />
      <circle cx="10" cy="10" r="0.9" fill="#FFFFFF" stroke="none" />
    </svg>
  </Box>
);
