export const routes = {
  // open
  LOGIN: "/login",
  // no sign-up page any more (035): the old link redirects
  REGISTER: "/register",
  // a build's report by its public link (031)
  PUBLIC_REPORT: "/r/:token",

  // secured
  HOME: "/",
  PROFILE_PAGE: "/profile",
  PROJECT_LIST_PAGE: "/projects",
  // a project's settings: `${PROJECT_LIST_PAGE}/${id}/settings`
  PROJECT_SETTINGS_PAGE: "/projects/:projectId/settings",
  VARIATION_LIST_PAGE: "/variations",
  VARIATION_DETAILS_PAGE: "/variations/details",
  INSIGHTS_PAGE: "/insights",
  // a project's screens by their UI trees (053): `${SEARCH_PAGE}/${projectId}?q=…`
  SEARCH_PAGE: "/search",
  // a build's report, opened to print it (031)
  PRINT_REPORT: "/report/:buildId",
  // one check's UI tree on the whole window (062): `/inspect/${testRunId}?tree=…&node=…`
  INSPECT_PAGE: "/inspect/:testRunId",

  // admin
  USER_LIST_PAGE: "/users",
  BACKUPS_PAGE: "/backups",
};
