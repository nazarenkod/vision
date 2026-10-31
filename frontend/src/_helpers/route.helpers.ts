import { routes } from "../constants";
import qs from "qs";

export const buildProjectPageUrl = (projectId: string) =>
  `${routes.HOME}${projectId}`;

/** The tabs of a build (031); Overview when the address names none. */
export type BuildTab = "overview" | "changes" | "all" | "a11y";
const BUILD_TABS: BuildTab[] = ["overview", "changes", "all", "a11y"];

export interface BuildPlace {
  // the build's tab, kept in the address so a link opens it (REQ-031-02)
  tab?: BuildTab;
  // the review queue the comparison steps through (REQ-031-29)
  queue?: string;
  // All tests opened on one status, from a number of the overview (REQ-031-06)
  status?: string;
}

export const buildTestRunLocation = (
  buildId?: string,
  testRunId?: string,
  place: BuildPlace = {},
) => {
  if (!buildId) return { search: "" };
  // the run goes last: links and tests read it off the end
  const params = new URLSearchParams({ buildId });
  if (place.tab && place.tab !== "overview") params.set("tab", place.tab);
  if (place.status) params.set("status", place.status);
  if (testRunId && place.queue) params.set("queue", place.queue);
  if (testRunId) params.set("testId", testRunId);
  return { search: params.toString() };
};

export interface QueryParams extends BuildPlace {
  buildId?: string;
  testId?: string;
}

export const getQueryParams = (guery: string): QueryParams => {
  const queryParams = qs.parse(guery, { ignoreQueryPrefix: true });
  const tab = queryParams.tab as BuildTab | undefined;
  return {
    buildId: queryParams.buildId as string,
    testId: queryParams.testId as string,
    tab: tab && BUILD_TABS.includes(tab) ? tab : "overview",
    queue: (queryParams.queue as string) || undefined,
    status: (queryParams.status as string) || undefined,
  };
};

export const buildProjectSettingsUrl = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/settings`;
