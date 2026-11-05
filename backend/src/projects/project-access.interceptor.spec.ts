import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { lastValueFrom, of } from 'rxjs';
import { ApiGuard } from '../auth/guards/api.guard';
import { hashApiKey } from '../shared/api-key-hash';
import { inBody, inParam, ProjectFrom, ProjectFromForAutotests } from './project-access';
import { ProjectAccessInterceptor } from './project-access.interceptor';
import { ProjectAccessService } from './project-access.service';

const MINE = '11111111-1111-4111-8111-111111111111';
const THEIRS = '22222222-2222-4222-8222-222222222222';
const owner = { id: 'owner', role: Role.editor, apiKey: hashApiKey('owner-key') };

const prisma = {
  user: { findUnique: jest.fn(async ({ where }) => (where.apiKey === owner.apiKey ? owner : null)) },
  project: {
    findMany: jest.fn(async ({ where }) =>
      [MINE, THEIRS]
        .filter((id) => where.OR.some((or) => or.id?.in.includes(id) || or.name?.in.includes(id)))
        .map((id) => ({ id }))
    ),
  },
  build: { findMany: jest.fn(async ({ where }) => where.id.in.map((id: string) => ({ projectId: id }))) },
  projectAccess: { findMany: jest.fn(async ({ where }) => (where.userId === owner.id ? [{ projectId: MINE }] : [])) },
};

class Routes {
  @ProjectFrom(inParam('id', 'build'))
  read() {}

  @ProjectFromForAutotests(inBody('project', 'project'))
  start() {}
}

const interceptor = new ProjectAccessInterceptor(new Reflector(), new ProjectAccessService(prisma as never));

async function run(handler: () => void, request: object) {
  const handle = jest.fn(() => of('done'));
  const context = {
    getType: () => 'http',
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  };
  const answer = lastValueFrom(interceptor.intercept(context as never, { handle }));
  return { answer, handle };
}

describe('ProjectAccessInterceptor', () => {
  it('gives an API key the access of its owner', async () => {
    const request = { header: (name: string) => (name === 'apiKey' ? 'owner-key' : undefined), params: {}, query: {} };
    const guard = new ApiGuard(prisma as never);
    expect(await guard.canActivate({ switchToHttp: () => ({ getRequest: () => request }) } as never)).toBe(true);
    expect((request as { user?: unknown }).user).toBe(owner);

    expect(await (await run(Routes.prototype.read, { ...request, user: owner, params: { id: MINE } })).answer).toBe(
      'done'
    );
    await expect(
      (await run(Routes.prototype.read, { ...request, user: owner, params: { id: THEIRS } })).answer
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses an autotest a project without access before anything is made', async () => {
    const { answer, handle } = await run(Routes.prototype.start, {
      user: owner,
      params: {},
      query: {},
      body: { project: THEIRS },
    });

    await expect(answer).rejects.toThrow(
      new ForbiddenException('No access to this project: ask an admin of Vision to add you to it')
    );
    expect(handle).not.toHaveBeenCalled();
    // its own project goes on
    const mine = await run(Routes.prototype.start, { user: owner, params: {}, query: {}, body: { project: MINE } });
    expect(await mine.answer).toBe('done');
  });

  it('lets an admin anywhere and leaves a missing row to the route', async () => {
    const admin = { id: 'admin', role: Role.admin };
    expect(await (await run(Routes.prototype.read, { user: admin, params: { id: THEIRS }, query: {} })).answer).toBe(
      'done'
    );
    // nothing found for the value: the route answers its own not found, as before
    expect(
      await (
        await run(Routes.prototype.start, { user: owner, params: {}, query: {}, body: { project: 'No such app' } })
      ).answer
    ).toBe('done');
  });
});
