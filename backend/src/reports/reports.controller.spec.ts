import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { BuildOverviewService } from '../builds/build-overview.service';
import { readFileSignature, serverFileLinkKey } from '../static/file-links';

const now = new Date();

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
      quietFeatures: { count: 0, screens: 0, features: [] },
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

  it("signs the report's own screens while its link is valid", async () => {
    const { controller, prisma, res } = setup();
    prisma.testRun.findMany.mockResolvedValue([
      {
        id: 'r1',
        name: 'Payment',
        device: null,
        os: null,
        status: 'unresolved',
        diffPercent: 3,
        imageName: 'new.png',
        baselineName: 'base.png',
        diffName: 'diff.png',
        a11yNewCount: 0,
      },
    ]);
    await controller.publicReport('t', undefined, res as never);

    const signatures = sent(res).changes[0].fileSignatures;
    const key = serverFileLinkKey();
    expect(Object.keys(signatures).sort()).toEqual(['base.png', 'diff.png', 'new.png']);
    for (const [name, signature] of Object.entries<string>(signatures)) {
      // the report's signature, tied to its token: it opens the file only while the link lives
      expect(readFileSignature(name, signature, key)).toEqual({ kind: 'report', token: 't' });
    }
  });

  it('says the build is gone when it was deleted', async () => {
    const { controller, res } = setup({ build: null });
    await controller.publicReport('t', undefined, res as never);
    expect(sent(res)).toEqual({ state: 'gone' });
  });

  it('says a revoked link is closed and shows nothing of the build', async () => {
    const { controller, res } = setup({ link: { buildId: 'b', revokedAt: now } });
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
