export const routes = {
  // open
  LOGIN: "/login",
  REGISTER: "/register",

  // secured
  HOME: "/",
  PROFILE_PAGE: "/profile",
  PROJECT_LIST_PAGE: "/projects",
  VARIATION_LIST_PAGE: "/variations",
  VARIATION_DETAILS_PAGE: "/variations/details",
  INSIGHTS_PAGE: "/insights",

  // admin
  USER_LIST_PAGE: "/users",
  BACKUPS_PAGE: "/backups",
};

/** The settings page of a project, on one of its tabs. */
export const projectSettingsPath = (projectId: string, tab?: string) =>
  `${routes.PROJECT_LIST_PAGE}/${projectId}/settings${tab ? `/${tab}` : ""}`;
