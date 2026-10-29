import React from "react";
import { useRouteError } from "react-router-dom";
import { Box } from "@mui/material";
import { ErrorState } from "./EmptyState";

/**
 * What a crash in a page shows instead of the router's developer screen: the
 * reason, and a way back. The page reloads, so the app starts clean.
 */
export const RouteError: React.FunctionComponent = () => {
  const error = useRouteError();
  const reason =
    error instanceof Error ? error.message : error ? String(error) : undefined;
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <ErrorState
        title="Something went wrong on this page."
        reason={reason}
        onRetry={() => window.location.reload()}
      />
    </Box>
  );
};
