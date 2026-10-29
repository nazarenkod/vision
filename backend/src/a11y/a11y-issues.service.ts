import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { A11yIssueState, A11yProblem, Prisma, TestRun } from '@prisma/client';
import { PNG } from 'pngjs';
import { PrismaService } from '../prisma/prisma.service';
import { StaticService } from '../static/static.service';
import { EventsGateway } from '../shared/events/events.gateway';
import { UiTreeService } from '../ui-tree/ui-tree.service';
import { A11yReport, A11yViolation } from './a11y.types';
import { applyNorms } from './a11y-norms';
import {
  A11yIssueStatus,
  decidingProblem,
  indexProblems,
  ProblemIndex,
  ReviewContext,
  reviewReport,
  ReviewedA11yReport,
  storedFacets,
} from './a11y-issues';
import { JiraAttachment, JiraClient, JiraError, JiraFoundIssue } from './jira.client';
import { bugText, buildBugFields, defaultIssueType } from './jira-bug';
import {
  facetsFromKey,
  facetsOf,
  isComponentProblem,
  isVisionMarker,
  markerQuery,
  problemCode,
  problemKeyOf,
  problemMarkers,
  ProblemFacets,
  screenTitle,
  unlinkedLabel,
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
const JIRA_LOOKUP_BATCH = 15;
const CODE_LABEL = /^a11y-[0-9a-f]{8}$/;

export type A11yDecisionAction = 'filed' | 'linked' | 'found' | 'unlinked' | 'ignored' | 'restored';

/** One problem of a run: the issues it takes and the stored problems it matches. */
interface RunProblem {
  key: string;
  // the id: the deciding stored problem's, else the one a new problem would get
  code: string;
  component: string | null;
  everyScreen: boolean;
  violations: A11yViolation[];
  facets: ProblemFacets[];
  matching: A11yProblem[];
  deciding: A11yProblem | undefined;
}

/** The project's problems indexed, kept while they do not change. */
interface CachedIndex {
  version: string;
  index: ProblemIndex;
}

const dedupeFacets = (facets: ProblemFacets[]): ProblemFacets[] => [
  ...new Map(facets.map((item) => [`${item.nodeKey}\n${item.screen}\n${item.measure}`, item])).values(),
];

/**
 * Team decisions on accessibility problems — a filed Jira bug or a false
 * positive — and the Jira filing itself.
 *
 * A problem is created once, with an id (a11y-3f9c2a1b) and the facts of the
 * occurrences it was decided for. What is one problem is worked out from the
 * facts, for issues and stored problems alike, so how problems are told apart
 * can change without changing ids or losing bugs; a bug filed from one screen
 * covers the problem on every screen it shows on.
 *
 * In Jira, a bug carries the id and markers of the facts (rule, component,
 * values) as labels. Before filing, Vision claims the problem in its
 * database, so two people cannot file it at once, and searches Jira for the
 * id or the markers, so a bug filed some other way is linked instead; a
 * review looks its screen's open problems up the same way. Unlinking takes
 * the markers off the bug and marks it unlinked, and every decision is
 * recorded.
 */
@Injectable()
export class A11yIssuesService implements OnModuleInit {
  private readonly logger = new Logger(A11yIssuesService.name);
  // screen titles of trees whose report was made with other title selectors
  private readonly titles = new Map<string, string | null>();
  // when a problem's id was last looked up in Jira, by project and id
  private readonly lookedUp = new Map<string, number>();
  private readonly indexes = new Map<string, CachedIndex>();

  constructor(
    private prismaService: PrismaService,
    private staticService: StaticService,
    private uiTreeService: UiTreeService,
    private eventsGateway: EventsGateway
  ) {}

  onModuleInit(): void {
    // in the background: the API is up meanwhile, and old decisions keep working until moved
    this.moveIssueStates()
      .then(() => this.fillFacets())
      .catch((error) => this.logger.warn(`Old accessibility decisions not moved: ${error}`));
  }

  async statesFor(projectId: string, screenName: string): Promise<A11yIssueState[]> {
    return this.prismaService.a11yIssueState.findMany({ where: { projectId, screenName } });
  }

  private async settingsFor(projectId: string): Promise<UiTreeSettings> {
    const project = await this.prismaService.project.findUnique({ where: { id: projectId } });
    return parseUiTreeSettings(project?.uiTreeSettings);
  }

  /**
   * A run's report as the project's current norms see it (026): what a norm
   * changed since the snapshot lets pass, or a rule turned off, is not shown,
   * counted or filed.
   */
  private async reportOf(
    testRun: Pick<TestRun, 'projectId' | 'a11yReportName'>,
    settings?: UiTreeSettings
  ): Promise<A11yReport | null> {
    const report = await this.uiTreeService.loadReport(testRun.a11yReportName);
    if (!report) return null;
    const { a11yNorms } = settings ?? (await this.settingsFor(testRun.projectId));
    return applyNorms(report, a11yNorms);
  }

  /**
   * The project's problems indexed. Rebuilt when a problem changes; checking
   * that is one small query.
   */
  private async indexFor(projectId: string): Promise<ProblemIndex> {
    const stats = await this.prismaService.a11yProblem.aggregate({
      where: { projectId },
      _count: { _all: true },
      _max: { updatedAt: true },
    });
    const version = `${stats._count._all}|${stats._max.updatedAt?.getTime() ?? 0}`;
    const cached = this.indexes.get(projectId);
    if (cached?.version === version) return cached.index;
    const problems = await this.prismaService.a11yProblem.findMany({ where: { projectId } });
    const index = indexProblems(problems);
    this.indexes.set(projectId, { version, index });
    return index;
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

  /** Everything a report is reviewed with: the screen and the decisions that touch it. */
  private async contextFor(
    testRun: Pick<TestRun, 'projectId' | 'name' | 'uiTreeName'>,
    report: A11yReport,
    settings?: UiTreeSettings
  ): Promise<ReviewContext & { title: string | null; index: ProblemIndex }> {
    const projectSettings = settings ?? (await this.settingsFor(testRun.projectId));
    const title = await this.titleOf(testRun, report, projectSettings.screenTitle);
    const [states, index] = await Promise.all([
      this.statesFor(testRun.projectId, testRun.name),
      this.indexFor(testRun.projectId),
    ]);
    return {
      projectId: testRun.projectId,
      screenName: testRun.name,
      screen: title ?? testRun.name,
      title,
      states,
      index,
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
    const report = await this.reportOf(testRun);
    if (!report) return null;
    const reviewed = await this.review(testRun, report);
    const found = await this.lookUpInJira(testRun, report, reviewed, userId).catch((error) => {
      this.logger.warn(`Jira lookup for ${testRun.id} failed: ${error}`);
      return 0;
    });
    if (!found) return reviewed;
    await this.refreshCounts(testRun);
    return this.review(testRun, report);
  }

  /** Drops the cached index after a write here; the version check covers writes elsewhere. */
  private forget(projectId: string): void {
    this.indexes.delete(projectId);
  }

  /** Records a decision on a problem. */
  private async record(
    projectId: string,
    entry: {
      problemId?: string | null;
      code: string;
      action: A11yDecisionAction;
      jiraKey?: string | null;
      screenName: string;
      comment?: string | null;
      userId?: string | null;
    }
  ): Promise<void> {
    await this.prismaService.a11yDecision.create({ data: { projectId, ...entry } }).catch((error) => {
      this.logger.warn(`Decision not recorded: ${error}`);
    });
  }

  /** Bugs someone unlinked in Vision (and nobody linked again since): never linked by a lookup. */
  private async unlinkedKeys(projectId: string, jiraKeys: string[]): Promise<Set<string>> {
    if (!jiraKeys.length) return new Set();
    const decisions = await this.prismaService.a11yDecision.findMany({
      where: { projectId, jiraKey: { in: jiraKeys }, action: { in: ['filed', 'linked', 'found', 'unlinked'] } },
      orderBy: { createdAt: 'desc' },
    });
    const latest = new Map<string, string>();
    for (const decision of decisions) if (!latest.has(decision.jiraKey)) latest.set(decision.jiraKey, decision.action);
    return new Set([...latest].filter(([, action]) => action === 'unlinked').map(([key]) => key));
  }

  /** The JQL that finds bugs of a problem: its id as a label or in the summary, or its markers. */
  private jqlFor(code: string, facets: ProblemFacets): string {
    const markers = markerQuery(facets);
    return [
      `labels = "${code}"`,
      `summary ~ "\\"${code}\\""`,
      ...(markers ? [`(${markers.map((label) => `labels = "${label}"`).join(' AND ')})`] : []),
    ].join(' OR ');
  }

  /** Whether a found issue is a bug of the problem: by its id, or by all of its markers. */
  private isBugOf(issue: JiraFoundIssue, code: string, facets: ProblemFacets): boolean {
    if (issue.done || issue.labels.includes(unlinkedLabel(code))) return false;
    if (issue.labels.includes(code) || issue.summary.includes(code)) return true;
    const markers = markerQuery(facets);
    return !!markers && markers.every((label) => issue.labels.includes(label));
  }

  /** The id a found bug already carries, so a problem found in Jira keeps it. */
  private codeOn(issue: JiraFoundIssue): string | null {
    return (
      issue.labels.find((label) => CODE_LABEL.test(label)) ?? /\[(a11y-[0-9a-f]{8})\]/.exec(issue.summary)?.[1] ?? null
    );
  }

  /**
   * Looks up the screen's open problems in Jira by their ids or markers, in a
   * few queries, and records the open bugs found as filed: a bug filed by
   * hand, from another Vision, or by a colleague a
   * moment ago marks the problem as filed on every screen. Bugs someone
   * unlinked are left alone. Returns how many were found.
   */
  private async lookUpInJira(
    testRun: TestRun,
    report: A11yReport,
    reviewed: ReviewedA11yReport,
    userId?: string
  ): Promise<number> {
    const now = Date.now();
    const open = new Map<string, ReviewedA11yReport['violations'][number]>();
    for (const violation of reviewed.violations) {
      if (violation.issue || open.has(violation.group)) continue;
      const seen = this.lookedUp.get(`${testRun.projectId}\n${violation.problemCode}`);
      if (seen && now - seen < JIRA_LOOKUP_TTL_MS) continue;
      open.set(violation.group, violation);
    }
    if (!open.size) return 0;
    const jira = await this.jiraFor(testRun.projectId, userId).then(
      ({ jira }) => jira,
      () => null
    );
    // without Jira there is nothing to look up
    if (!jira) return 0;
    const context = await this.contextFor(testRun, report);
    const candidates = [...open.entries()].map(([key, violation]) => ({
      key,
      violation,
      code: violation.problemCode,
      facets: facetsOf(violation, context.screen),
    }));
    let found = 0;
    for (let start = 0; start < candidates.length; start += JIRA_LOOKUP_BATCH) {
      const batch = candidates.slice(start, start + JIRA_LOOKUP_BATCH);
      const jql = batch.map((item) => `(${this.jqlFor(item.code, item.facets)})`).join(' OR ');
      const issues = await jira.search(`(${jql}) ORDER BY created DESC`, 100, JIRA_LOOKUP_TIMEOUT_MS);
      const unlinked = await this.unlinkedKeys(
        testRun.projectId,
        issues.map((issue) => issue.key)
      );
      for (const item of batch) {
        this.lookedUp.set(`${testRun.projectId}\n${item.code}`, now);
        const issue = issues.find(
          (candidate) => !unlinked.has(candidate.key) && this.isBugOf(candidate, item.code, item.facets)
        );
        if (!issue) continue;
        const code = this.codeOn(issue) ?? item.code;
        try {
          const problem = await this.prismaService.a11yProblem.create({
            data: {
              projectId: testRun.projectId,
              key: item.key,
              code,
              rule: item.facets.rule,
              facets: [item.facets] as unknown as Prisma.InputJsonValue,
              status: 'reported',
              jiraKey: issue.key,
              jiraUrl: issue.url,
              comment: 'Found in Jira',
              screenName: testRun.name,
              screenTitle: context.title,
            },
          });
          await this.record(testRun.projectId, {
            problemId: problem.id,
            code,
            action: 'found',
            jiraKey: issue.key,
            screenName: testRun.name,
            userId,
          });
          found++;
          this.forget(testRun.projectId);
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
   * After the project's settings are saved: the counts of its latest builds by
   * the norms saved. Older builds keep theirs until a decision in their review
   * recounts them; the review itself always shows the current norms.
   */
  async recountLatestBuilds(projectId: string, builds = 5): Promise<void> {
    const latest = await this.prismaService.build.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: builds,
      select: { id: true },
    });
    for (const build of latest) {
      await this.refreshCounts({ projectId, buildId: build.id });
    }
  }

  /**
   * Refreshes the counts of the build's runs after a decision changed. A
   * problem decided on one screen is decided on the others too, so every
   * screen of the build is looked at.
   */
  private async refreshCounts(testRun: Pick<TestRun, 'projectId' | 'buildId'>): Promise<void> {
    const runs = await this.prismaService.testRun.findMany({
      where: { buildId: testRun.buildId, a11yReportName: { not: null } },
    });
    const settings = await this.settingsFor(testRun.projectId);
    for (const run of runs) {
      const report = await this.reportOf(run, settings);
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

  /** The issues of a run by id, grouped into the problems they are. */
  private async problemsOf(
    testRun: TestRun,
    violationIds: string[]
  ): Promise<{ problems: RunProblem[]; title: string | null }> {
    const ids = [...new Set(violationIds)];
    if (!ids.length) throw new BadRequestException('No accessibility issue given');
    const report = await this.reportOf(testRun);
    const violations = ids.map((id) => report?.violations.find((v) => v.id === id));
    if (!report || violations.some((v) => !v)) {
      throw new BadRequestException('This accessibility issue is not on this test run');
    }
    const context = await this.contextFor(testRun, report);
    const byKey = new Map<string, RunProblem>();
    for (const violation of violations) {
      const facets = facetsOf(violation, context.screen);
      const key = problemKeyOf(facets);
      const existing = byKey.get(key);
      if (existing) {
        existing.violations.push(violation);
        existing.facets.push(facets);
        continue;
      }
      const matching = context.index.get(key) ?? [];
      const deciding = decidingProblem(matching, testRun.name);
      byKey.set(key, {
        key,
        code: deciding?.code ?? problemCode(testRun.projectId, key),
        component: facets.component,
        everyScreen: isComponentProblem(key),
        violations: [violation],
        facets: [facets],
        matching,
        deciding,
      });
    }
    return { problems: [...byKey.values()], title: context.title };
  }

  /** Puts Vision's markers of a problem on a bug, or takes them off and marks it unlinked. */
  private async mirror(
    jira: JiraClient | null,
    jiraKey: string,
    change: 'linked' | 'unlinked',
    code: string,
    markers: string[]
  ): Promise<string | null> {
    if (!jira) return null;
    try {
      if (change === 'linked') {
        await jira.editLabels(jiraKey, { add: markers, remove: [unlinkedLabel(code)] });
      } else {
        const issue = (await jira.search(`key = "${jiraKey}"`, 1))[0];
        const ours = (issue?.labels ?? []).filter(isVisionMarker);
        await jira.editLabels(jiraKey, { remove: ours, add: [unlinkedLabel(code)] });
      }
      return null;
    } catch (error) {
      return `Jira labels of ${jiraKey} not updated: ${(error as Error).message}`;
    }
  }

  /**
   * Records a decision on the problems of the given issues for the whole
   * project: on the stored problems they match, or on new ones with the
   * issues' facts. Replaces older per-issue decisions of the screen.
   */
  private async decide(
    testRun: TestRun,
    violationIds: string[],
    status: A11yIssueStatus,
    data: { jiraKey?: string | null; jiraUrl?: string | null; comment?: string | null },
    userId?: string
  ): Promise<A11yProblem[]> {
    const { problems, title } = await this.problemsOf(testRun, violationIds);
    const saved: A11yProblem[] = [];
    for (const problem of problems) {
      const fields = { status, userId, screenName: testRun.name, screenTitle: title, ...data };
      if (problem.matching.length) {
        for (const match of problem.matching) {
          saved.push(
            await this.prismaService.a11yProblem.update({
              where: { id: match.id },
              data: {
                ...fields,
                facets: dedupeFacets([...storedFacets(match), ...problem.facets]) as unknown as Prisma.InputJsonValue,
              },
            })
          );
        }
      } else {
        saved.push(
          await this.prismaService.a11yProblem.upsert({
            where: { projectId_key: { projectId: testRun.projectId, key: problem.key } },
            create: {
              projectId: testRun.projectId,
              key: problem.key,
              code: problem.code,
              rule: problem.facets[0].rule,
              facets: dedupeFacets(problem.facets) as unknown as Prisma.InputJsonValue,
              ...fields,
            },
            update: fields,
          })
        );
      }
    }
    await this.prismaService.a11yIssueState.deleteMany({
      where: { projectId: testRun.projectId, screenName: testRun.name, violationId: { in: violationIds } },
    });
    this.forget(testRun.projectId);
    await this.refreshCounts(testRun);
    return saved;
  }

  /** Marks a problem as a false positive: it stays listed but stops counting and failing builds, on every screen. */
  async ignore(testRunId: string, violationIds: string[], comment: string | undefined, userId?: string) {
    const testRun = await this.loadRun(testRunId);
    const saved = await this.decide(
      testRun,
      violationIds,
      'ignored',
      { comment: comment ?? null, jiraKey: null, jiraUrl: null },
      userId
    );
    for (const problem of saved) {
      await this.record(testRun.projectId, {
        problemId: problem.id,
        code: problem.code,
        action: 'ignored',
        screenName: testRun.name,
        comment: comment ?? null,
        userId,
      });
    }
    return { problems: saved.map((problem) => problem.code), warnings: [] as string[] };
  }

  /**
   * Forgets the decision on problems (undo of ignore or of a link), on every
   * screen. An unlinked bug loses Vision's markers in Jira and is marked
   * unlinked, so no lookup links it again.
   */
  async reset(testRunId: string, violationIds: string[], userId?: string): Promise<{ warnings: string[] }> {
    const testRun = await this.loadRun(testRunId);
    const { problems } = await this.problemsOf(testRun, violationIds);
    const keys = new Set(problems.map((problem) => problem.key));
    const touched = [
      ...new Map(problems.flatMap((problem) => problem.matching).map((item) => [item.id, item])).values(),
    ];
    const jira = touched.some((problem) => problem.jiraKey)
      ? await this.jiraFor(testRun.projectId, userId).then(
          ({ jira }) => jira,
          () => null
        )
      : null;
    const warnings: string[] = [];
    for (const problem of touched) {
      // parts of a stored problem may now be other problems: only these parts are forgotten
      const remaining = storedFacets(problem).filter((facets) => !keys.has(problemKeyOf(facets)));
      const action: A11yDecisionAction = problem.status === 'ignored' ? 'restored' : 'unlinked';
      if (remaining.length) {
        await this.prismaService.a11yProblem.update({
          where: { id: problem.id },
          data: { facets: remaining as unknown as Prisma.InputJsonValue },
        });
        await this.record(testRun.projectId, {
          problemId: problem.id,
          code: problem.code,
          action,
          jiraKey: problem.jiraKey,
          screenName: testRun.name,
          comment: `Part of the problem: ${[...keys].join(', ')}; the rest keeps the decision`,
          userId,
        });
        continue;
      }
      await this.prismaService.a11yProblem.deleteMany({ where: { id: problem.id } });
      await this.record(testRun.projectId, {
        problemId: problem.id,
        code: problem.code,
        action,
        jiraKey: problem.jiraKey,
        screenName: testRun.name,
        userId,
      });
      if (problem.status === 'reported' && problem.jiraKey) {
        const warning = await this.mirror(jira, problem.jiraKey, 'unlinked', problem.code, []);
        if (warning) warnings.push(warning);
      }
    }
    await this.prismaService.a11yIssueState.deleteMany({
      where: { projectId: testRun.projectId, screenName: testRun.name, violationId: { in: violationIds } },
    });
    this.forget(testRun.projectId);
    await this.refreshCounts(testRun);
    return { warnings };
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

  /** Records a Jira issue that already exists for the problem, and puts the problem's markers on it. */
  async link(testRunId: string, violationIds: string[], jiraKey: string, userId?: string) {
    const testRun = await this.loadRun(testRunId);
    const key = jiraKey.trim().toUpperCase();
    let url: string | null = null;
    let jira: JiraClient | null = null;
    try {
      jira = (await this.jiraFor(testRun.projectId, userId)).jira;
      url = jira.browseUrl((await jira.getIssue(key)).key);
    } catch (error) {
      if (error instanceof JiraError) throw new BadRequestException(error.message);
      // no Jira set up: keep the key as typed
    }
    const saved = await this.decide(
      testRun,
      violationIds,
      'reported',
      { jiraKey: key, jiraUrl: url, comment: null },
      userId
    );
    const warnings: string[] = [];
    for (const problem of saved) {
      await this.record(testRun.projectId, {
        problemId: problem.id,
        code: problem.code,
        action: 'linked',
        jiraKey: key,
        screenName: testRun.name,
        userId,
      });
      const facets = storedFacets(problem)[0];
      const warning = await this.mirror(jira, key, 'linked', problem.code, problemMarkers(problem.code, facets));
      if (warning) warnings.push(warning);
    }
    return { jiraKey: key, jiraUrl: url, problems: saved.map((problem) => problem.code), warnings };
  }

  /** Bugs in the Jira project with the problem's id or markers that are still its bugs. */
  private async findInJira(
    jira: JiraClient,
    projectId: string,
    projectKey: string,
    problem: RunProblem
  ): Promise<JiraFoundIssue[]> {
    const facets = problem.facets[0];
    const issues = await jira.search(
      `project = "${projectKey}" AND (${this.jqlFor(problem.code, facets)}) ORDER BY created DESC`,
      10
    );
    const unlinked = await this.unlinkedKeys(
      projectId,
      issues.map((issue) => issue.key)
    );
    return issues.filter(
      (issue) => !unlinked.has(issue.key) && (issue.done || this.isBugOf(issue, problem.code, facets))
    );
  }

  private async bugContext(testRun: TestRun, problem: RunProblem, title: string | null) {
    const device = [testRun.device, testRun.os, testRun.viewport, testRun.browser].filter(Boolean).join(' · ');
    const url = `${process.env.APP_FRONTEND_URL}/${testRun.projectId}?buildId=${testRun.buildId}&testId=${testRun.id}`;
    return {
      ...bugText({ violations: problem.violations, testName: testRun.name, title, device, url, problem }),
      labels: [...BUG_LABELS, ...problemMarkers(problem.code, problem.facets[0])],
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

  /** What Vision has decided on a problem already, maybe a colleague a moment ago. */
  private existing(problem: RunProblem) {
    const row = problem.deciding;
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
   * the problem is filed already: in Vision, or in Jira by its id or markers.
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
    const { problems, title } = await this.problemsOf(testRun, violationIds);
    const problem = this.single(problems);
    const { jira, issueType: configuredType, linkType: configuredLink } = await this.jiraFor(testRun.projectId, userId);
    return this.jiraCall(async () => {
      const parent = await jira.getIssue(parentKey.trim().toUpperCase());
      const [issueTypes, linkTypes, inJira] = await Promise.all([
        jira.issueTypes(parent.projectKey),
        jira.linkTypes().catch(() => []),
        this.findInJira(jira, testRun.projectId, parent.projectKey, problem).catch((error) => {
          this.logger.warn(`Jira search for ${problem.code} failed: ${error}`);
          return [] as JiraFoundIssue[];
        }),
      ]);
      const chosen =
        (issueTypeId && issueTypes.find((type) => type.id === issueTypeId)) ||
        defaultIssueType(issueTypes, configuredType);
      if (!chosen) throw new BadRequestException(`Project ${parent.projectKey} offers no issue type to create`);
      const text = await this.bugContext(testRun, problem, title);
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
        markers: text.labels.filter((label) => !BUG_LABELS.includes(label)),
        existing: this.existing(problem),
        inJira,
      };
    });
  }

  /**
   * Claims a problem for filing: one row per problem key and project, so of
   * two people filing it at once only one gets it. A claim left by a filing
   * that died is taken over after a while.
   */
  private async claim(
    testRun: TestRun,
    problem: RunProblem,
    title: string | null,
    userId?: string
  ): Promise<{ claim: A11yProblem } | { taken: A11yProblem }> {
    if (problem.deciding) return { taken: problem.deciding };
    const where = { projectId_key: { projectId: testRun.projectId, key: problem.key } };
    try {
      const claim = await this.prismaService.a11yProblem.create({
        data: {
          projectId: testRun.projectId,
          key: problem.key,
          code: problem.code,
          rule: problem.facets[0].rule,
          facets: dedupeFacets(problem.facets) as unknown as Prisma.InputJsonValue,
          status: 'filing',
          screenName: testRun.name,
          screenTitle: title,
          userId,
        },
      });
      this.forget(testRun.projectId);
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
    if (count) this.forget(testRun.projectId);
    return count ? { claim: await this.prismaService.a11yProblem.findUnique({ where }) } : { taken };
  }

  /**
   * Files a bug for the problem in Jira under the given task: as its sub-task
   * when the issue type is one, else linked to it. Unless it is filed already:
   * in Vision (by someone else, maybe a moment ago), or in Jira under the
   * problem's id or markers, in which case that bug is linked instead.
   * Screen, service, actual and expected result, device and element are
   * filled in; the problem's id goes into the summary and description and its
   * markers into the labels; the task's assignee takes it, and the screenshot
   * is attached with the elements outlined.
   */
  async fileBug(
    testRunId: string,
    violationIds: string[],
    options: { parentKey: string; issueTypeId?: string; linkType?: string; fieldValues?: Record<string, unknown> },
    userId?: string
  ): Promise<{ jiraKey: string; jiraUrl: string | null; code: string; alreadyFiled: boolean; warnings: string[] }> {
    const testRun = await this.loadRun(testRunId);
    const { problems, title } = await this.problemsOf(testRun, violationIds);
    const problem = this.single(problems);
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
          code: taken.code,
          alreadyFiled: true,
          warnings: [`${taken.code} was filed already as ${taken.jiraKey} (screen “${where}”); nothing new was filed`],
        };
      }
      throw new ConflictException(
        taken.status === 'filing'
          ? `A bug for ${taken.code} is being filed right now from screen “${where}”. Refresh in a minute.`
          : `${taken.code} is marked as a false positive on screen “${where}”. Restore it to file a bug.`
      );
    }
    const release = () =>
      this.prismaService.a11yProblem
        .deleteMany({ where: { id: claimed.claim.id, status: 'filing' } })
        .then(() => this.forget(testRun.projectId))
        .catch(() => 0);
    const finish = async (jiraKey: string, jiraUrl: string | null, action: A11yDecisionAction) => {
      await this.prismaService.a11yProblem.update({
        where: { id: claimed.claim.id },
        data: { status: 'reported', jiraKey, jiraUrl, comment: null },
      });
      this.forget(testRun.projectId);
      await this.record(testRun.projectId, {
        problemId: claimed.claim.id,
        code: problem.code,
        action,
        jiraKey,
        screenName: testRun.name,
        userId,
      });
      await this.prismaService.a11yIssueState.deleteMany({
        where: { projectId: testRun.projectId, screenName: testRun.name, violationId: { in: violationIds } },
      });
      await this.refreshCounts(testRun);
    };

    try {
      const parent = await this.jiraCall(() => jira.getIssue(options.parentKey.trim().toUpperCase()));
      const warnings: string[] = [];
      const found = await this.findInJira(jira, testRun.projectId, parent.projectKey, problem).catch((error) => {
        warnings.push(`Could not check Jira for ${problem.code}: ${error.message}`);
        return [] as JiraFoundIssue[];
      });
      const open = found.find((issue) => !issue.done);
      if (open) {
        await finish(open.key, open.url, 'found');
        const warning = await this.mirror(
          jira,
          open.key,
          'linked',
          problem.code,
          problemMarkers(problem.code, problem.facets[0])
        );
        return {
          jiraKey: open.key,
          jiraUrl: open.url,
          code: problem.code,
          alreadyFiled: true,
          warnings: [
            `Jira has ${open.key} (${open.status}) for ${problem.code}: linked instead of filing a new one`,
            ...(warning ? [warning] : []),
          ],
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
              problem.violations.map((violation) => violation.bounds)
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
        const text = await this.bugContext(testRun, problem, title);
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
          await jira.editLabels(issue.key, { add: text.labels }).catch((error) => {
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
      await finish(created.key, created.url, 'filed');
      return { jiraKey: created.key, jiraUrl: created.url, code: problem.code, alreadyFiled: false, warnings };
    } catch (error) {
      await release();
      throw error;
    }
  }

  /** Gives problems stored before facts were kept the facts their key says. */
  async fillFacets(): Promise<number> {
    const rows = await this.prismaService.a11yProblem.findMany({ where: { facets: { equals: Prisma.DbNull } } });
    for (const row of rows) {
      const facets = facetsFromKey(row.key);
      await this.prismaService.a11yProblem.update({
        where: { id: row.id },
        data: { rule: facets.rule, facets: [facets] as unknown as Prisma.InputJsonValue },
      });
    }
    this.indexes.clear();
    return rows.length;
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
      const facets = facetsOf(violation, context.screen);
      const key = problemKeyOf(facets);
      const exists = await this.prismaService.a11yProblem.findUnique({
        where: { projectId_key: { projectId: state.projectId, key } },
      });
      if (!exists) {
        const code = problemCode(state.projectId, key);
        const problem = await this.prismaService.a11yProblem.create({
          data: {
            projectId: state.projectId,
            key,
            code,
            rule: facets.rule,
            facets: [facets] as unknown as Prisma.InputJsonValue,
            status: state.status,
            jiraKey: state.jiraKey,
            jiraUrl: state.jiraUrl,
            comment: state.comment,
            screenName: state.screenName,
            screenTitle: context.title,
            userId: state.userId,
          },
        });
        await this.record(state.projectId, {
          problemId: problem.id,
          code,
          action: state.status === 'ignored' ? 'ignored' : 'linked',
          jiraKey: state.jiraKey,
          screenName: state.screenName,
          comment: 'Moved from a decision of an earlier version',
          userId: state.userId,
        });
      }
      await this.prismaService.a11yIssueState.delete({ where: { id: state.id } });
      moved++;
    }
    this.indexes.clear();
    if (moved) this.logger.log(`Moved ${moved} accessibility decisions to problems`);
    return moved;
  }
}
