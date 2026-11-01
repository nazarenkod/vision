import { Injectable, NotFoundException } from '@nestjs/common';
import { TestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { A11yIssuesService } from '../a11y/a11y-issues.service';
import { StaticService } from '../static/static.service';
import { pngSize } from '../ui-tree/ui-tree.service';
import { buildOverview, BuildOverview, deviceKey, OverviewBugInput, OverviewRun } from './build-overview';

// a11y bugs are worked out from report files; the overview asks again on every
// event of the build, so they are kept until a run of the build changes, and a
// minute at most for bugs filed on another build's runs of the same screens
const A11Y_CACHE_MS = 60_000;
// stored screenshots never change, so their sizes are kept; the cap only bounds memory
const SCREEN_CACHE_SIZE = 5_000;

export interface BuildOverviewResponse extends BuildOverview {
  build: {
    id: string;
    number: number | null;
    branchName: string | null;
    ciBuildId: string | null;
    projectId: string;
    projectName: string;
    createdAt: Date;
    updatedAt: Date;
  };
  // when the state shown was last true: the latest change of the build or its runs
  asOf: Date;
}

const RUN_FIELDS = {
  id: true,
  name: true,
  customTags: true,
  status: true,
  device: true,
  os: true,
  browser: true,
  viewport: true,
  featureName: true,
  a11yNewCount: true,
  a11yTotalCount: true,
  a11yReportName: true,
  uiTreeName: true,
  projectId: true,
  decidedById: true,
  diffPercent: true,
  imageName: true,
  updatedAt: true,
} as const;

/** Loads what the build overview (031) needs and hands it to `buildOverview`. No AI here (REQ-031-48). */
@Injectable()
export class BuildOverviewService {
  private a11yCache = new Map<string, { key: string; at: number; bugs: OverviewBugInput[] }>();
  private screenCache = new Map<string, string>();

  constructor(
    private prismaService: PrismaService,
    private a11yIssuesService: A11yIssuesService,
    private staticService: StaticService
  ) {}

  async overview(buildId: string): Promise<BuildOverviewResponse> {
    const build = await this.prismaService.build.findUnique({
      where: { id: buildId },
      include: { project: { select: { name: true } } },
    });
    if (!build) throw new NotFoundException('Build not found');

    const [runs, previousBuild] = await Promise.all([
      this.prismaService.testRun.findMany({ where: { buildId }, select: RUN_FIELDS }),
      build.number === null
        ? null
        : this.prismaService.build.findFirst({
            where: { projectId: build.projectId, branchName: build.branchName, number: { lt: build.number } },
            orderBy: { number: 'desc' },
            select: { id: true, number: true },
          }),
    ]);

    // approvals made before runs kept who decided them name their author through the baseline they made
    const unattributed = runs.filter((run) => run.status === TestStatus.approved && !run.decidedById).map((r) => r.id);
    const [previousRuns, baselines, visualBugs, a11yBugs, screenSizes] = await Promise.all([
      previousBuild
        ? this.prismaService.testRun.findMany({
            where: { buildId: previousBuild.id },
            select: {
              name: true,
              customTags: true,
              status: true,
              device: true,
              os: true,
              browser: true,
              viewport: true,
              diffPercent: true,
            },
          })
        : [],
      unattributed.length
        ? this.prismaService.baseline.findMany({
            where: { testRunId: { in: unattributed }, userId: { not: null } },
            select: { testRunId: true, userId: true },
          })
        : [],
      this.visualBugs(build.projectId, runs),
      this.a11yBugs(buildId, build.createdAt, runs),
      this.screenSizes(runs),
    ]);

    const approvedBy = new Map<string, string>(baselines.map((b): [string, string] => [b.testRunId, b.userId]));
    const userIds = [...new Set([...runs.map((run) => run.decidedById), ...approvedBy.values()].filter(Boolean))];
    const users = userIds.length
      ? await this.prismaService.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const people = new Map(
      users.map((user) => [user.id, [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null])
    );

    const summary = buildOverview({
      build: { isRunning: build.isRunning },
      runs: runs as OverviewRun[],
      previous: previousBuild ? { number: previousBuild.number, runs: previousRuns } : null,
      approvedBy,
      people,
      bugs: [...visualBugs, ...a11yBugs],
      screenSizes,
    });
    const asOf = runs.reduce((latest, run) => (run.updatedAt > latest ? run.updatedAt : latest), build.updatedAt);
    return {
      ...summary,
      build: {
        id: build.id,
        number: build.number,
        branchName: build.branchName,
        ciBuildId: build.ciBuildId,
        projectId: build.projectId,
        projectName: build.project.name,
        createdAt: build.createdAt,
        updatedAt: build.updatedAt,
      },
      asOf,
    };
  }

  /**
   * Bugs from the comparison on this build's checks: filed from its runs (new),
   * or earlier on the same check (known, shown on every run of it, 025).
   */
  private async visualBugs(
    projectId: string,
    runs: Array<{ id: string; name: string; customTags: string | null; device: string | null }>
  ): Promise<OverviewBugInput[]> {
    if (!runs.length) return [];
    const bugs = await this.prismaService.visualBug.findMany({
      where: { projectId, checkName: { in: [...new Set(runs.map((run) => run.name))] } },
      select: {
        jiraKey: true,
        jiraUrl: true,
        summary: true,
        testRunId: true,
        checkName: true,
        customTags: true,
        device: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const runIds = new Set(runs.map((run) => run.id));
    const seen = new Set<string>();
    const result: OverviewBugInput[] = [];
    for (const bug of bugs) {
      if (seen.has(bug.jiraKey)) continue;
      const own = runIds.has(bug.testRunId);
      const sameCheck = runs.filter((run) => run.name === bug.checkName && (run.customTags ?? '') === bug.customTags);
      const run = own
        ? { id: bug.testRunId }
        : (sameCheck.find((candidate) => candidate.device === bug.device) ?? sameCheck[0]);
      if (!run) continue;
      seen.add(bug.jiraKey);
      result.push({
        kind: 'visual',
        jiraKey: bug.jiraKey,
        jiraUrl: bug.jiraUrl,
        summary: bug.summary,
        testRunId: run.id,
        isNew: own,
      });
    }
    return result;
  }

  /**
   * The screenshot size of each device profile, read from one screenshot of it:
   * the PNG header is enough, and one file per device keeps the overview cheap.
   * A missing or unreadable file leaves the size out.
   */
  private async screenSizes(
    runs: Array<Pick<OverviewRun, 'id' | 'device' | 'os' | 'browser' | 'viewport'> & { imageName: string }>
  ): Promise<Map<string, string>> {
    const sample = new Map<string, { id: string; imageName: string }>();
    for (const run of runs) if (run.imageName && !sample.has(deviceKey(run))) sample.set(deviceKey(run), run);
    const sizes = new Map<string, string>();
    await Promise.all(
      [...sample.values()].map(async ({ id, imageName }) => {
        let size = this.screenCache.get(imageName);
        if (size === undefined) {
          const buffer = await this.staticService.getImageBuffer(imageName).catch((): null => null);
          if (!buffer || buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return;
          const { width, height } = pngSize(buffer);
          size = `${width}×${height}`;
          if (this.screenCache.size >= SCREEN_CACHE_SIZE) this.screenCache.clear();
          this.screenCache.set(imageName, size);
        }
        sizes.set(id, size);
      })
    );
    return sizes;
  }

  private async a11yBugs(
    buildId: string,
    buildCreatedAt: Date,
    runs: Array<Parameters<A11yIssuesService['jiraBugsOn']>[0][number] & { updatedAt: Date }>
  ): Promise<OverviewBugInput[]> {
    const key = `${runs.length}:${Math.max(0, ...runs.map((run) => run.updatedAt.getTime()))}`;
    const cached = this.a11yCache.get(buildId);
    if (cached && cached.key === key && Date.now() - cached.at < A11Y_CACHE_MS) return cached.bugs;

    const found = await this.a11yIssuesService.jiraBugsOn(runs);
    const filed = found.length
      ? await this.prismaService.a11yProblem.findMany({
          where: { projectId: runs[0].projectId, code: { in: found.map((bug) => bug.problemCode) } },
          select: { code: true, createdAt: true },
        })
      : [];
    const filedAt = new Map(filed.map((problem) => [problem.code, problem.createdAt]));
    const bugs = found.map((bug): OverviewBugInput => ({
      kind: 'a11y',
      jiraKey: bug.jiraKey,
      jiraUrl: bug.jiraUrl,
      summary: bug.title,
      testRunId: bug.testRunId,
      isNew: (filedAt.get(bug.problemCode) ?? new Date(0)) >= buildCreatedAt,
    }));
    this.a11yCache.set(buildId, { key, at: Date.now(), bugs });
    return bugs;
  }
}
