import { handleResponse, authHeader } from "../_helpers/service.helpers";
import { API_URL } from "../_config/env.config";
import { BuildOverview } from "../types/buildOverview";

/** The build's Overview tab (031). */
export const buildOverviewService = {
  get: (buildId: string): Promise<BuildOverview> =>
    fetch(`${API_URL}/builds/${buildId}/overview`, {
      method: "GET",
      headers: authHeader(),
    }).then(handleResponse),
};
