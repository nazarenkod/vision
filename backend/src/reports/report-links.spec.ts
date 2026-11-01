import { TestStatus } from '@prisma/client';
import { linkState, MAX_CHANGES, newToken, publicReport, ReportRun, sectionsOf } from './report-links';
import { BuildOverviewResponse } from '../builds/build-overview.service';

const now = new Date('2026-10-31T11:05:00Z');

const overview = (): BuildOverviewResponse => ({
  verdict: 'waiting',
  counts: { total: 3, changed: 1, new: 0, rejected: 1, passed: 1, waiting: 1, a11yNew: 2, bugs: 1 },
  progress: { decided: 1, needed: 2, people: [{ name: 'Anna Petrenko', approved: 0, rejected: 1 }] },
  devices: [
    {
      device: 'PIXEL_4_XL',
      os: 'AOS 14',
      browser: '',
      viewport: '',
      a11yNew: 2,
      total: 3,
      changed: 1,
      new: 0,
      rejected: 1,
      passed: 1,
    },
  ],
  features: [{ name: 'Checkout', total: 3, changed: 1, new: 0, rejected: 1, passed: 1, bugs: 1 }],
  quietFeatures: { count: 0, screens: 0 },
  bugs: [
    {
      kind: 'visual',
      jiraKey: 'P24MOB-1',
      jiraUrl: 'https://jira/P24MOB-1',
      summary: 'Moved',
      testRunId: 'a',
      isNew: true,
    },
  ],
  previous: null,
  build: {
    id: 'b',
    number: 128,
    branchName: 'release/7.4',
    ciBuildId: 'ci-1',
    projectId: 'p',
    projectName: 'Mobile Shop',
    createdAt: now,
    updatedAt: now,
  },
  asOf: now,
});

const run = (id: string, over: Partial<ReportRun> = {}): ReportRun => ({
  id,
  name: `Screen ${id}`,
  device: 'PIXEL_4_XL',
  os: 'AOS 14',
  status: TestStatus.unresolved,
  diffPercent: 1,
  imageName: `${id}.png`,
  baselineName: `${id}-base.png`,
  diffName: `${id}-diff.png`,
  a11yNewCount: 0,
  ...over,
});

const link = {
  sections: sectionsOf(['sum', 'chg', 'bugs', 'dev', 'feat', 'a11y']),
  language: 'en' as const,
  createdBy: 'Anna Petrenko',
};

describe('report links', () => {
  it('opens for as long as the build is kept and closes when revoked', () => {
    expect(linkState({ revokedAt: null })).toBe('ok');
    expect(linkState({ revokedAt: now })).toBe('expired');
  });

  it('makes a 256-bit token unrelated to the build', () => {
    const token = newToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(newToken()).not.toBe(token);
    expect(token).not.toContain('128');
  });

  it('lists up to 20 changes and counts the rest', () => {
    const runs = [
      ...Array.from({ length: 23 }, (_, i) => run(`c${i}`, { diffPercent: i })),
      run('rejected', { status: TestStatus.failed, diffPercent: 99 }),
      run('fresh', { status: TestStatus.new, baselineName: null }),
      run('ok', { status: TestStatus.ok }),
    ];
    const report = publicReport(overview(), runs, link);
    expect(report.changes).toHaveLength(MAX_CHANGES);
    // waiting first, the biggest difference first
    expect(report.changes[0].testRunId).toBe('c22');
    expect(report.moreChanges).toBe(4);
  });

  it('keeps emails, keys and tokens out of a public report', () => {
    const leaky = overview() as BuildOverviewResponse & Record<string, unknown>;
    leaky.progress.people[0] = { ...leaky.progress.people[0], email: 'anna@shop.app' } as never;
    (leaky.build as Record<string, unknown>).apiKey = 'secret-key';
    (leaky as Record<string, unknown>).jiraToken = 'jira-secret';
    const body = JSON.stringify(publicReport(leaky, [run('a', { a11yNewCount: 2 })], link));
    expect(body).not.toMatch(/email|apiKey|jiraToken|secret|password/i);
    expect(body).toContain('Anna Petrenko');
  });

  it('leaves out the sections the link does not carry', () => {
    const report = publicReport(overview(), [run('a', { a11yNewCount: 2 })], {
      ...link,
      sections: sectionsOf(['sum']),
    });
    expect(report.changes).toEqual([]);
    expect(report.overview.bugs).toEqual([]);
    expect(report.a11y).toEqual([]);
  });
});
