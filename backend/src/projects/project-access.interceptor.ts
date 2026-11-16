import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@prisma/client';
import { from, Observable, switchMap } from 'rxjs';
import { mayReach, PROJECT_ACCESS, ProjectAccessRule, valuesOf } from './project-access';
import { ProjectAccessService } from './project-access.service';

/**
 * Checks a request against the projects it names, before the handler runs (042). It runs after
 * the guards, so the person is known: from the session, or the owner of the API key. A refusal
 * reads like a missing row, so a person cannot even learn that a project exists; autotests are
 * told why, so a run can be fixed.
 */
@Injectable()
export class ProjectAccessInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: ProjectAccessService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rule = this.reflector.get<ProjectAccessRule | null | undefined>(PROJECT_ACCESS, context.getHandler());
    if (context.getType() !== 'http' || !rule) return next.handle();
    const request = context.switchToHttp().getRequest<{ user?: User; params: object; query: object; body: unknown }>();
    return from(this.check(rule, request)).pipe(switchMap(() => next.handle()));
  }

  private async check(
    rule: ProjectAccessRule,
    request: { user?: User; params: object; query: object; body: unknown }
  ): Promise<void> {
    const projectIds = (
      await Promise.all(
        rule.sources.map((source) =>
          this.access.projectsOf(source.is, valuesOf(source, request as Parameters<typeof valuesOf>[1]))
        )
      )
    ).flat();
    if (!projectIds.length) return;
    const user = request.user;
    const granted = user && user.role !== 'admin' ? await this.access.grantedTo(user.id) : new Set<string>();
    if (mayReach(user, projectIds, granted)) return;
    if (rule.refuse === 'forbidden') {
      throw new ForbiddenException('No access to this project: ask an admin of Vision to add you to it');
    }
    throw new NotFoundException('Not found');
  }
}
