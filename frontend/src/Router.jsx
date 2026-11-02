import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import ProjectsListPage from "./pages/ProjectListPage";
import ProjectPage from "./pages/ProjectPage";
import PrivateRoute from "./components/PrivateRoute";
import { routes } from "./constants";
import ProfilePage from "./pages/ProfilePage";
import TestVariationListPage from "./pages/TestVariationListPage";
import InsightsPage from "./pages/InsightsPage";
import UserListPage from "./pages/UserListPage";
import BackupsPage from "./pages/BackupsPage";
import TestVariationDetailsPage from "./pages/TestVariationDetailsPage";
import ProjectSettingsPage from "./pages/ProjectSettingsPage";
import { useUserState } from "./contexts";
import { PrintReportPage, PublicReportPage } from "./pages/ReportPage";

// Nobody signs themselves up (035): an admin creates accounts in Users. An old
// sign-up link still leads somewhere useful.
function RegisterRoute() {
  const { user } = useUserState();
  return <Navigate to={user ? routes.HOME : routes.LOGIN} replace />;
}

function Router() {
  return (
    <Routes>
      <Route path={routes.LOGIN} element={<LoginPage />} />
      <Route path={routes.REGISTER} element={<RegisterRoute />} />
      {/* a build's report by its public link: no sign-in (031, ADR-0022) */}
      <Route path={routes.PUBLIC_REPORT} element={<PublicReportPage />} />
      <Route
        path={routes.PRINT_REPORT}
        element={<PrivateRoute component={PrintReportPage} />}
      />
      <Route
        path={routes.PROFILE_PAGE}
        element={<PrivateRoute component={ProfilePage} />}
      />
      <Route
        path={routes.PROJECT_LIST_PAGE}
        element={<PrivateRoute component={ProjectsListPage} />}
      />
      <Route
        path={routes.PROJECT_SETTINGS_PAGE}
        element={
          <PrivateRoute
            component={ProjectSettingsPage}
            roles={["admin", "editor"]}
          />
        }
      />
      <Route
        path={routes.USER_LIST_PAGE}
        element={<PrivateRoute component={UserListPage} roles={["admin"]} />}
      />
      <Route
        path={routes.BACKUPS_PAGE}
        element={<PrivateRoute component={BackupsPage} roles={["admin"]} />}
      />
      <Route
        path={`${routes.HOME}:projectId`}
        element={<PrivateRoute component={ProjectPage} />}
      />
      <Route
        path={`${routes.VARIATION_LIST_PAGE}/:projectId`}
        element={<PrivateRoute component={TestVariationListPage} />}
      />
      <Route
        path={`${routes.INSIGHTS_PAGE}/:projectId`}
        element={<PrivateRoute component={InsightsPage} />}
      />
      <Route
        path={`${routes.VARIATION_DETAILS_PAGE}/:testVariationId`}
        element={<PrivateRoute component={TestVariationDetailsPage} />}
      />
      <Route path="*" element={<Navigate to={routes.PROJECT_LIST_PAGE} />} />
    </Routes>
  );
}

export default Router;
