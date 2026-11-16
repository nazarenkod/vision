import { ForbiddenException, NotFoundException, Type } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { lastValueFrom, of } from 'rxjs';
import { AiController } from '../ai/ai.controller';
import { AnalyticsController } from '../analytics/analytics.controller';
import { BackupsController } from '../backups/backups.controller';
import { BuildsController } from '../builds/builds.controller';
import { OllamaController } from '../compare/libs/vlm/providers/ollama/ollama.controller';
import { HealthController } from '../health/health.controller';
import { ReportsController } from '../reports/reports.controller';
import { StaticController } from '../static/static.controller';
import { TestRunsController } from '../test-runs/test-runs.controller';
import { TestVariationsController } from '../test-variations/test-variations.controller';
import { UsersController } from '../users/users.controller';
import { VisualBugsController } from '../visual-bugs/visual-bugs.controller';
import { PROJECT_ACCESS, ProjectAccessRule, ProjectSource } from './project-access';
import { ProjectAccessInterceptor } from './project-access.interceptor';
import { ProjectAccessService } from './project-access.service';
import { ProjectsController } from './projects.controller';

const CONTROLLERS: Type[] = [
  AiController,
  AnalyticsController,
  BackupsController,
  BuildsController,
  HealthController,
  OllamaController,
  ProjectsController,
  ReportsController,
  StaticController,
  TestRunsController,
  TestVariationsController,
  UsersController,
  VisualBugsController,
];

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return controllerFiles(path);
    return name.endsWith('.controller.ts') ? [path] : [];
  });
}

const routes = CONTROLLERS.flatMap((controller) =>
  Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ controller, name, handler: controller.prototype[name] }))
    .filter(({ handler }) => Reflect.getMetadata(METHOD_METADATA, handler) !== undefined)
    .map((route) => ({
      ...route,
      label: `${route.controller.name}.${route.name} ${Reflect.getMetadata(PATH_METADATA, route.handler)}`,
      rule: Reflect.getMetadata(PROJECT_ACCESS, route.handler) as ProjectAccessRule | null | undefined,
    }))
);

// every lookup finds the same project, one the person was not given
const OTHER_PROJECT = 'p0000000-0000-4000-8000-000000000000';
const ID = '00000000-0000-4000-8000-000000000001';
const many = () => ({
  findMany: jest.fn().mockResolvedValue([{ id: OTHER_PROJECT, projectId: OTHER_PROJECT, buildId: ID }]),
});
const prisma = {
  project: many(),
  build: many(),
  testRun: many(),
  testVariation: many(),
  reviewDecision: { findMany: jest.fn().mockResolvedValue([{ items: [{ testRunId: ID }] }]) },
  reportLink: { findMany: jest.fn().mockResolvedValue([{ buildId: ID }]) },
  projectAccess: { findMany: jest.fn().mockResolvedValue([{ projectId: 'a-project-they-have' }]) },
};

function requestFor(sources: ProjectSource[]) {
  const request = { params: {}, query: {}, body: {} as unknown, user: { id: 'editor', role: Role.editor } };
  for (const source of sources) {
    const holder = source.in === 'param' ? request.params : source.in === 'query' ? request.query : request.body;
    if (source.key === undefined) request.body = source.is === 'testRuns' ? [ID] : ID;
    else (holder as Record<string, unknown>)[source.key] = source.is === 'testRuns' ? [ID] : ID;
  }
  return request;
}

describe('access to projects on every route', () => {
  it('names where every route finds its project, or that it has none', () => {
    // a controller this test does not know would go unchecked
    const known = CONTROLLERS.map((controller) => controller.name);
    expect(controllerFiles(join(__dirname, '..')).length).toBe(known.length);

    const unmarked = routes.filter((route) => route.rule === undefined).map((route) => route.label);
    expect(unmarked).toEqual([]);
  });

  it('answers not found on every route of a project without access', async () => {
    const interceptor = new ProjectAccessInterceptor(new Reflector(), new ProjectAccessService(prisma as never));
    const projectRoutes = routes.filter((route) => route.rule);
    expect(projectRoutes.length).toBeGreaterThan(40);

    for (const route of projectRoutes) {
      const handle = jest.fn(() => of('the data'));
      const context = {
        getType: () => 'http',
        getHandler: () => route.handler,
        getClass: () => route.controller,
        switchToHttp: () => ({ getRequest: () => requestFor(route.rule!.sources) }),
      };
      const refusal = route.rule!.refuse === 'forbidden' ? ForbiddenException : NotFoundException;
      await expect(lastValueFrom(interceptor.intercept(context as never, { handle }))).rejects.toThrow(refusal);
      // the route itself never ran
      expect(handle).not.toHaveBeenCalled();
    }
  });

  it('keeps the public report open by its token', () => {
    const publicReport = routes.find((route) => route.name === 'publicReport')!;
    expect(publicReport.rule).toBeNull();
    expect(Reflect.getMetadata(GUARDS_METADATA, publicReport.handler)).toBeUndefined();
  });
});
