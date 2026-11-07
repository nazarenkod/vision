import { JiraIssueType, JiraLinkType } from './jira.client';

/** What the project settings offer for the Jira issue and link type (049). */
export interface JiraTypeLists {
  issueTypes: Array<{ name: string; subtask: boolean }>;
  linkTypes: string[];
}

/** Why the settings show no lists, for the person looking at them (REQ-049-04, 05, 13). */
export type JiraTypesProblem = 'notSet' | 'hostNotAllowed' | 'noToken' | 'failed';

export type JiraTypesResponse = JiraTypeLists | { problem: JiraTypesProblem };

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * Jira repeats a type's name once per scheme that uses it: the settings store a name, so each name
 * appears once, and a name that is a sub-task anywhere counts as one (REQ-049-08).
 */
export function jiraTypesFor(issueTypes: JiraIssueType[], linkTypes: JiraLinkType[]): JiraTypeLists {
  const issues = new Map<string, { name: string; subtask: boolean }>();
  for (const type of issueTypes) {
    const name = type.name?.trim();
    if (!name) continue;
    const seen = issues.get(name.toLowerCase());
    issues.set(name.toLowerCase(), { name: seen?.name ?? name, subtask: !!seen?.subtask || type.subtask });
  }
  const links = new Map<string, string>();
  for (const type of linkTypes) {
    const name = type.name?.trim();
    if (name && !links.has(name.toLowerCase())) links.set(name.toLowerCase(), name);
  }
  return {
    issueTypes: [...issues.values()].sort((a, b) => byName(a.name, b.name)),
    linkTypes: [...links.values()].sort(byName),
  };
}
