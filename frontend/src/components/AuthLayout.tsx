import React from "react";
import { Box, Typography } from "@mui/material";
import { BrandMark } from "./BrandMark";
import { BRAND } from "../constants/brand";
import { tokens } from "../theme";

/** Centered card with the product's name for sign-in and sign-up. */
export const AuthLayout: React.FunctionComponent<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <Box
    sx={{
      minHeight: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      px: 2,
      py: 6,
      boxSizing: "border-box",
    }}
  >
    <Box
      sx={{
        width: "100%",
        maxWidth: 400,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          textAlign: "center",
        }}
      >
        <BrandMark size={52} />
        <Typography variant="h4" component="p" sx={{ fontWeight: 700 }}>
          {BRAND.name}
        </Typography>
        <Typography color="textSecondary">{BRAND.tagline}</Typography>
      </Box>
      <Box
        sx={{
          bgcolor: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: 3,
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography variant="h6" component="h1">
          {title}
        </Typography>
        {children}
      </Box>
    </Box>
  </Box>
);
