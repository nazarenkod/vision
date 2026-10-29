import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { RefreshOutlined } from "@mui/icons-material";
import { tokens } from "../theme";
import { useT } from "../i18n";

// The logo's story in a still: a grid of pixels, one set back into place.
const PixelGrid: React.FunctionComponent = () => (
  <Box
    aria-hidden="true"
    sx={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 14px)",
      gap: "4px",
      mb: 1,
      "@keyframes v-stray": {
        "0%, 25%": {
          transform: "translate(9px, -9px)",
          background: tokens.diff,
        },
        "50%, 100%": { transform: "none", background: tokens.brand },
      },
    }}
  >
    {Array.from({ length: 12 }, (_, i) => (
      <Box
        key={i}
        sx={{
          width: 14,
          height: 14,
          borderRadius: "3px",
          bgcolor: i === 6 ? tokens.brand : tokens.border,
          animation:
            i === 6
              ? "v-stray 1.6s cubic-bezier(.16, 1, .3, 1) both .3s"
              : "none",
        }}
      />
    ))}
  </Box>
);

/** Nothing here yet: says what would be here and how to get it. */
export const EmptyState: React.FunctionComponent<{
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, children, action }) => (
  <Box
    data-testid="emptyState"
    sx={{
      p: 6,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: 1.25,
    }}
  >
    <PixelGrid />
    <Typography variant="h6" component="p">
      {title}
    </Typography>
    {children && (
      <Typography color="textSecondary" sx={{ maxWidth: 420 }}>
        {children}
      </Typography>
    )}
    {action}
  </Box>
);

/** Loading failed: what happened, and a way to try again (REQ-018-66). */
const TryAgain: React.FunctionComponent<{ onClick: () => void }> = ({
  onClick,
}) => {
  const { t } = useT();
  return (
    <Button variant="contained" size="small" onClick={onClick}>
      {t("states.tryAgain")}
    </Button>
  );
};

export const ErrorState: React.FunctionComponent<{
  title: string;
  reason?: string;
  onRetry?: () => void;
}> = ({ title, reason, onRetry }) => (
  <Box
    role="alert"
    data-testid="errorState"
    sx={{
      p: 6,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: 1.25,
    }}
  >
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: 3,
        display: "grid",
        placeItems: "center",
        bgcolor: tokens.status.failed.bg,
        color: tokens.status.failed.fg,
        mb: 0.5,
      }}
    >
      <RefreshOutlined />
    </Box>
    <Typography variant="h6" component="p">
      {title}
    </Typography>
    {reason && (
      <Typography color="textSecondary" sx={{ maxWidth: 460 }}>
        {reason}
      </Typography>
    )}
    {onRetry && <TryAgain onClick={onRetry} />}
  </Box>
);
