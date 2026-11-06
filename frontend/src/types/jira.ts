/** The Jira issue and link types the project settings offer (049), mirrors the backend. */
export interface JiraTypeLists {
  issueTypes: Array<{ name: string; subtask: boolean }>;
  linkTypes: string[];
}

/** Why there are no lists: no address, a host the server refuses, no own token, Jira failed. */
export type JiraTypesProblem =
  "notSet" | "hostNotAllowed" | "noToken" | "failed";

export type JiraTypesResponse = JiraTypeLists | { problem: JiraTypesProblem };
