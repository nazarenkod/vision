import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { A11yIssueState, TestRun } from '@prisma/client';
import { PNG } from 'pngjs';
import { PrismaService } from '../prisma/prisma.service';
import { StaticService } from '../static/static.service';
import { EventsGateway } from '../shared/events/events.gateway';
import { UiTreeService } from '../ui-tree/ui-tree.service';
import { A11yReport, A11yViolation } from './a11y.types';
import { A11yIssueStatus, jiraDescription, reviewReport, ReviewedA11yReport } from './a11y-issues';
import { JiraClient, JiraError } from './jira.client';
import { Rect } from '../ui-tree/ui-tree.types';

const OUTLINE = [255, 0, 128];
const OUTLINE_WIDTH = 6;
const OUTLINE_PADDING = 6;

/** The screenshot with the element outlined, for the Jira attachment. */
export function outlineElement(image: PNG, rect: Rect): Buffer {
  const out = new PNG({ width: image.width, height: image.height });
  image.data.copy(out.data);
  const x0 = Math.max(0, rect.x - OUTLINE_PADDING);
  const y0 = Math.max(0, rect.y - OUTLINE_PADDING);
  const x1 = Math.min(image.width - 1, rect.x + rect.width + OUTLINE_PADDING);
  const y1 = Math.min(image.height - 1, rect.y + rect.height + OUTLINE_PADDING);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const onEdge =
        x - x0 < OUTLINE_WIDTH || x1 - x < OUTLINE_WIDTH || y - y0 < OUTLINE_WIDTH || y1 - y < OUTLINE_WIDTH;
      if (onEdge) out.data.set([...OUTLINE, 255], (y * image.width + x) * 4);
    }
  }
  return PNG.sync.write(out);
}

/**
 * Team decisions on accessibility issues — a filed Jira bug or a false
 * positive — and the Jira filing itself. Decisions are kept per project,
 * screen and issue identity, so they carry over to every later build and
 * device, and the counts on affected runs are refreshed when they change.
 */
@Injectable()
export class A11yIssuesService {
  private readonly logger = new Logger(A11yIssuesService.name);

  constructor(
    private prismaService: PrismaService,
    private staticService: StaticService,
    private uiTreeService: UiTreeService,
    private eventsGateway: EventsGateway
  ) {}

  async statesFor(projectId: string, screenName: string): Promise<A11yIssueState[]> {
    return this.prismaService.a11yIssueState.findMany({ where: { projectId, screenName } });
  }

  /** Counts to keep on the row: new issues nobody has acted on, and all counted issues. */
  async countsFor(testRun: Pick<TestRun, 'projectId' | 'name'>, report: A11yReport) {
    const reviewed = reviewReport(report, await this.statesFor(testRun.projectId, testRun.name));
    return { newCount: reviewed.summary.new, totalCount: reviewed.summary.total };
  }

  private async loadRun(testRunId: string): Promise<TestRun> {
    const testRun = await this.prismaService.testRun.findUnique({ where: { id: testRunId } });
    if (!testRun) throw new NotFoundException('Test run not found');
    return testRun;
  }

  async getReviewedReport(testRunId: string): Promise<ReviewedA11yReport | null> {
    const testRun = await this.loadRun(testRunId);
    const report = await this.uiTreeService.loadReport(testRun.a11yReportName);
    return report ? reviewReport(report, await this.statesFor(testRun.projectId, testRun.name)) : null;
  }

  private async findViolation(testRun: TestRun, violationId: string): Promise<A11yViolation> {
    const report = await this.uiTreeService.loadReport(testRun.a11yReportName);
    const violation = report?.violations.find((v) => v.id === violationId);
    if (!violation) throw new BadRequestException('This accessibility issue is not on this test run');
    return violation;
  }

  /** Refreshes the counts of every run of this screen in the build after a decision changed. */
  private async refreshCounts(testRun: TestRun): Promise<void> {
    const runs = await this.prismaService.testRun.findMany({
      where: { buildId: testRun.buildId, name: testRun.name, a11yReportName: { not: null } },
    });
    const states = await this.statesFor(testRun.projectId, testRun.name);
    for (const run of runs) {
      const report = await this.uiTreeService.loadReport(run.a11yReportName);
      if (!report) continue;
      const { summary } = reviewReport(report, states);
      if (summary.new === run.a11yNewCount && summary.total === run.a11yTotalCount) continue;
      const updated = await this.prismaService.testRun.update({
        where: { id: run.id },
        data: { a11yNewCount: summary.new, a11yTotalCount: summary.total },
      });
      this.eventsGateway.testRunUpdated(updated);
    }
  }

  private async saveState(
    testRun: TestRun,
    violationId: string,
    status: A11yIssueStatus,
    data: { jiraKey?: string | null; jiraUrl?: string | null; comment?: string | null },
    userId?: string
  ): Promise<A11yIssueState> {
    const where = {
      projectId_screenName_violationId: { projectId: testRun.projectId, screenName: testRun.name, violationId },
    };
    const state = await this.prismaService.a11yIssueState.upsert({
      where,
      create: { projectId: testRun.projectId, screenName: testRun.name, violationId, status, userId, ...data },
      update: { status, userId, ...data },
    });
    await this.refreshCounts(testRun);
    return state;
  }

  /** Marks an issue as a false positive: it stays listed but stops counting and failing builds. */
  async ignore(testRunId: string, violationId: string, comment: string | undefined, userId?: string) {
    const testRun = await this.loadRun(testRunId);
    await this.findViolation(testRun, violationId);
    return this.saveState(
      testRun,
      violationId,
      'ignored',
      { comment: comment ?? null, jiraKey: null, jiraUrl: null },
      userId
    );
  }

  /** Forgets the decision on an issue (undo of ignore or of a link). */
  async reset(testRunId: string, violationId: string): Promise<void> {
    const testRun = await this.loadRun(testRunId);
    await this.prismaService.a11yIssueState.deleteMany({
      where: { projectId: testRun.projectId, screenName: testRun.name, violationId },
    });
    await this.refreshCounts(testRun);
  }

  private async jiraFor(projectId: string): Promise<JiraClient> {
    const project = await this.prismaService.project.findUnique({ where: { id: projectId } });
    if (!project?.jiraUrl || !project?.jiraToken) {
      throw new BadRequestException('Jira is not set up for this project: add its URL and token in project settings');
    }
    return new JiraClient({
      url: project.jiraUrl,
      token: project.jiraToken,
      email: project.jiraEmail,
      issueType: project.jiraIssueType,
      linkType: project.jiraLinkType,
    });
  }

  /** Records a Jira issue that already exists for this problem. */
  async link(testRunId: string, violationId: string, jiraKey: string, userId?: string) {
    const testRun = await this.loadRun(testRunId);
    await this.findViolation(testRun, violationId);
    const key = jiraKey.trim().toUpperCase();
    let url: string | null = null;
    try {
      const jira = await this.jiraFor(testRun.projectId);
      url = jira.browseUrl((await jira.getIssue(key)).key);
    } catch (error) {
      if (error instanceof JiraError) throw new BadRequestException(error.message);
      // no Jira set up: keep the key as typed
    }
    return this.saveState(testRun, violationId, 'reported', { jiraKey: key, jiraUrl: url, comment: null }, userId);
  }

  /**
   * Files a bug for the issue in Jira, linked to the given task, with the
   * screen, device, element and rule filled in and the screenshot attached
   * with the element outlined.
   */
  async fileBug(testRunId: string, violationId: string, parentKey: string, userId?: string) {
    const testRun = await this.loadRun(testRunId);
    const violation = await this.findViolation(testRun, violationId);
    const jira = await this.jiraFor(testRun.projectId);

    const device = [testRun.device, testRun.os, testRun.viewport, testRun.browser].filter(Boolean).join(' · ');
    const url = `${process.env.APP_FRONTEND_URL}/${testRun.projectId}?buildId=${testRun.buildId}&testId=${testRun.id}`;
    let attachment: { fileName: string; content: Buffer; contentType: string } | undefined;
    try {
      const image = await this.staticService.getImage(testRun.imageName);
      if (image) {
        attachment = {
          fileName: `${testRun.name.replace(/[^\w.-]+/g, '_')}-a11y.png`,
          content: outlineElement(image, violation.bounds),
          contentType: 'image/png',
        };
      }
    } catch (error) {
      this.logger.warn(`Cannot attach screenshot for ${testRun.id}: ${error}`);
    }

    let created: { key: string; url: string; warnings: string[] };
    try {
      created = await jira.createLinkedIssue(parentKey.trim().toUpperCase(), {
        summary:
          `[A11y] ${violation.title}: ${violation.label || violation.resourceId || violation.className} on "${testRun.name}"`.slice(
            0,
            250
          ),
        description: jiraDescription({ violation, screenName: testRun.name, device, url }),
        labels: ['accessibility', 'vrt'],
        attachment,
      });
    } catch (error) {
      if (error instanceof JiraError) throw new BadRequestException(error.message);
      throw error;
    }

    const state = await this.saveState(
      testRun,
      violationId,
      'reported',
      { jiraKey: created.key, jiraUrl: created.url, comment: null },
      userId
    );
    return { ...state, warnings: created.warnings };
  }
}
