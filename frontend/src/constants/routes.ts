export const routes = {
  // open
  LOGIN: "/login",
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
  // a build's report, opened to print it (031)
  PRINT_REPORT: "/report/:buildId",

  // admin
  USER_LIST_PAGE: "/users",
  BACKUPS_PAGE: "/backups",
};
