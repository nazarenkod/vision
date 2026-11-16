import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UiTreeService } from '../ui-tree/ui-tree.service';
import { computeInsights, Insights, VariationRow } from './insights';
import { applyNorms } from '../a11y/a11y-norms';
import { parseUiTreeSettings } from '../ui-tree/comparison-inputs';

const DAY = 24 * 60 * 60 * 1000;
// runs of the window read at most; enough for months of a busy project
const MAX_RUNS = 200_000;
// accessibility reports read for the rule ranking: the newest one of each check
const MAX_REPORTS = 300;

@Injectable()
export class AnalyticsService {
  constructor(
    private prismaService: PrismaService,
    private uiTreeService: UiTreeService
  ) {}

  async projectInsights(projectId: string, days: number, now = new Date()): Promise<Insights> {
    const project = await this.prismaService.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const windowStart = new Date(now.getTime() - days * DAY);

    const [oldestBuild, variations, runs, baselineRows, a11yStates, reportRows] = await Promise.all([
      this.prismaService.build.aggregate({ where: { projectId }, _min: { createdAt: true } }),
      // one pass over runs and baselines each, grouped, rather than a lookup per variation
      this.prismaService.$queryRaw<VariationRow[]>`
        WITH r AS (
          SELECT "testVariationId" AS id, max("createdAt") AS at
          FROM "TestRun" WHERE "projectId" = ${projectId} AND "testVariationId" IS NOT NULL
          GROUP BY 1
        ), b AS (
          SELECT bl."testVariationId" AS id, max(bl."createdAt") AS at
          FROM "Baseline" bl JOIN "TestVariation" tv ON tv.id = bl."testVariationId"
          WHERE tv."projectId" = ${projectId}
          GROUP BY 1
        )
        SELECT v.id, v.name, v."customTags", v."branchName", v.os, v.device, v.browser, v.viewport,
               v."baselineName", v."createdAt", v."updatedAt", r.at AS "lastRunAt", b.at AS "lastBaselineAt"
        FROM "TestVariation" v
        LEFT JOIN r ON r.id = v.id
        LEFT JOIN b ON b.id = v.id
        WHERE v."projectId" = ${projectId}`,
      this.prismaService.testRun.findMany({
        where: { projectId, createdAt: { gte: windowStart } },
        select: {
          testVariationId: true,
          name: true,
          customTags: true,
          os: true,
          device: true,
          browser: true,
          viewport: true,
          status: true,
          diffPercent: true,
          baselineName: true,
          createdAt: true,
          updatedAt: true,
          a11yNewCount: true,
          a11yTotalCount: true,
          semanticChangeCount: true,
        },
        orderBy: { createdAt: 'asc' },
        take: MAX_RUNS,
      }),
      this.prismaService.$queryRaw<Array<{ id: string; count: number }>>`
        SELECT bl."testVariationId" AS id, count(*)::int AS count
        FROM "Baseline" bl JOIN "TestVariation" tv ON tv.id = bl."testVariationId"
        WHERE tv."projectId" = ${projectId} AND bl."createdAt" >= ${windowStart}
        GROUP BY 1`,
      this.prismaService.a11yIssueState.findMany({
        where: { projectId },
        select: { screenName: true, status: true },
      }),
      this.prismaService.$queryRaw<Array<{ name: string; a11yReportName: string }>>`
        SELECT DISTINCT ON (name, "customTags") name, "a11yReportName"
        FROM "TestRun"
        WHERE "projectId" = ${projectId} AND "createdAt" >= ${windowStart} AND "a11yReportName" IS NOT NULL
        ORDER BY name, "customTags", "createdAt" DESC
        LIMIT ${MAX_REPORTS}`,
    ]);

    const a11yRules: Record<string, number> = {};
    // by the project's current norms, as in the review (026)
    const { a11yNorms } = parseUiTreeSettings(project.uiTreeSettings);
    for (const row of reportRows) {
      const report = await this.uiTreeService.loadReport(row.a11yReportName).catch(() => null);
      for (const violation of report ? applyNorms(report, a11yNorms).violations : []) {
        a11yRules[violation.title] = (a11yRules[violation.title] ?? 0) + 1;
      }
    }

    return computeInsights({
      now,
      days,
      mainBranchName: project.mainBranchName,
      oldestBuildAt: oldestBuild._min.createdAt,
      variations,
      runs,
      baselineChanges: Object.fromEntries(baselineRows.map((row) => [row.id, row.count])),
      a11yStates,
      a11yRules,
    });
  }
}
