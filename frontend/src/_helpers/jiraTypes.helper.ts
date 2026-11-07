import { english, Text } from "../i18n";

export interface JiraTypeOption {
  /** What is saved: empty for Automatic (REQ-049-02). */
  value: string;
  label: string;
  /** Heading of the group the option sits under, if any (REQ-049-08). */
  group?: string;
  /** Saved earlier, but this Jira does not return it (REQ-049-06). */
  missing?: boolean;
}

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The options of a Jira type list: Automatic first, then the types, sub-tasks
 * apart, and a saved value Jira no longer returns, marked rather than dropped.
 */
export function jiraTypeOptions(
  types: ReadonlyArray<{ name: string; subtask?: boolean }>,
  saved: string | null | undefined,
  text: Text = english,
): JiraTypeOption[] {
  const grouped = types.some((type) => type.subtask);
  const options: JiraTypeOption[] = [
    { value: "", label: text("jira.automatic") },
  ];
  const kept = saved?.trim();
  if (kept && !types.some((type) => same(type.name, kept))) {
    options.push({
      value: kept,
      label: `${kept} — ${text("jira.missing")}`,
      missing: true,
    });
  }
  const groupOf = (subtask?: boolean) =>
    grouped
      ? text(subtask ? "jira.groupSubtasks" : "jira.groupIssueTypes")
      : undefined;
  for (const subtask of [false, true]) {
    for (const type of types) {
      if (!!type.subtask !== subtask) continue;
      options.push({
        value: type.name,
        label: type.name,
        group: groupOf(type.subtask),
      });
    }
  }
  return options;
}

/** The option a saved value stands for: Jira's spelling of the same name. */
export function selectedJiraType(
  options: ReadonlyArray<JiraTypeOption>,
  saved: string | null | undefined,
): string {
  const kept = saved?.trim() ?? "";
  return options.find((option) => same(option.value, kept))?.value ?? kept;
}
