import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { A11yIssueState, A11yProblem, TestRun } from '@prisma/client';
import { PNG } from 'pngjs';
import { PrismaService } from '../prisma/prisma.service';
import { StaticService } from '../static/static.service';
import { EventsGateway } from '../shared/events/events.gateway';
import { UiTreeService } from '../ui-tree/ui-tree.service';
import { A11yReport, A11yViolation } from './a11y.types';
import { A11yIssueStatus, ReviewContext, reviewReport, ReviewedA11yReport } from './a11y-issues';
import { JiraAttachment, JiraClient, JiraError, JiraFoundIssue } from './jira.client';
import { bugLabels, bugText, buildBugFields, defaultIssueType } from './jira-bug';
import {
  classOf,
  isComponentProblem,
  problemCode,
  problemComponent,
  problemKeyOf,
  ProblemClass,
  ProblemSettings,
  screenTitle,
} from './a11y-problems';
import { parseUiTreeSettings, UiTreeSettings } from '../ui-tree/comparison-inputs';
import { Rect } from '../ui-tree/ui-tree.types';

// Severity of every accessibility bug for now (the team's scale is S1–S5, SC)
const BUG_SEVERITY = 'S4';
const BUG_LABELS = ['accessibility', 'vision'];

const OUTLINE = [255, 0, 128];
const OUTLINE_WIDTH = 6;
const OUTLINE_PADDING = 6;

/** The screenshot with the elements outlined, for the Jira attachment. */
export function outlineElement(image: PNG, rects: Rect | Rect[]): Buffer {
  const out = new PNG({ width: image.width, height: image.height });
  image.data.copy(out.data);
  for (const rect of Array.isArray(rects) ? rects : [rects]) drawOutline(image, out, rect);
  return PNG.sync.write(out);
}

function drawOutline(image: PNG, out: PNG, rect: Rect): void {
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
}

/** How long a claim to file a bug holds before someone else may take it over. */
const FILING_TIMEOUT_MS = 3 * 60 * 1000;
const TITLE_CACHE_SIZE = 5000;
// problems looked up in Jira during review are not asked about again for a while
const JIRA_LOOKUP_TTL_MS = 10 * 60 * 1000;
const JIRA_LOOKUP_TIMEOUT_MS = 5000;
const JIRA_LOOKUP_BATCH = 40;

/** One problem of a run: its key, id and the issues that make it up. */
interface RunProblem {
  key: string;
  code: string;
  component: string | null;
  everyScreen: boolean;
}

/**
 * Team decisions on accessibility problems — a filed Jira bug or a false
 * positive — and the Jira filing itself. A problem is an issue identity by
 * the project's duplicate settings (rule + component + values, or rule +
 * screen + element), decided once for the project: a bug filed from one screen
 * covers the problem on every screen it shows on. Before filing, Vision claims
 * the problem in its database, so two people cannot file it at once, and
 * searches Jira for its id, so a bug filed some other way is linked instead.
 */
@Injectable()
export class A11yIssuesService implements OnModuleInit {
  private readonly logger = new Logger(A11yIssuesService.name);
  // screen titles of trees whose report was made with other title selectors
  private readonly titles = new Map<string, string | null>();
  // when a problem's id was last looked up in Jira, by project and id
  private readonly lookedUp = new Map<string, number>();

  constructor(
    private prismaService: PrismaService,
    private staticService: StaticService,
    private uiTreeService: UiTreeService,
    private eventsGateway: EventsGateway
  ) {}

  onModuleInit(): void {
    // in the background: the API is up meanwhile, and old decisions keep working until moved
    this.moveIssueStates().catch((error) => this.logger.warn(`Old accessibility decisions not moved: ${error}`));
  }

  async statesFor(projectId: string, screenName: string): Promise<A11yIssueState[]> {
    return this.prismaService.a11yIssueState.findMany({ where: { projectId, screenName } });
  }

  private async settingsFor(projectId: string): Promise<UiTreeSettings> {
    const project = await this.prismaService.project.findUnique({ where: { id: projectId } });
    return parseUiTreeSettings(project?.uiTreeSettings);
  }

  /** The screen's title by the project's selectors: kept in the report at ingest, else read from the tree. */
  private async titleOf(
    testRun: Pick<TestRun, 'uiTreeName'>,
    report: A11yReport,
    selectors: string[]
  ): Promise<string | null> {
    if (report.screenSelectors && report.screenSelectors.join('\n') === selectors.join('\n')) {
      return report.screenTitle ?? null;
    }
    if (!testRun.uiTreeName) return null;
    const cacheKey = `${testRun.uiTreeName}\n${selectors.join('\n')}`;
    if (!this.titles.has(cacheKey)) {
      const tree = await this.uiTreeService.load(testRun.uiTreeName).catch(() => null);
      if (this.titles.size >= TITLE_CACHE_SIZE) this.titles.delete(this.titles.keys().next().value);
      this.titles.set(cacheKey, screenTitle(tree, selectors));
    }
    return this.titles.get(cacheKey);
  }

  /** Everything a report is reviewed with: the screen, the settings and the decisions that touch it. */
  private async contextFor(
    testRun: Pick<TestRun, 'projectId' | 'name' | 'uiTreeName'>,
    report: A11yReport,
    settings?: UiTreeSettings
  ): Promise<ReviewContext & { title: string | null }> {
    const projectSettings = settings ?? (await this.settingsFor(testRun.projectId));
    const title = await this.titleOf(testRun, report, projectSettings.screenTitle);
    const problemSettings: ProblemSettings = {
      duplicateModes: projectSettings.a11yDuplicates as ProblemSettings['duplicateModes'],
      classes: projectSettings.a11yClasses as unknown as ProblemClass[],
    };
    const screen = title ?? testRun.name;
    const keys = [...new Set(report.violations.map((v) => problemKeyOf(v, screen, problemSettings)))];
    const [states, problems] = await Promise.all([
      this.statesFor(testRun.projectId, testRun.name),
      this.prismaService.a11yProblem.findMany({
        where: { projectId: testRun.projectId, OR: [{ key: { in: keys } }, { screenName: testRun.name }] },
      }),
    ]);
    return {
      projectId: testRun.projectId,
      screenName: testRun.name,
      screen,
      title,
      settings: problemSettings,
      states,
      problems,
    };
  }

  private async review(testRun: Pick<TestRun, 'projectId' | 'name' | 'uiTreeName'>, report: A11yReport) {
    return reviewReport(report, await this.contextFor(testRun, report));
  }

  /** Counts to keep on the row: new issues nobody has acted on, and all counted issues. */
  async countsFor(testRun: Pick<TestRun, 'projectId' | 'name' | 'uiTreeName'>, report: A11yReport) {
    const reviewed = await this.review(testRun, report);
    return { newCount: reviewed.summary.new, totalCount: reviewed.summary.total };
  }

  private async loadRun(testRunId: string): Promise<TestRun> {
    const testRun = await this.prismaService.testRun.findUnique({ where: { id: testRunId } });
    if (!testRun) throw new NotFoundException('Test run not found');
    return testRun;
  }

  async getReviewedReport(testRunId: string, userId?: string): Promise<ReviewedA11yReport | null> {
    const testRun = await this.loadRun(testRunId);
    const report = await this.uiTreeService.loadReport(testRun.a11yReportName);
    if (!report) return null;
    const reviewed = await this.review(testRun, report);
    const found = await this.lookUpInJira(testRun, reviewed, userId).catch((error) => {
      this.logger.warn(`Jira lookup for ${testRun.id} failed: ${error}`);
      return 0;
    });
    if (!found) return reviewed;
    await this.refreshCounts(testRun);
    return this.review(testRun, report);
  }

  /**
   * Looks up the screen's open problems in Jira by their ids (label or
   * summary), in one query, and records the open bugs found as filed: a bug
   * filed by hand, from another Vision or by a colleague a moment ago marks
   * the problem as filed on every screen. Returns how many were found.
   */
  private async lookUpInJira(testRun: TestRun, reviewed: ReviewedA11yReport, userId?: string): Promise<number> {
    const now = Date.now();
    const open = new Map<string, string>();
    for (const violation of reviewed.violations) {
      if (violation.issue) continue;
      const seen = this.lookedUp.get(`${testRun.projectId}\n${violation.problemCode}`);
      if (seen && now - seen < JIRA_LOOKUP_TTL_MS) continue;
      open.set(violation.problemCode, violation.group);
    }
    if (!open.size) return 0;
    const jira = await this.jiraFor(testRun.projectId, userId).then(
      ({ jira }) => jira,
      () => null
    );
    // without Jira there is nothing to look up
    if (!jira) return 0;
    const codes = [...open.keys()];
    let found = 0;
    for (let start = 0; start < codes.length; start += JIRA_LOOKUP_BATCH) {
      const batch = codes.slice(start, start + JIRA_LOOKUP_BATCH);
      const jql =
        `labels in (${batch.map((code) => `"${code}"`).join(', ')}) OR ` +
        batch.map((code) => `summary ~ "\\"${code}\\""`).join(' OR ');
      const issues = await jira.search(`(${jql}) ORDER BY created DESC`, 100, JIRA_LOOKUP_TIMEOUT_MS);
      for (const code of batch) this.lookedUp.set(`${testRun.projectId}\n${code}`, now);
      for (const code of batch) {
        const issue = issues.find((item) => !item.done && (item.labels.includes(code) || item.summary.includes(code)));
        if (!issue) continue;
        try {
          await this.prismaService.a11yProblem.create({
            data: {
              projectId: testRun.projectId,
              key: open.get(code),
              code,
              status: 'reported',
              jiraKey: issue.key,
              jiraUrl: issue.url,
              comment: 'Found in Jira by its id',
              screenName: testRun.name,
            },
          });
          found++;
        } catch (error) {
          // decided meanwhile in Vision: that decision stands
          if ((error as { code?: string }).code !== 'P2002') throw error;
        }
      }
    }
    if (this.lookedUp.size > 20000) this.lookedUp.clear();
    return found;
  }

  /**
   * Refreshes the counts of the build's runs after a decision changed. A
   * problem decided on one screen is decided on the others too, so every
   * screen of the build is looked at.
   */
  private async refreshCounts(testRun: TestRun): Promise<void> {
    const runs = await this.prismaService.testRun.findMany({
      where: { buildId: testRun.buildId, a11yReportName: { not: null } },
    });
    const settings = await this.settingsFor(testRun.projectId);
    for (const run of runs) {
      const report = await this.uiTreeService.loadReport(run.a11yReportName);
      if (!report) continue;
      const { summary } = reviewReport(report, await this.contextFor(run, report, settings));
      if (summary.new === run.a11yNewCount && summary.total === run.a11yTotalCount) continue;
      const updated = await this.prismaService.testRun.update({
        where: { id: run.id },
        data: { a11yNewCount: summary.new, a11yTotalCount: summary.total },
      });
      this.eventsGateway.testRunUpdated(updated);
    }
  }

  /** The issues of a run by id, and the problems they are. */
  private async problemsOf(
    testRun: TestRun,
    violationIds: string[]
  ): Promise<{ violations: A11yViolation[]; problems: RunProblem[]; title: string | null; classes: ProblemClass[] }> {
    const ids = [...new Set(violationIds)];
    if (!ids.length) throw new BadRequestException('No accessibility issue given');
    const report = await this.uiTreeService.loadReport(testRun.a11yReportName);
    const violations = ids.map((id) => report?.violations.find((v) => v.id === id));
    if (!report || violations.some((v) => !v)) {
      throw new BadRequestException('This accessibility issue is not on this test run');
    }
    const context = await this.contextFor(testRun, report);
    const byKey = new Map<string, RunProblem>();
    for (const violation of violations) {
      const key = problemKeyOf(violation, context.screen, context.settings);
      byKey.set(key, {
        key,
        code: problemCode(testRun.projectId, key),
        component: problemComponent(key),
        everyScreen: isComponentProblem(key),
      });
    }
    return { violations, problems: [...byKey.values()], title: context.title, classes: context.settings.classes ?? [] };
  }

  /** Records a decision on problems for the whole project; it replaces older per-issue ones of the screen. */
  private async decide(
    testRun: TestRun,
    violationIds: string[],
    status: A11yIssueStatus,
    data: { jiraKey?: string | null; jiraUrl?: string | null; comment?: string | null },
    userId?: string
  ) {
    const { problems, title } = await this.problemsOf(testRun, violationIds);
    let last: A11yProblem;
    for (const problem of problems) {
      const fields = { status, userId, screenName: testRun.name, screenTitle: title, ...data };
      last = await this.prismaService.a11yProblem.upsert({
        where: { projectId_key: { projectId: testRun.projectId, key: problem.key } },
        create: { projectId: testRun.projectId, key: problem.key, code: problem.code, ...fields },
        update: fields,
      });
    }
    await this.prismaService.a11yIssueState.deleteMany({
      where: { projectId: testRun.projectId, screenName: testRun.name, violationId: { in: violationIds } },
    });
    await this.refreshCounts(testRun);
    return last;
  }

  /** Marks a problem as a false positive: it stays listed but stops counting and failing builds, on every screen. */
  async ignore(testRunId: string, violationIds: string[], comment: string | undefined, userId?: string) {
    const testRun = await this.loadRun(testRunId);
    return this.decide(
      testRun,
      violationIds,
      'ignored',
      { comment: comment ?? null, jiraKey: null, jiraUrl: null },
      userId
    );
  }

  /** Forgets the decision on problems (undo of ignore or of a link), on every screen. */
  async reset(testRunId: string, violationIds: string[]): Promise<void> {
    const testRun = await this.loadRun(testRunId);
    const { problems } = await this.problemsOf(testRun, violationIds);
    await this.prismaService.a11yProblem.deleteMany({
      where: { projectId: testRun.projectId, key: { in: problems.map((problem) => problem.key) } },
    });
    await this.prismaService.a11yIssueState.deleteMany({
      where: { projectId: testRun.projectId, screenName: testRun.name, violationId: { in: violationIds } },
    });
    await this.refreshCounts(testRun);
  }

  /**
   * Jira as the person acting: their own token from their profile, else the
   * project's shared token when it has one. The Jira URL is the project's.
   */
  private async jiraFor(
    projectId: string,
    userId?: string
  ): Promise<{ jira: JiraClient; issueType: string | null; linkType: string | null }> {
    const [project, user] = await Promise.all([
      this.prismaService.project.findUnique({ where: { id: projectId } }),
      userId ? this.prismaService.user.findUnique({ where: { id: userId } }) : null,
    ]);
    if (!project?.jiraUrl) {
      throw new BadRequestException('Jira is not set up for this project: add its URL in project settings');
    }
    const credentials = user?.jiraToken
      ? { token: user.jiraToken, email: user.jiraEmail }
      : project.jiraToken
        ? { token: project.jiraToken, email: project.jiraEmail }
        : null;
    if (!credentials) {
      throw new BadRequestException('Add your Jira token in your profile to work with Jira from Vision');
    }
    return {
      jira: new JiraClient({ url: project.jiraUrl, ...credentials }),
      issueType: project.jiraIssueType,
      linkType: project.jiraLinkType,
    };
  }

  /** Records a Jira issue that already exists for this problem. */
  async link(testRunId: string, violationIds: string[], jiraKey: string, userId?: string) {
    const testRun = await this.loadRun(testRunId);
    const key = jiraKey.trim().toUpperCase();
    let url: string | null = null;
    try {
      const { jira } = await this.jiraFor(testRun.projectId, userId);
      url = jira.browseUrl((await jira.getIssue(key)).key);
    } catch (error) {
      if (error instanceof JiraError) throw new BadRequestException(error.message);
      // no Jira set up: keep the key as typed
    }
    return this.decide(testRun, violationIds, 'reported', { jiraKey: key, jiraUrl: url, comment: null }, userId);
  }

  /** Bugs in the Jira project that carry the problem's id, as a label or in the summary. */
  private async findInJira(jira: JiraClient, projectKey: string, code: string): Promise<JiraFoundIssue[]> {
    const jql = `project = "${projectKey}" AND (labels = "${code}" OR summary ~ "\\"${code}\\"") ORDER BY created DESC`;
    return jira.search(jql, 5);
  }

  private async bugContext(testRun: TestRun, violations: A11yViolation[], problem: RunProblem, title: string | null) {
    const device = [testRun.device, testRun.os, testRun.viewport, testRun.browser].filter(Boolean).join(' · ');
    const url = `${process.env.APP_FRONTEND_URL}/${testRun.projectId}?buildId=${testRun.buildId}&testId=${testRun.id}`;
    return {
      ...bugText({ violations, testName: testRun.name, title, device, url, problem }),
      labels: bugLabels({ code: problem.code, rule: violations[0].rule, component: problem.component }, BUG_LABELS),
    };
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
  async findJiraUsers(testRunId: string, query: string, userId?: string) {
    const testRun = await this.loadRun(testRunId);
    const { jira } = await this.jiraFor(testRun.projectId, userId);
    return this.jiraCall(() => jira.findUsers(query));
  }

  /** The one problem a bug is filed for. */
  private single(problems: RunProblem[]): RunProblem {
    if (problems.length !== 1) {
      throw new BadRequestException('These issues are different problems: file a bug for each of them');
    }
    return problems[0];
  }

  /** What is known about a problem already: a decision in Vision, and bugs in Jira with its id. */
  private async existing(testRun: TestRun, problem: RunProblem) {
    const row = await this.prismaService.a11yProblem.findUnique({
      where: { projectId_key: { projectId: testRun.projectId, key: problem.key } },
    });
    return row
      ? {
          status: row.status,
          jiraKey: row.jiraKey,
          jiraUrl: row.jiraUrl,
          screenName: row.screenName,
          screenTitle: row.screenTitle,
        }
      : null;
  }

  /**
   * What filing a bug under this task would do: the issue types and link
   * types to choose from (read from Jira for the task's project), which one
   * is offered first, the fields Vision fills in or cannot fill, and whether
   * the problem is filed already: in Vision, or in Jira under its id.
   */
  async prepareBug(
    testRunId: string,
    violationIds: string[],
    parentKey: string,
    issueTypeId?: string,
    fieldValues?: Record<string, unknown>,
    userId?: string
  ) {
    const testRun = await this.loadRun(testRunId);
    const { violations, problems, title } = await this.problemsOf(testRun, violationIds);
    const problem = this.single(problems);
    const { jira, issueType: configuredType, linkType: configuredLink } = await this.jiraFor(testRun.projectId, userId);
    return this.jiraCall(async () => {
      const parent = await jira.getIssue(parentKey.trim().toUpperCase());
      const [issueTypes, linkTypes, inJira, inVision] = await Promise.all([
        jira.issueTypes(parent.projectKey),
        jira.linkTypes().catch(() => []),
        this.findInJira(jira, parent.projectKey, problem.code).catch((error) => {
          this.logger.warn(`Jira search for ${problem.code} failed: ${error}`);
          return [] as JiraFoundIssue[];
        }),
        this.existing(testRun, problem),
      ]);
      const chosen =
        (issueTypeId && issueTypes.find((type) => type.id === issueTypeId)) ||
        defaultIssueType(issueTypes, configuredType);
      if (!chosen) throw new BadRequestException(`Project ${parent.projectKey} offers no issue type to create`);
      const text = await this.bugContext(testRun, violations, problem, title);
      const meta = await jira.createFields(parent.projectKey, chosen.id);
      const bug = buildBugFields({
        meta,
        parent,
        issueType: chosen,
        summary: text.summary,
        description: text.description,
        labels: text.labels,
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
        problem: { code: problem.code, component: problem.component, everyScreen: problem.everyScreen },
        existing: inVision,
        inJira,
      };
    });
  }

  /**
   * Claims a problem for filing: one row per problem and project, so of two
   * people filing it at once only one gets it. A claim left by a filing that
   * died is taken over after a while.
   */
  private async claim(
    testRun: TestRun,
    problem: RunProblem,
    title: string | null,
    userId?: string
  ): Promise<{ claim: A11yProblem } | { taken: A11yProblem }> {
    const where = { projectId_key: { projectId: testRun.projectId, key: problem.key } };
    try {
      const claim = await this.prismaService.a11yProblem.create({
        data: {
          projectId: testRun.projectId,
          key: problem.key,
          code: problem.code,
          status: 'filing',
          screenName: testRun.name,
          screenTitle: title,
          userId,
        },
      });
      return { claim };
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
    const taken = await this.prismaService.a11yProblem.findUnique({ where });
    if (!taken) return this.claim(testRun, problem, title, userId);
    if (taken.status !== 'filing' || Date.now() - taken.updatedAt.getTime() < FILING_TIMEOUT_MS) return { taken };
    // a stale claim: whoever updates it first takes it over
    const { count } = await this.prismaService.a11yProblem.updateMany({
      where: { id: taken.id, status: 'filing', updatedAt: taken.updatedAt },
      data: { userId, screenName: testRun.name, screenTitle: title },
    });
    return count ? { claim: await this.prismaService.a11yProblem.findUnique({ where }) } : { taken };
  }

  /**
   * Files a bug for the problem in Jira under the given task: as its sub-task
   * when the issue type is one, else linked to it. Unless it is filed already:
   * in Vision (by someone else, maybe a moment ago), or in Jira under the
   * problem's id, in which case that bug is linked instead. Screen, service,
   * actual and expected result, device and element are filled in, the
   * problem's id goes into the summary, labels and description, the task's
   * assignee takes it, and the screenshot is attached with the elements
   * outlined.
   */
  async fileBug(
    testRunId: string,
    violationIds: string[],
    options: { parentKey: string; issueTypeId?: string; linkType?: string; fieldValues?: Record<string, unknown> },
    userId?: string
  ): Promise<{ jiraKey: string; jiraUrl: string | null; code: string; alreadyFiled: boolean; warnings: string[] }> {
    const testRun = await this.loadRun(testRunId);
    const { violations, problems, title, classes } = await this.problemsOf(testRun, violationIds);
    const problem = this.single(problems);
    const ignoredBy = violations
      .map((violation) => classOf(violation, classes)?.problemClass)
      .find((item) => item?.action === 'ignore');
    if (ignoredBy) {
      throw new BadRequestException(
        `The project's class “${ignoredBy.name}” ignores this problem: no bugs are filed for it`
      );
    }
    const { jira, issueType: configuredType, linkType: configuredLink } = await this.jiraFor(testRun.projectId, userId);

    const claimed = await this.claim(testRun, problem, title, userId);
    if ('taken' in claimed) {
      const { taken } = claimed;
      const where = taken.screenTitle || taken.screenName;
      if (taken.status === 'reported' && taken.jiraKey) {
        await this.refreshCounts(testRun);
        return {
          jiraKey: taken.jiraKey,
          jiraUrl: taken.jiraUrl,
          code: problem.code,
          alreadyFiled: true,
          warnings: [
            `${problem.code} was filed already as ${taken.jiraKey} (screen “${where}”); nothing new was filed`,
          ],
        };
      }
      throw new ConflictException(
        taken.status === 'filing'
          ? `A bug for ${problem.code} is being filed right now from screen “${where}”. Refresh in a minute.`
          : `${problem.code} is marked as a false positive on screen “${where}”. Restore it to file a bug.`
      );
    }
    const release = () =>
      this.prismaService.a11yProblem.deleteMany({ where: { id: claimed.claim.id, status: 'filing' } }).catch(() => 0);
    const finish = async (jiraKey: string, jiraUrl: string | null) => {
      await this.prismaService.a11yProblem.update({
        where: { id: claimed.claim.id },
        data: { status: 'reported', jiraKey, jiraUrl, comment: null },
      });
      await this.prismaService.a11yIssueState.deleteMany({
        where: { projectId: testRun.projectId, screenName: testRun.name, violationId: { in: violationIds } },
      });
      await this.refreshCounts(testRun);
    };

    try {
      const parent = await this.jiraCall(() => jira.getIssue(options.parentKey.trim().toUpperCase()));
      const warnings: string[] = [];
      const found = await this.findInJira(jira, parent.projectKey, problem.code).catch((error) => {
        warnings.push(`Could not check Jira for ${problem.code}: ${error.message}`);
        return [] as JiraFoundIssue[];
      });
      const open = found.find((issue) => !issue.done);
      if (open) {
        await finish(open.key, open.url);
        return {
          jiraKey: open.key,
          jiraUrl: open.url,
          code: problem.code,
          alreadyFiled: true,
          warnings: [`Jira has ${open.key} (${open.status}) for ${problem.code}: linked instead of filing a new one`],
        };
      }
      if (found.length) {
        warnings.push(`${problem.code} was filed before as ${found.map((issue) => issue.key).join(', ')} (done)`);
      }

      let attachment: JiraAttachment | undefined;
      try {
        const image = await this.staticService.getImage(testRun.imageName);
        if (image) {
          attachment = {
            fileName: `${testRun.name.replace(/[^\p{L}\p{N}.-]+/gu, '_').slice(0, 80)}-a11y.png`,
            content: outlineElement(
              image,
              violations.map((violation) => violation.bounds)
            ),
            contentType: 'image/png',
          };
        }
      } catch (error) {
        this.logger.warn(`Cannot attach screenshot for ${testRun.id}: ${error}`);
      }

      const created = await this.jiraCall(async () => {
        const issueTypes = await jira.issueTypes(parent.projectKey);
        const issueType =
          (options.issueTypeId && issueTypes.find((type) => type.id === options.issueTypeId)) ||
          defaultIssueType(issueTypes, configuredType);
        if (!issueType) throw new BadRequestException(`Project ${parent.projectKey} offers no issue type to create`);
        const text = await this.bugContext(testRun, violations, problem, title);
        const bug = buildBugFields({
          meta: await jira.createFields(parent.projectKey, issueType.id),
          parent,
          issueType,
          summary: text.summary,
          description: text.description,
          labels: text.labels,
          severity: BUG_SEVERITY,
          overrides: options.fieldValues,
        });
        if (bug.missing.length) {
          throw new BadRequestException(
            `Jira requires fields that are still empty for "${issueType.name}": ${bug.missing.join(', ')}.`
          );
        }
        const issue = await jira.createIssue(bug.fields);
        if (!bug.fields.labels) {
          // the create screen has no labels: the problem id is still in the summary
          await jira.addLabels(issue.key, text.labels).catch((error) => {
            warnings.push(`Labels not set (the id is in the summary): ${error.message}`);
          });
        }
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
        return issue;
      });
      await finish(created.key, created.url);
      return { jiraKey: created.key, jiraUrl: created.url, code: problem.code, alreadyFiled: false, warnings };
    } catch (error) {
      await release();
      throw error;
    }
  }

  /**
   * Moves decisions kept per issue and screen (before problems existed) to
   * problems, so they cover the problem on every screen too. The issue is
   * looked up in the screen's latest report; decisions whose issue is gone
   * stay as they are and keep applying on their screen.
   */
  async moveIssueStates(): Promise<number> {
    const states = await this.prismaService.a11yIssueState.findMany({ orderBy: { createdAt: 'asc' } });
    let moved = 0;
    const settingsByProject = new Map<string, UiTreeSettings>();
    for (const state of states) {
      const run = await this.prismaService.testRun.findFirst({
        where: { projectId: state.projectId, name: state.screenName, a11yReportName: { not: null } },
        orderBy: { createdAt: 'desc' },
      });
      const report = run ? await this.uiTreeService.loadReport(run.a11yReportName).catch(() => null) : null;
      const violation = report?.violations.find((v) => v.id === state.violationId);
      if (!violation) continue;
      if (!settingsByProject.has(state.projectId)) {
        settingsByProject.set(state.projectId, await this.settingsFor(state.projectId));
      }
      const context = await this.contextFor(run, report, settingsByProject.get(state.projectId));
      const key = problemKeyOf(violation, context.screen, context.settings);
      const exists = await this.prismaService.a11yProblem.findUnique({
        where: { projectId_key: { projectId: state.projectId, key } },
      });
      if (!exists) {
        await this.prismaService.a11yProblem.create({
          data: {
            projectId: state.projectId,
            key,
            code: problemCode(state.projectId, key),
            status: state.status,
            jiraKey: state.jiraKey,
            jiraUrl: state.jiraUrl,
            comment: state.comment,
            screenName: state.screenName,
            screenTitle: context.title,
            userId: state.userId,
          },
        });
      }
      await this.prismaService.a11yIssueState.delete({ where: { id: state.id } });
      moved++;
    }
    if (moved) this.logger.log(`Moved ${moved} accessibility decisions to problems`);
    return moved;
  }
}
