import React from "react";
import { Box, Card, Typography } from "@mui/material";
import { tokens, type } from "../theme";

/**
 * One card of a settings page (spec 046): a title with an optional status
 * pill or a note on the right, the fields, and a footer whose actions stand
 * on the right, "Save" last.
 */
export const FormCard: React.FunctionComponent<{
  title: React.ReactNode;
  // a pill right after the title: whether a key is saved
  status?: React.ReactNode;
  // a quiet note at the right end of the title row
  aside?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  "data-testid"?: string;
}> = ({
  title,
  status,
  aside,
  description,
  footer,
  children,
  "data-testid": testId,
}) => (
  <Card variant="outlined" data-testid={testId} component="section">
    <Box
      sx={{
        px: 3,
        py: 2.5,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            flexWrap: "wrap",
          }}
        >
          <Typography
            component="h2"
            sx={{ fontSize: type.title, fontWeight: 600, lineHeight: 1.5 }}
          >
            {title}
          </Typography>
          {status}
          {aside && (
            <Typography
              component="span"
              data-testid="cardAside"
              sx={{
                ml: "auto",
                fontSize: type.small,
                color: tokens.textMuted,
              }}
            >
              {aside}
            </Typography>
          )}
        </Box>
        {description && (
          <Typography
            sx={{
              fontSize: type.body,
              lineHeight: 1.45,
              color: tokens.textSecondary,
            }}
          >
            {description}
          </Typography>
        )}
      </Box>
      {children}
    </Box>
    {footer && (
      <Box
        data-testid="cardFooter"
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 1,
          px: 3,
          py: 1.5,
          borderTop: `1px solid ${tokens.border}`,
        }}
      >
        {footer}
      </Box>
    )}
  </Card>
);
