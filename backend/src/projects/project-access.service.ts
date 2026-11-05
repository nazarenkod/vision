import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { looksLikeUuid } from '../shared/random-key';
import { ProjectRef } from './project-access';

export interface ProjectMember {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  createdAt: Date;
}

/** Loads what project-access.ts decides on: the projects a request names, and who was given which (042). */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prismaService: PrismaService) {}

  /** The projects these values belong to; a value that names nothing is left to the route. */
  async projectsOf(is: ProjectRef, values: string[]): Promise<string[]> {
    if (!values.length) return [];
    const prisma = this.prismaService;
    switch (is) {
      case 'project': {
        const ids = values.filter(looksLikeUuid);
        const names = values.filter((value) => !looksLikeUuid(value));
        const rows = await prisma.project.findMany({
          where: { OR: [{ id: { in: ids } }, { name: { in: names } }] },
          select: { id: true },
        });
        return rows.map((row) => row.id);
      }
      case 'build':
        return this.ofBuilds(values.filter(looksLikeUuid));
      case 'testRun':
      case 'testRuns': {
        const runs = await prisma.testRun.findMany({
          where: { id: { in: values.filter(looksLikeUuid) } },
          select: { projectId: true, buildId: true },
        });
        // older runs have no project of their own: theirs is their build's
        const withoutProject = runs.filter((run) => !run.projectId).map((run) => run.buildId);
        return [
          ...runs.flatMap((run) => (run.projectId ? [run.projectId] : [])),
          ...(await this.ofBuilds(withoutProject)),
        ];
      }
      case 'variation': {
        const rows = await prisma.testVariation.findMany({
          where: { id: { in: values.filter(looksLikeUuid) } },
          select: { projectId: true },
        });
        return rows.map((row) => row.projectId);
      }
      case 'decision': {
        const rows = await prisma.reviewDecision.findMany({
          where: { id: { in: values.filter(looksLikeUuid) } },
          select: { items: true },
        });
        const runIds = rows.flatMap((row) =>
          Array.isArray(row.items) ? row.items.map((item) => (item as { testRunId?: string })?.testRunId) : []
        );
        return this.projectsOf(
          'testRuns',
          runIds.filter((id): id is string => typeof id === 'string')
        );
      }
      case 'reportLink': {
        const rows = await prisma.reportLink.findMany({
          where: { id: { in: values.filter(looksLikeUuid) } },
          select: { buildId: true },
        });
        return this.ofBuilds(rows.map((row) => row.buildId));
      }
    }
  }

  private async ofBuilds(buildIds: string[]): Promise<string[]> {
    if (!buildIds.length) return [];
    const rows = await this.prismaService.build.findMany({
      where: { id: { in: buildIds } },
      select: { projectId: true },
    });
    return rows.map((row) => row.projectId);
  }

  /** The projects a person was given; an admin needs none. */
  async grantedTo(userId: string): Promise<Set<string>> {
    const rows = await this.prismaService.projectAccess.findMany({ where: { userId }, select: { projectId: true } });
    return new Set(rows.map((row) => row.projectId));
  }

  /** Whom a project was given to, for its settings. */
  async members(projectId: string): Promise<ProjectMember[]> {
    const rows = await this.prismaService.projectAccess.findMany({
      where: { projectId },
      select: {
        createdAt: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { user: { email: 'asc' } },
    });
    return rows.map(({ createdAt, user }) => ({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt,
    }));
  }

  /** Each person's projects, by name, for the Users page. */
  async projectsByUser(): Promise<Map<string, Array<{ id: string; name: string }>>> {
    const rows = await this.prismaService.projectAccess.findMany({
      select: { userId: true, project: { select: { id: true, name: true } } },
      orderBy: { project: { name: 'asc' } },
    });
    const byUser = new Map<string, Array<{ id: string; name: string }>>();
    for (const row of rows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.project]);
    return byUser;
  }

  async grant(projectId: string, userId: string, by?: Pick<User, 'id'>): Promise<void> {
    await this.prismaService.projectAccess.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId, grantedById: by?.id ?? null },
      update: {},
    });
  }

  async revoke(projectId: string, userId: string): Promise<void> {
    await this.prismaService.projectAccess.deleteMany({ where: { userId, projectId } });
  }
}
