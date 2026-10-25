import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { A11yIssueState, TestRun } from '@prisma/client';
import { PNG } from 'pngjs';
import { PrismaService } from '../prisma/prisma.service';
import { StaticService } from '../static/static.service';
import { EventsGateway } from '../shared/events/events.gateway';
import { UiTreeService } from '../ui-tree/ui-tree.service';
import { A11yReport, A11yViolation } from './a11y.types';
import { A11yIssueStatus, reviewReport, ReviewedA11yReport } from './a11y-issues';
import { JiraAttachment, JiraClient, JiraError } from './jira.client';
import { bugText, buildBugFields, defaultIssueType, screenTitle } from './jira-bug';
import { Rect } from '../ui-tree/ui-tree.types';

// Severity of every accessibility bug for now (the team's scale is S1–S5, SC)
const BUG_SEVERITY = 'S4';
const BUG_LABELS = ['accessibility', 'vision'];

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

  private async jiraFor(
    projectId: string
  ): Promise<{ jira: JiraClient; issueType: string | null; linkType: string | null }> {
    const project = await this.prismaService.project.findUnique({ where: { id: projectId } });
    if (!project?.jiraUrl || !project?.jiraToken) {
      throw new BadRequestException('Jira is not set up for this project: add its URL and token in project settings');
    }
    return {
      jira: new JiraClient({ url: project.jiraUrl, token: project.jiraToken, email: project.jiraEmail }),
      issueType: project.jiraIssueType,
      linkType: project.jiraLinkType,
    };
  }

  /** Records a Jira issue that already exists for this problem. */
  async link(testRunId: string, violationId: string, jiraKey: string, userId?: string) {
    const testRun = await this.loadRun(testRunId);
    await this.findViolation(testRun, violationId);
    const key = jiraKey.trim().toUpperCase();
    let url: string | null = null;
    try {
      const { jira } = await this.jiraFor(testRun.projectId);
      url = jira.browseUrl((await jira.getIssue(key)).key);
    } catch (error) {
      if (error instanceof JiraError) throw new BadRequestException(error.message);
      // no Jira set up: keep the key as typed
    }
    return this.saveState(testRun, violationId, 'reported', { jiraKey: key, jiraUrl: url, comment: null }, userId);
  }

  private async bugContext(testRun: TestRun, violation: A11yViolation) {
    const device = [testRun.device, testRun.os, testRun.viewport, testRun.browser].filter(Boolean).join(' · ');
    const url = `${process.env.APP_FRONTEND_URL}/${testRun.projectId}?buildId=${testRun.buildId}&testId=${testRun.id}`;
    const tree = await this.uiTreeService.load(testRun.uiTreeName).catch(() => null);
    return bugText({ violation, testName: testRun.name, title: screenTitle(tree), device, url });
  }

  private async jiraCall<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof JiraError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  /** People in the project's Jira matching a name, for user fields of a bug. */
  async findJiraUsers(testRunId: string, query: string) {
    const testRun = await this.loadRun(testRunId);
    const { jira } = await this.jiraFor(testRun.projectId);
    return this.jiraCall(() => jira.findUsers(query));
  }

  /**
   * What filing a bug under this task would do: the issue types and link
   * types to choose from (read from Jira for the task's project), which one
   * is offered first, and the fields Vision fills in or cannot fill.
   */
  async prepareBug(
    testRunId: string,
    violationId: string,
    parentKey: string,
    issueTypeId?: string,
    fieldValues?: Record<string, unknown>
  ) {
    const testRun = await this.loadRun(testRunId);
    const violation = await this.findViolation(testRun, violationId);
    const { jira, issueType: configuredType, linkType: configuredLink } = await this.jiraFor(testRun.projectId);
    return this.jiraCall(async () => {
      const parent = await jira.getIssue(parentKey.trim().toUpperCase());
      const [issueTypes, linkTypes] = await Promise.all([
        jira.issueTypes(parent.projectKey),
        jira.linkTypes().catch(() => []),
      ]);
      const chosen =
        (issueTypeId && issueTypes.find((type) => type.id === issueTypeId)) ||
        defaultIssueType(issueTypes, configuredType);
      if (!chosen) throw new BadRequestException(`Project ${parent.projectKey} offers no issue type to create`);
      const text = await this.bugContext(testRun, violation);
      const meta = await jira.createFields(parent.projectKey, chosen.id);
      const bug = buildBugFields({
        meta,
        parent,
        issueType: chosen,
        summary: text.summary,
        description: text.description,
        labels: BUG_LABELS,
        severity: BUG_SEVERITY,
        overrides: fieldValues,
      });
      const defaultLink =
        linkTypes.find((type) => configuredLink && type.name.toLowerCase() === configuredLink.toLowerCase()) ??
        linkTypes.find((type) => /relat|связ|пов.яз/i.test(type.name)) ??
        linkTypes[0];
      return {
        parent: {
          key: parent.key,
          summary: parent.summary,
          projectKey: parent.projectKey,
          assignee: parent.assignee?.displayName ?? null,
        },
        issueTypes,
        issueTypeId: chosen.id,
        linkTypes: linkTypes.map((type) => type.name),
        linkType: defaultLink?.name ?? null,
        summary: text.summary,
        block: text.block,
        screen: text.screen,
        filled: bug.filled,
        inputs: bug.inputs,
        missing: bug.missing,
      };
    });
  }

  /**
   * Files a bug for the issue in Jira under the given task: as its sub-task
   * when the issue type is one, else linked to it. Screen, service, actual
   * and expected result, device and element are filled in, the task's
   * assignee takes it, and the screenshot is attached with the element
   * outlined.
   */
  async fileBug(
    testRunId: string,
    violationId: string,
    options: { parentKey: string; issueTypeId?: string; linkType?: string; fieldValues?: Record<string, unknown> },
    userId?: string
  ) {
    const testRun = await this.loadRun(testRunId);
    const violation = await this.findViolation(testRun, violationId);
    const { jira, issueType: configuredType, linkType: configuredLink } = await this.jiraFor(testRun.projectId);

    let attachment: JiraAttachment | undefined;
    try {
      const image = await this.staticService.getImage(testRun.imageName);
      if (image) {
        attachment = {
          fileName: `${testRun.name.replace(/[^\p{L}\p{N}.-]+/gu, '_').slice(0, 80)}-a11y.png`,
          content: outlineElement(image, violation.bounds),
          contentType: 'image/png',
        };
      }
    } catch (error) {
      this.logger.warn(`Cannot attach screenshot for ${testRun.id}: ${error}`);
    }

    const created = await this.jiraCall(async () => {
      const parent = await jira.getIssue(options.parentKey.trim().toUpperCase());
      const issueTypes = await jira.issueTypes(parent.projectKey);
      const issueType =
        (options.issueTypeId && issueTypes.find((type) => type.id === options.issueTypeId)) ||
        defaultIssueType(issueTypes, configuredType);
      if (!issueType) throw new BadRequestException(`Project ${parent.projectKey} offers no issue type to create`);
      const text = await this.bugContext(testRun, violation);
      const bug = buildBugFields({
        meta: await jira.createFields(parent.projectKey, issueType.id),
        parent,
        issueType,
        summary: text.summary,
        description: text.description,
        labels: BUG_LABELS,
        severity: BUG_SEVERITY,
        overrides: options.fieldValues,
      });
      if (bug.missing.length) {
        throw new BadRequestException(
          `Jira requires fields that are still empty for "${issueType.name}": ${bug.missing.join(', ')}.`
        );
      }
      const issue = await jira.createIssue(bug.fields);
      const warnings: string[] = [];
      if (!issueType.subtask) {
        const linkType = options.linkType || configuredLink || 'Relates';
        await jira.link(linkType, issue.key, parent.key).catch((error) => {
          warnings.push(`Not linked to ${parent.key}: ${error.message}`);
        });
      }
      if (bug.assignAfter) {
        await jira.assign(issue.key, bug.assignAfter).catch((error) => {
          warnings.push(`Not assigned: ${error.message}`);
        });
      }
      if (attachment) {
        await jira.attach(issue.key, attachment).catch((error) => {
          warnings.push(`Screenshot not attached: ${error.message}`);
        });
      }
      return { ...issue, warnings };
    });

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
