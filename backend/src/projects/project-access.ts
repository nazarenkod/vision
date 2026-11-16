import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Access to projects (042): an admin sees every project, anyone else only the projects they were
 * given. Every route says where its request names a project, or that it has no project data, and
 * one interceptor checks the request before the handler runs.
 */

/** What the value in the request is: a project itself, or a row that belongs to one. */
export type ProjectRef = 'project' | 'build' | 'testRun' | 'testRuns' | 'variation' | 'decision' | 'reportLink';

export interface ProjectSource {
  in: 'param' | 'query' | 'body';
  /** the field; for a body that is itself the value (a list of ids), leave it out */
  key?: string;
  is: ProjectRef;
}

export interface ProjectAccessRule {
  sources: ProjectSource[];
  /** what a refusal says: not found, as for a missing row, or forbidden with why (autotests) */
  refuse: 'not-found' | 'forbidden';
}

export const PROJECT_ACCESS = 'vision:projectAccess';

export const ProjectFrom = (...sources: ProjectSource[]) =>
  SetMetadata<string, ProjectAccessRule>(PROJECT_ACCESS, { sources, refuse: 'not-found' });

/** For the routes autotests and the CLI write through: they say why, so a run can be fixed (REQ-042-09). */
export const ProjectFromForAutotests = (...sources: ProjectSource[]) =>
  SetMetadata<string, ProjectAccessRule>(PROJECT_ACCESS, { sources, refuse: 'forbidden' });

/** A route that shows or changes nothing of any project. */
export const NoProjectData = () => SetMetadata<string, ProjectAccessRule | null>(PROJECT_ACCESS, null);

export const inParam = (key: string, is: ProjectRef): ProjectSource => ({ in: 'param', key, is });
export const inQuery = (key: string, is: ProjectRef): ProjectSource => ({ in: 'query', key, is });
export const inBody = (key: string | undefined, is: ProjectRef): ProjectSource => ({ in: 'body', key, is });

/** The values a request holds for a source; a list for `testRuns`, nothing when it is absent. */
export function valuesOf(
  source: ProjectSource,
  request: { params?: Record<string, unknown>; query?: Record<string, unknown>; body?: unknown }
): string[] {
  const holder = source.in === 'param' ? request.params : source.in === 'query' ? request.query : request.body;
  const value = source.key === undefined ? holder : (holder as Record<string, unknown> | undefined)?.[source.key];
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

/** Whether a person may reach every one of these projects. */
export function mayReach(
  user: { role: Role } | null | undefined,
  projectIds: string[],
  granted: ReadonlySet<string>
): boolean {
  if (!user) return false;
  if (user.role === Role.admin) return true;
  return projectIds.every((id) => granted.has(id));
}
