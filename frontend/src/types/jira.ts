/** The Jira issue and link types the project settings offer (049), mirrors the backend. */
export interface JiraTypeLists {
  issueTypes: Array<{ name: string; subtask: boolean }>;
  linkTypes: string[];
}

/** Why there are no lists: no address, a host the server refuses, no own token, Jira failed. */
export type JiraTypesProblem =
  | "notSet"
  | "hostNotAllowed"
  | "noToken"
  | "failed"
  // Jira sent the call on to another address; Vision does not follow it with the token (051)
  | "redirected";

export type JiraTypesResponse =
  JiraTypeLists | { problem: JiraTypesProblem; location?: string };
