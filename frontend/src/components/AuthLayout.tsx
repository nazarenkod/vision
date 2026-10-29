import React from "react";
import { Box, Typography } from "@mui/material";
import { BrandLockup } from "./BrandMark";
import { BRAND } from "../constants/brand";
import { tokens } from "../theme";

// One pixel off the grid that settles back: the logo's story, once, quietly.
const StrayPixel: React.FunctionComponent = () => (
  <Box
    aria-hidden="true"
    sx={{
      position: "absolute",
      left: "calc(50% + 126px)",
      top: "calc(50% - 222px)",
      width: 27,
      height: 27,
      borderRadius: "3px",
      bgcolor: tokens.brand,
      opacity: 0.16,
      "@keyframes v-stray-auth": {
        "0%, 20%": {
          transform: "translate(9px, -7px)",
          backgroundColor: tokens.diff,
          opacity: 0.35,
        },
        "45%, 100%": { transform: "none", opacity: 0.16 },
      },
      animation: "v-stray-auth 2.4s cubic-bezier(.16, 1, .3, 1) both .4s",
    }}
  />
);

/** Centered card with the product's mark for sign-in and sign-up. */
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
      position: "relative",
      overflow: "hidden",
    }}
  >
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: 0,
        backgroundImage: `linear-gradient(${tokens.border} 1px, transparent 1px), linear-gradient(90deg, ${tokens.border} 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
        backgroundPosition: "center",
        opacity: 0.55,
        maskImage:
          "radial-gradient(60% 60% at 50% 45%, black 0%, transparent 80%)",
        WebkitMaskImage:
          "radial-gradient(60% 60% at 50% 45%, black 0%, transparent 80%)",
      }}
    />
    <StrayPixel />
    <Box
      sx={{
        width: "100%",
        maxWidth: 400,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        position: "relative",
      }}
    >
      <Box
        className="v-enter"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          textAlign: "center",
        }}
      >
        <BrandLockup markSize={56} wordSize={32} direction="column" gap={1.5} />
        <Typography color="textSecondary">{BRAND.tagline}</Typography>
      </Box>
      <Box
        className="v-enter"
        style={{ "--v-delay": "68ms" } as React.CSSProperties}
        sx={{
          bgcolor: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: 4,
          boxShadow: tokens.shadowShot,
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
