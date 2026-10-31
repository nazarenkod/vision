import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { BuildOverviewService } from '../builds/build-overview.service';

const now = new Date();
const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);

const setup = (over: { link?: object | null; build?: object | null } = {}) => {
  const prisma = {
    build: {
      findUnique: jest.fn().mockResolvedValue(over.build === undefined ? { id: 'b', projectId: 'p' } : over.build),
    },
    reportLink: {
      create: jest.fn(({ data }) => Promise.resolve({ id: 'l1', createdAt: now, revokedAt: null, ...data })),
      findUnique: jest.fn().mockResolvedValue(
        over.link === undefined
          ? {
              id: 'l1',
              token: 't',
              buildId: 'b',
              sections: '["sum","chg"]',
              language: 'uk',
              createdById: 'anna',
              expiresAt: later,
              revokedAt: null,
            }
          : over.link
      ),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    testRun: { findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ firstName: 'Anna', lastName: 'Petrenko' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'anna', firstName: 'Anna', lastName: 'Petrenko' }]),
    },
  };
  const overview = {
    overview: jest.fn().mockResolvedValue({
      verdict: 'waiting',
      counts: {},
      progress: { decided: 0, needed: 0, people: [] },
      devices: [],
      features: [],
      quietFeatures: { count: 0, screens: 0 },
      bugs: [],
      previous: null,
      build: {
        id: 'b',
        number: 1,
        branchName: 'main',
        ciBuildId: null,
        projectId: 'p',
        projectName: 'Shop',
        createdAt: now,
        updatedAt: now,
      },
      asOf: now,
    }),
  };
  const service = new ReportsService(prisma as unknown as PrismaService, overview as unknown as BuildOverviewService);
  const res = { setHeader: jest.fn(), status: jest.fn(), type: jest.fn(), send: jest.fn(), end: jest.fn() };
  res.status.mockReturnValue(res);
  res.type.mockReturnValue(res);
  return { controller: new ReportsController(service), prisma, res };
};

const sent = (res: { send: jest.Mock }) => JSON.parse(res.send.mock.calls[0][0]);

describe('ReportsController', () => {
  it('creates a link with the chosen sections and language', async () => {
    const { controller, prisma } = setup();
    const link = await controller.create({ id: 'anna' } as never, 'b', {
      sections: ['chg', 'sum', 'nonsense'],
      language: 'uk',
      days: 7,
    });
    const data = prisma.reportLink.create.mock.calls[0][0].data;
    expect(JSON.parse(data.sections)).toEqual(['sum', 'chg']);
    expect(data.language).toBe('uk');
    expect(data.createdById).toBe('anna');
    expect(link.createdBy).toBe('Anna Petrenko');
  });

  it('lets editors and admins create links, not guests', () => {
    const roles = Reflect.getMetadata('roles', ReportsController.prototype.create);
    expect(roles).toEqual([Role.admin, Role.editor]);
    expect(Reflect.getMetadata(GUARDS_METADATA, ReportsController.prototype.create)).toHaveLength(2);
  });

  it('serves a report without signing in and nothing else', async () => {
    for (const handler of ['create', 'list', 'revoke', 'report'] as const) {
      expect(Reflect.getMetadata(GUARDS_METADATA, ReportsController.prototype[handler])).toBeDefined();
    }
    expect(Reflect.getMetadata(GUARDS_METADATA, ReportsController.prototype.publicReport)).toBeUndefined();

    const { controller, res } = setup();
    await controller.publicReport('t', undefined, res as never);
    const report = sent(res);
    expect(report.state).toBe('ok');
    expect(report.language).toBe('uk');
    expect(report.createdBy).toBe('Anna Petrenko');

    // the page asks again: unchanged costs a 304
    const etag = res.setHeader.mock.calls.find(([name]) => name === 'ETag')[1];
    const again = setup();
    await again.controller.publicReport('t', etag, again.res as never);
    expect(again.res.status).toHaveBeenCalledWith(304);
  });

  it('says the build is gone when it was deleted', async () => {
    const { controller, res } = setup({ build: null });
    await controller.publicReport('t', undefined, res as never);
    expect(sent(res)).toEqual({ state: 'gone' });
  });

  it('says a link is expired and shows nothing of the build', async () => {
    const { controller, res } = setup({ link: { buildId: 'b', expiresAt: now, revokedAt: null } });
    await controller.publicReport('t', undefined, res as never);
    expect(sent(res)).toEqual({ state: 'expired' });
  });

  it('lets the author or an admin revoke a link', async () => {
    const author = setup();
    await author.controller.revoke({ id: 'anna', role: Role.editor } as never, 'l1');
    expect(author.prisma.reportLink.update).toHaveBeenCalled();

    const admin = setup();
    await admin.controller.revoke({ id: 'oleh', role: Role.admin } as never, 'l1');
    expect(admin.prisma.reportLink.update).toHaveBeenCalled();

    const other = setup();
    await expect(other.controller.revoke({ id: 'oleh', role: Role.editor } as never, 'l1')).rejects.toThrow(
      ForbiddenException
    );
    expect(other.prisma.reportLink.update).not.toHaveBeenCalled();
  });
});
