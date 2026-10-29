import React from "react";
import { useRouteError } from "react-router-dom";
import { Box } from "@mui/material";
import { ErrorState } from "./EmptyState";
import { LanguageProvider, useT } from "../i18n";

/**
 * What a crash in a page shows instead of the router's developer screen: the
 * reason, and a way back. The page reloads, so the app starts clean.
 */
const RouteErrorState: React.FunctionComponent<{ reason?: string }> = ({
  reason,
}) => {
  const { t } = useT();
  return (
    <ErrorState
      title={t("states.routeError")}
      reason={reason}
      onRetry={() => window.location.reload()}
    />
  );
};

export const RouteError: React.FunctionComponent = () => {
  const error = useRouteError();
  const reason =
    error instanceof Error ? error.message : error ? String(error) : undefined;
  return (
    // outside the app, so it brings the language along
    <LanguageProvider>
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <RouteErrorState reason={reason} />
      </Box>
    </LanguageProvider>
  );
};
