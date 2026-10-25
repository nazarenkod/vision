import { handleResponse, authHeader } from "../_helpers/service.helpers";
import { API_URL } from "../_config/env.config";
import {
  A11yReport,
  AiStatus,
  ChangeGroup,
  CrossDeviceResult,
  DeviceProfile,
  GroupSummary,
  ProjectInsights,
  StructureInfo,
} from "../types/insights";

const JSON_HEADERS = { "Content-Type": "application/json" };

const get = <T>(path: string): Promise<T> =>
  fetch(`${API_URL}${path}`, { method: "GET", headers: authHeader() }).then(
    handleResponse,
  );

const post = <T>(path: string, body: unknown): Promise<T> =>
  fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { ...JSON_HEADERS, ...authHeader() },
    body: JSON.stringify(body),
  }).then(handleResponse);

/** Change groups, accessibility, element-level diff, Jira and AI. */
export const insightsService = {
  getGroups: (buildId: string) =>
    get<ChangeGroup[]>(`/test-runs/groups?buildId=${buildId}`),
  getA11y: (testRunId: string) =>
    get<A11yReport | null>(`/test-runs/${testRunId}/a11y`),
  getStructure: (testRunId: string) =>
    get<StructureInfo | null>(`/test-runs/${testRunId}/structure`),
  getProjectInsights: (projectId: string, days: number) =>
    get<ProjectInsights>(`/analytics/${projectId}?days=${days}`),
  getCrossDevice: (testRunId: string) =>
    get<CrossDeviceResult | null>(`/test-runs/${testRunId}/cross-device`),
  getProjectDevices: (projectId: string) =>
    get<Array<DeviceProfile & { checks: number }>>(
      `/projects/${projectId}/devices`,
    ),
  ignoreA11y: (testRunId: string, violationId: string, comment?: string) =>
    post(`/test-runs/${testRunId}/a11y/ignore`, { violationId, comment }),
  resetA11y: (testRunId: string, violationId: string) =>
    post(`/test-runs/${testRunId}/a11y/reset`, { violationId }),
  linkA11y: (testRunId: string, violationId: string, jiraKey: string) =>
    post(`/test-runs/${testRunId}/a11y/link`, { violationId, jiraKey }),
  fileA11yBug: (testRunId: string, violationId: string, parentKey: string) =>
    post<{ jiraKey: string; jiraUrl: string; warnings: string[] }>(
      `/test-runs/${testRunId}/a11y/jira`,
      {
        violationId,
        parentKey,
      },
    ),
  addElementRule: (
    testRunId: string,
    rule: {
      scope: "screen" | "project";
      selector: string;
      action: "ignore" | "tolerate";
      maxDiffPercent?: number;
    },
  ) => post(`/test-runs/${testRunId}/element-rules`, rule),
  removeElementRule: (
    testRunId: string,
    scope: "screen" | "project",
    ruleId: string,
  ) => post(`/test-runs/${testRunId}/element-rules/remove`, { scope, ruleId }),
  aiStatus: () => get<AiStatus>(`/ai/status`),
  groupSummary: (buildId: string, groupId: string) =>
    post<GroupSummary>(`/ai/group-summary`, { buildId, groupId }),
  suggestLabels: (testRunId: string) =>
    post<{ suggestions: Array<{ violationId: string; label: string }> }>(
      `/ai/a11y-labels`,
      { testRunId },
    ),
};
