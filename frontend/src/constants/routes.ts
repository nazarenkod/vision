export const routes = {
  // open
  LOGIN: "/login",
  REGISTER: "/register",

  // secured
  HOME: "/",
  PROFILE_PAGE: "/profile",
  PROJECT_LIST_PAGE: "/projects",
  // a project's settings: `${PROJECT_LIST_PAGE}/${id}/settings`
  PROJECT_SETTINGS_PAGE: "/projects/:projectId/settings",
  VARIATION_LIST_PAGE: "/variations",
  VARIATION_DETAILS_PAGE: "/variations/details",
  INSIGHTS_PAGE: "/insights",

  // admin
  USER_LIST_PAGE: "/users",
  BACKUPS_PAGE: "/backups",
};
