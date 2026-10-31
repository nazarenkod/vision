import { TestStatus } from '@prisma/client';
import { BuildOverviewService } from './build-overview.service';
import { PrismaService } from '../prisma/prisma.service';
import { A11yIssuesService } from '../a11y/a11y-issues.service';

const at = new Date('2026-10-31T10:42:00Z');
const run = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: 'Checkout. Payment sheet',
  customTags: '',
  status: TestStatus.ok,
  device: 'PIXEL_4_XL',
  os: 'AOS 14',
  browser: '',
  viewport: '',
  featureName: null,
  a11yNewCount: 0,
  a11yTotalCount: 0,
  a11yReportName: null,
  uiTreeName: null,
  projectId: 'project',
  decidedById: null,
  updatedAt: at,
  ...over,
});

const setup = () => {
  const prisma = {
    build: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'b128',
        number: 128,
        branchName: 'release/7.4',
        ciBuildId: 'android-nightly-4821',
        projectId: 'project',
        isRunning: false,
        createdAt: at,
        updatedAt: at,
        project: { name: 'Mobile Shop' },
      }),
      findFirst: jest.fn().mockResolvedValue({ id: 'b127', number: 127 }),
    },
    testRun: {
      findMany: jest.fn(({ where }) =>
        Promise.resolve(
          where.buildId === 'b128'
            ? [
                run('a', { name: 'Checkout. Pay', status: TestStatus.unresolved }),
                run('b', {
                  name: 'Login. Error',
                  status: TestStatus.failed,
                  decidedById: 'anna',
                  updatedAt: new Date('2026-10-31T11:05:00Z'),
                }),
                run('c', { name: 'Profile. Avatar', status: TestStatus.approved }),
              ]
            : [run('x', { name: 'Checkout. Pay' }), run('y', { name: 'Login. Error', device: 'iPhone 15' })]
        )
      ),
    },
    baseline: { findMany: jest.fn().mockResolvedValue([{ testRunId: 'c', userId: 'oleh' }]) },
    visualBug: {
      findMany: jest.fn().mockResolvedValue([
        {
          jiraKey: 'P24MOB-14231',
          jiraUrl: null,
          summary: 'Error text wraps',
          testRunId: 'b',
          checkName: 'Login. Error',
          customTags: '',
          device: 'PIXEL_4_XL',
        },
      ]),
    },
    a11yProblem: { findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'anna', firstName: 'Anna', lastName: 'Petrenko' },
        { id: 'oleh', firstName: 'Oleh', lastName: 'Koval' },
      ]),
    },
  };
  const a11y = { jiraBugsOn: jest.fn().mockResolvedValue([]) };
  const service = new BuildOverviewService(prisma as unknown as PrismaService, a11y as unknown as A11yIssuesService);
  return { service, prisma };
};

describe('BuildOverviewService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('builds the overview without calling AI', async () => {
    const fetch = jest.fn();
    global.fetch = fetch;
    const { service, prisma } = setup();

    const overview = await service.overview('b128');

    expect(fetch).not.toHaveBeenCalled();
    expect(overview.verdict).toBe('waiting');
    expect(overview.progress.people).toEqual([
      { name: 'Anna Petrenko', approved: 0, rejected: 1 },
      { name: 'Oleh Koval', approved: 1, rejected: 0 },
    ]);
    expect(overview.bugs).toEqual([expect.objectContaining({ jiraKey: 'P24MOB-14231', isNew: true, testRunId: 'b' })]);
    expect(overview.previous).toEqual({ number: 127, changed: 1, added: 2, gone: 1 });
    expect(overview.asOf).toEqual(new Date('2026-10-31T11:05:00Z'));
    expect(overview.build.projectName).toBe('Mobile Shop');
    // names only: no email, no keys
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true, firstName: true, lastName: true } })
    );
  });
});
