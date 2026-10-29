import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TestRun } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StaticService } from '../static/static.service';
import { jiraAccess } from '../a11y/jira-access';
import { JiraAttachment, JiraClient, JiraError, JiraIssueType } from '../a11y/jira.client';
import { buildBugFields, defaultIssueType } from '../a11y/jira-bug';
import {
  BASELINE_FILE,
  BugMark,
  CHECKPOINT_FILE,
  VISUAL_BUG_LABELS,
  bugDescription,
  bugSummary,
  environmentText,
  featureOf,
  normalizeMarks,
} from './visual-bug';
import { markImage } from './mark-image';

export interface PrepareVisualBug {
  parentKey: string;
  issueTypeId?: string;
  fieldValues?: Record<string, unknown>;
}

export interface FileVisualBug extends PrepareVisualBug {
  linkType?: string;
  essence: string;
  // Vision writes it when empty
  environment?: string;
  steps: string;
  actual: string;
  expected: string;
  marks?: Array<Partial<BugMark>>;
}

export interface VisualBugView {
  id: string;
  jiraKey: string;
  jiraUrl: string | null;
  summary: string;
  marks: BugMark[];
  // marks are in the pixels of the device the bug was filed from
  sameDevice: boolean;
  testRunId: string;
  createdAt: Date;
}

/** The device profile marks belong to: their pixels mean nothing on another one. */
const profileOf = (run: Pick<TestRun, 'os' | 'device' | 'browser' | 'viewport'>) =>
  [run.os, run.device, run.browser, run.viewport].filter(Boolean).join(' · ');

const parseMarks = (text: string | null): BugMark[] => {
  try {
    return normalizeMarks(JSON.parse(text ?? '[]'));
  } catch {
    return [];
  }
};

/**
 * Bugs filed from the comparison (025): the same Jira path as accessibility
 * bugs (task, issue type, fields, the person's token), with the team's
 * description sections, the marked checkpoint and the baseline attached.
 */
@Injectable()
export class VisualBugsService {
  private readonly logger = new Logger(VisualBugsService.name);

  constructor(
    private prismaService: PrismaService,
    private staticService: StaticService
  ) {}

  private async loadRun(testRunId: string): Promise<TestRun> {
    const run = await this.prismaService.testRun.findUnique({ where: { id: testRunId } });
    if (!run) throw new NotFoundException('Test run not found');
    return run;
  }

  private async jiraCall<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof JiraError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private async issueType(jira: JiraClient, projectKey: string, wanted?: string, configured?: string | null) {
    const types = await jira.issueTypes(projectKey);
    const chosen: JiraIssueType | null =
      (wanted && types.find((type) => type.id === wanted)) || defaultIssueType(types, configured);
    if (!chosen) throw new BadRequestException(`Project ${projectKey} offers no issue type to create`);
    return { types, chosen };
  }

  /** The task, its issue and link types, and what the dialog asks for and fills in. */
  async prepare(testRunId: string, body: PrepareVisualBug, userId?: string) {
    const run = await this.loadRun(testRunId);
    const build = run.buildId ? await this.prismaService.build.findUnique({ where: { id: run.buildId } }) : null;
    const {
      jira,
      issueType: configuredType,
      linkType: configuredLink,
    } = await jiraAccess(this.prismaService, run.projectId, userId);
    return this.jiraCall(async () => {
      const parent = await jira.getIssue(body.parentKey.trim().toUpperCase());
      const [{ types, chosen }, linkTypes] = await Promise.all([
        this.issueType(jira, parent.projectKey, body.issueTypeId, configuredType),
        jira.linkTypes().catch(() => []),
      ]);
      const bug = buildBugFields({
        meta: await jira.createFields(parent.projectKey, chosen.id),
        parent,
        issueType: chosen,
        summary: '',
        description: '',
        labels: VISUAL_BUG_LABELS,
        overrides: body.fieldValues,
      });
      const defaultLink =
        linkTypes.find((type) => configuredLink && type.name.toLowerCase() === configuredLink.toLowerCase()) ??
        linkTypes.find((type) => /relat|связ|пов.яз/i.test(type.name)) ??
        linkTypes[0];
      const feature = featureOf(run);
      return {
        parent: {
          key: parent.key,
          summary: parent.summary,
          projectKey: parent.projectKey,
          assignee: parent.assignee?.displayName ?? null,
        },
        issueTypes: types,
        issueTypeId: chosen.id,
        linkTypes: linkTypes.map((type) => type.name),
        linkType: defaultLink?.name ?? null,
        feature,
        prefix: bugSummary(feature, ''),
        environment: environmentText(run, build),
        hasBaseline: !!run.baselineName,
        inputs: bug.inputs,
        filled: bug.filled,
        missing: bug.missing,
      };
    });
  }

  /** Creates the bug; what fails after it exists comes back as warnings, never undoes it. */
  async file(testRunId: string, body: FileVisualBug, userId?: string) {
    const texts = { essence: body.essence, steps: body.steps, actual: body.actual, expected: body.expected };
    const empty = Object.entries(texts).filter(([, value]) => !value?.trim());
    if (empty.length) throw new BadRequestException(`Fill in: ${empty.map(([key]) => key).join(', ')}`);

    const run = await this.loadRun(testRunId);
    const build = run.buildId ? await this.prismaService.build.findUnique({ where: { id: run.buildId } }) : null;
    const marks = normalizeMarks(body.marks);
    const {
      jira,
      issueType: configuredType,
      linkType: configuredLink,
    } = await jiraAccess(this.prismaService, run.projectId, userId);
    const warnings: string[] = [];
    const attachments = await this.attachmentsFor(run, marks);
    const summary = bugSummary(featureOf(run), body.essence);
    const url = `${process.env.APP_FRONTEND_URL}/${run.projectId}?buildId=${run.buildId}&testId=${run.id}`;

    const created = await this.jiraCall(async () => {
      const parent = await jira.getIssue(body.parentKey.trim().toUpperCase());
      const { chosen } = await this.issueType(jira, parent.projectKey, body.issueTypeId, configuredType);
      const bug = buildBugFields({
        meta: await jira.createFields(parent.projectKey, chosen.id),
        parent,
        issueType: chosen,
        summary,
        description: bugDescription({
          environment: body.environment?.trim() || environmentText(run, build),
          steps: body.steps,
          actual: body.actual,
          expected: body.expected,
          hasBaseline: attachments.some((item) => item.fileName === BASELINE_FILE),
          check: { name: run.name, customTags: run.customTags },
          build,
          url,
        }),
        labels: VISUAL_BUG_LABELS,
        overrides: body.fieldValues,
      });
      const unset = bug.inputs
        .filter((input) => input.required && input.value === undefined)
        .map((input) => input.name);
      const missing = [...new Set([...bug.missing, ...unset])];
      if (missing.length) {
        throw new BadRequestException(
          `Jira requires fields that are still empty for "${chosen.name}": ${missing.join(', ')}.`
        );
      }
      const issue = await jira.createIssue(bug.fields);
      if (!bug.fields.labels) {
        await jira.editLabels(issue.key, { add: VISUAL_BUG_LABELS }).catch((error) => {
          warnings.push(`Label "vision" not set: ${error.message}`);
        });
      }
      if (!chosen.subtask) {
        const linkType = body.linkType || configuredLink || 'Relates';
        await jira.link(linkType, issue.key, parent.key).catch((error) => {
          warnings.push(`Not linked to ${parent.key}: ${error.message}`);
        });
      }
      if (bug.assignAfter) {
        await jira.assign(issue.key, bug.assignAfter).catch((error) => warnings.push(`Not assigned: ${error.message}`));
      }
      for (const attachment of attachments) {
        await jira.attach(issue.key, attachment).catch((error) => {
          warnings.push(`${attachment.fileName} not attached: ${error.message}`);
        });
      }
      return issue;
    });

    await this.prismaService.visualBug.create({
      data: {
        projectId: run.projectId,
        checkName: run.name,
        customTags: run.customTags ?? '',
        testRunId: run.id,
        device: profileOf(run),
        jiraKey: created.key,
        jiraUrl: created.url,
        summary,
        marks: JSON.stringify(marks),
        userId: userId ?? null,
      },
    });
    return { jiraKey: created.key, jiraUrl: created.url, summary, warnings };
  }

  private async attachmentsFor(run: TestRun, marks: BugMark[]): Promise<JiraAttachment[]> {
    const attachments: JiraAttachment[] = [];
    try {
      const image = await this.staticService.getImage(run.imageName);
      if (image) {
        attachments.push({ fileName: CHECKPOINT_FILE, content: markImage(image, marks), contentType: 'image/png' });
      }
    } catch (error) {
      this.logger.warn(`Cannot read the checkpoint of ${run.id}: ${error}`);
    }
    try {
      const baseline = run.baselineName ? await this.staticService.getImageBuffer(run.baselineName) : null;
      if (baseline) attachments.push({ fileName: BASELINE_FILE, content: baseline, contentType: 'image/png' });
    } catch (error) {
      this.logger.warn(`Cannot read the baseline of ${run.id}: ${error}`);
    }
    return attachments;
  }

  /** Bugs filed from any run of this check: every device, every build. */
  async forCheck(testRunId: string): Promise<VisualBugView[]> {
    const run = await this.loadRun(testRunId);
    const bugs = await this.prismaService.visualBug.findMany({
      where: { projectId: run.projectId, checkName: run.name, customTags: run.customTags ?? '' },
      orderBy: { createdAt: 'desc' },
    });
    const profile = profileOf(run);
    return bugs.map((bug) => ({
      id: bug.id,
      jiraKey: bug.jiraKey,
      jiraUrl: bug.jiraUrl,
      summary: bug.summary,
      marks: parseMarks(bug.marks),
      sameDevice: bug.device === profile,
      testRunId: bug.testRunId,
      createdAt: bug.createdAt,
    }));
  }
}
