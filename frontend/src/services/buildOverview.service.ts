import { handleResponse, authHeader } from "../_helpers/service.helpers";
import { API_URL } from "../_config/env.config";
import { BuildA11yProblems, BuildOverview } from "../types/buildOverview";

/** The build's Overview tab (031). */
export const buildOverviewService = {
  get: (buildId: string): Promise<BuildOverview> =>
    fetch(`${API_URL}/builds/${buildId}/overview`, {
      method: "GET",
      headers: authHeader(),
    }).then(handleResponse),
  // every check's problems, for the build's Accessibility tab (065)
  a11yProblems: (buildId: string): Promise<BuildA11yProblems[]> =>
    fetch(`${API_URL}/builds/${buildId}/a11y-problems`, {
      method: "GET",
      headers: authHeader(),
    }).then(handleResponse),
};
