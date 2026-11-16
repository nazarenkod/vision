// Events go only to connections subscribed to the record's project (spec 032).

export const projectRoom = (projectId: string): string => `project:${projectId}`;

/** Records by project, in their original order; records with no project reach nobody. */
export function groupByProject<T>(items: T[], projectOf: (item: T) => string | null | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const projectId = projectOf(item);
    if (!projectId) continue;
    const group = groups.get(projectId);
    if (group) group.push(item);
    else groups.set(projectId, [item]);
  }
  return groups;
}
