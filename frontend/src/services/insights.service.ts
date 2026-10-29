import { handleResponse, authHeader } from "../_helpers/service.helpers";
import { API_URL } from "../_config/env.config";
import {
  A11yDecisionResult,
  A11yReport,
  JiraBugResult,
  AiStatus,
  ChangeGroup,
  ElementRule,
  ElementRuleAction,
  GroupSummary,
  JiraBugPreparation,
  JiraUser,
  ProjectInsights,
  Rect,
  SelectorMatches,
  StructureInfo,
  BugDraft,
  VisualBug,
  VisualBugFiling,
  VisualBugPreparation,
  VisualBugResult,
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
// the first id keeps older servers working; the list is the whole problem
const issueRef = (violationIds: string[]) => ({
  violationId: violationIds[0],
  violationIds,
});

export const insightsService = {
  getGroups: (buildId: string) =>
    get<ChangeGroup[]>(`/test-runs/groups?buildId=${buildId}`),
  getA11y: (testRunId: string) =>
    get<A11yReport | null>(`/test-runs/${testRunId}/a11y`),
  getStructure: (testRunId: string) =>
    get<StructureInfo | null>(`/test-runs/${testRunId}/structure`),
  getProjectInsights: (projectId: string, days: number) =>
    get<ProjectInsights>(`/analytics/${projectId}?days=${days}`),
  // each takes every issue of one problem (same rule, same component)
  ignoreA11y: (testRunId: string, violationIds: string[], comment?: string) =>
    post<A11yDecisionResult>(`/test-runs/${testRunId}/a11y/ignore`, {
      ...issueRef(violationIds),
      comment,
    }),
  resetA11y: (testRunId: string, violationIds: string[]) =>
    post<A11yDecisionResult>(
      `/test-runs/${testRunId}/a11y/reset`,
      issueRef(violationIds),
    ),
  linkA11y: (testRunId: string, violationIds: string[], jiraKey: string) =>
    post<A11yDecisionResult>(`/test-runs/${testRunId}/a11y/link`, {
      ...issueRef(violationIds),
      jiraKey,
    }),
  prepareA11yBug: (
    testRunId: string,
    violationIds: string[],
    parentKey: string,
    issueTypeId?: string,
    fieldValues?: Record<string, unknown>,
  ) =>
    post<JiraBugPreparation>(`/test-runs/${testRunId}/a11y/jira/prepare`, {
      ...issueRef(violationIds),
      parentKey,
      ...(issueTypeId ? { issueTypeId } : {}),
      ...(fieldValues ? { fieldValues } : {}),
    }),
  findJiraUsers: (testRunId: string, query: string) =>
    get<JiraUser[]>(
      `/test-runs/${testRunId}/a11y/jira/users?query=${encodeURIComponent(query)}`,
    ),
  fileA11yBug: (
    testRunId: string,
    violationIds: string[],
    options: {
      parentKey: string;
      issueTypeId?: string;
      linkType?: string;
      fieldValues?: Record<string, unknown>;
    },
  ) =>
    post<JiraBugResult>(`/test-runs/${testRunId}/a11y/jira`, {
      ...issueRef(violationIds),
      ...options,
    }),
  addElementRule: (
    testRunId: string,
    rule: {
      scope: "screen" | "project";
      selector: string;
      action: ElementRuleAction;
      maxDiffPercent?: number;
    },
  ) => post<ElementRule>(`/test-runs/${testRunId}/element-rules`, rule),
  // what a selector would find, before the rule is saved (REQ-027-32)
  selectorMatches: (testRunId: string, selector: string) =>
    get<SelectorMatches>(
      `/test-runs/${testRunId}/selector-matches?selector=${encodeURIComponent(selector)}`,
    ),
  replaceAreaWithElement: (
    testRunId: string,
    areaId: string,
    selector: string,
  ) =>
    post<{ rule: ElementRule; area: Rect & { id: string } }>(
      `/test-runs/${testRunId}/ignore-areas/replace-with-element`,
      { areaId, selector },
    ),
  removeElementRule: (
    testRunId: string,
    scope: "screen" | "project",
    ruleId: string,
  ) => post(`/test-runs/${testRunId}/element-rules/remove`, { scope, ruleId }),
  prepareVisualBug: (
    testRunId: string,
    parentKey: string,
    issueTypeId?: string,
    fieldValues?: Record<string, unknown>,
  ) =>
    post<VisualBugPreparation>(`/test-runs/${testRunId}/bug/prepare`, {
      parentKey,
      ...(issueTypeId ? { issueTypeId } : {}),
      ...(fieldValues ? { fieldValues } : {}),
    }),
  fileVisualBug: (testRunId: string, filing: VisualBugFiling) =>
    post<VisualBugResult>(`/test-runs/${testRunId}/bug`, filing),
  visualBugs: (testRunId: string) =>
    get<VisualBug[]>(`/test-runs/${testRunId}/bugs`),
  draftBug: (request: {
    testRunId: string;
    note: string;
    marks: Array<{ x: number; y: number; width: number; height: number }>;
    changes: string[];
    attempt: number;
  }) => post<BugDraft>(`/ai/bug-draft`, request),
  aiStatus: () => get<AiStatus>(`/ai/status`),
  groupSummary: (buildId: string, groupId: string) =>
    post<GroupSummary>(`/ai/group-summary`, { buildId, groupId }),
  suggestLabels: (testRunId: string) =>
    post<{ suggestions: Array<{ violationId: string; label: string }> }>(
      `/ai/a11y-labels`,
      { testRunId },
    ),
};
