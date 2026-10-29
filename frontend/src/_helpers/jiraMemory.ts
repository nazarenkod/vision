// Remembered in the browser: the task per screen, and how often each issue and
// link type was used, so the most frequent one is offered first. Shared by the
// accessibility bug dialog and the bug from the comparison (025).

export const JIRA_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

export const parentKeyFor = (projectId: string, screen: string) =>
  `vision.jira.parent.${projectId}.${screen}`;
export const lastParentKey = (projectId: string) =>
  `vision.jira.parent.${projectId}`;
export const usageKey = (projectId: string, kind: "issueType" | "linkType") =>
  `vision.jira.${kind}.${projectId}`;
// field values chosen last time (customer, severity…), by Jira field id
export const fieldsKey = (projectId: string) =>
  `vision.jira.fields.${projectId}`;

export const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
export const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // a convenience only
  }
};
export const usage = (key: string): Record<string, number> => {
  try {
    return JSON.parse(read(key) ?? "{}") ?? {};
  } catch {
    return {};
  }
};
export const countUse = (key: string, value: string) =>
  write(
    key,
    JSON.stringify({ ...usage(key), [value]: (usage(key)[value] ?? 0) + 1 }),
  );
export const mostUsed = (key: string, options: string[]): string | null => {
  const counts = usage(key);
  return (
    options
      .filter((option) => counts[option])
      .sort((a, b) => counts[b] - counts[a])[0] ?? null
  );
};
