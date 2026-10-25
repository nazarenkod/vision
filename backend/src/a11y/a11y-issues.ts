import { A11yIssueState, A11yProblem } from '@prisma/client';
import { A11yReport } from './a11y.types';
import {
  classOf,
  facetsFromKey,
  facetsOf,
  problemCode,
  problemKeyOf,
  ProblemFacets,
  ProblemSettings,
} from './a11y-problems';

export type A11yIssueStatus = 'reported' | 'ignored';
// a bug for the problem is being created right now
export type A11yProblemStatus = A11yIssueStatus | 'filing';

export interface A11yIssueInfo {
  status: A11yProblemStatus;
  jiraKey?: string | null;
  jiraUrl?: string | null;
  comment?: string | null;
  // set when it was decided on another check: a component's problem holds on every screen
  screenName?: string;
  screenTitle?: string | null;
  // ignored by the project's problem class of this name, not by a decision
  byClass?: string;
  // other bugs of the same problem, when the settings now see several problems as one
  related?: Array<{ code: string; jiraKey: string | null; jiraUrl: string | null }>;
}

type ReportViolation = A11yReport['violations'][number] & {
  issue?: A11yIssueInfo;
  // the problem it is under the current settings, and its id as people see it
  group: string;
  problemCode: string;
  // the project's problem class that took it
  problemClass?: string;
};

/** Stored problems by what they are under the current settings. */
export type ProblemIndex = Map<string, A11yProblem[]>;

/** The facts a stored problem was decided for; read from its key when it predates facts. */
export function storedFacets(problem: Pick<A11yProblem, 'key' | 'facets'>): ProblemFacets[] {
  const facets = Array.isArray(problem.facets) ? (problem.facets as unknown as ProblemFacets[]) : [];
  return facets.length ? facets : [facetsFromKey(problem.key)];
}

/**
 * Indexes stored problems by what each of their occurrences is under the
 * given settings. Settings that now see two problems as one put both under
 * one key; settings that split one put it under several.
 */
export function indexProblems(problems: A11yProblem[], settings: ProblemSettings = {}): ProblemIndex {
  const index: ProblemIndex = new Map();
  for (const problem of problems) {
    for (const key of new Set(storedFacets(problem).map((facets) => problemKeyOf(facets, settings)))) {
      index.set(key, [...(index.get(key) ?? []), problem]);
    }
  }
  return index;
}

/** The problem that decides for an issue among those matching it: one of this screen, else the oldest. */
export function decidingProblem(matching: A11yProblem[], screenName: string): A11yProblem | undefined {
  return [...matching].sort(
    (a, b) =>
      Number(b.screenName === screenName) - Number(a.screenName === screenName) ||
      a.createdAt.getTime() - b.createdAt.getTime()
  )[0];
}

/** Where a report is reviewed: the screen, the project's settings and decisions. */
export interface ReviewContext {
  projectId: string;
  // the check's name, where decisions of old were kept
  screenName: string;
  // the screen's identity for problems that are not about a component: its title, else the check's name
  screen: string;
  settings?: ProblemSettings;
  // decisions of old, per issue of this screen
  states?: A11yIssueState[];
  // the project's problems, indexed under the current settings (built from problems when absent)
  index?: ProblemIndex;
  problems?: A11yProblem[];
}

/** A report with the team's decisions applied: filed bugs, false positives, bugs that can be closed. */
export interface ReviewedA11yReport extends Omit<A11yReport, 'violations' | 'summary'> {
  violations: ReportViolation[];
  // false positives: listed, never counted
  ignored: ReportViolation[];
  // a bug was filed for these but the issue is no longer found on this screen
  resolved: Array<{ violationId: string; jiraKey: string | null; jiraUrl: string | null }>;
  summary: {
    // new and nobody has acted on it yet: what fails a build
    new: number;
    existing: number;
    reported: number;
    ignored: number;
    fixed: number;
    total: number;
  };
}

const fromState = (state: A11yIssueState): A11yIssueInfo => ({
  status: state.status as A11yIssueStatus,
  jiraKey: state.jiraKey,
  jiraUrl: state.jiraUrl,
  comment: state.comment,
});

const fromProblem = (problem: A11yProblem, others: A11yProblem[], screenName: string): A11yIssueInfo => {
  const related = others
    .filter((other) => other.id !== problem.id && other.status === 'reported')
    .map((other) => ({ code: other.code, jiraKey: other.jiraKey, jiraUrl: other.jiraUrl }));
  return {
    status: problem.status as A11yProblemStatus,
    jiraKey: problem.jiraKey,
    jiraUrl: problem.jiraUrl,
    comment: problem.comment,
    ...(problem.screenName !== screenName ? { screenName: problem.screenName, screenTitle: problem.screenTitle } : {}),
    ...(related.length ? { related } : {}),
  };
};

/**
 * Applies the team's decisions to a stored report. Each issue is matched
 * with the project's problems under the current settings; a problem filed or
 * marked as a false positive anywhere covers it on every screen it shows on,
 * and keeps its id whatever the settings become. Decisions of old, kept per
 * issue, still apply on their screen.
 */
export function reviewReport(report: A11yReport, context: ReviewContext): ReviewedA11yReport {
  const byId = new Map((context.states ?? []).map((state) => [state.violationId, state]));
  const index = context.index ?? indexProblems(context.problems ?? [], context.settings);
  const violations: ReportViolation[] = [];
  const ignored: ReportViolation[] = [];
  const matched = new Set<string>();
  for (const violation of report.violations) {
    const facets = facetsOf(violation, context.screen);
    const key = problemKeyOf(facets, context.settings);
    const own = byId.get(violation.id);
    const matching = index.get(key) ?? [];
    const problem = decidingProblem(matching, context.screenName);
    matching.forEach((item) => matched.add(item.id));
    const taken = classOf(facets, context.settings?.classes);
    const byClass: A11yIssueInfo | undefined =
      taken?.problemClass.action === 'ignore'
        ? { status: 'ignored', comment: `Class “${taken.problemClass.name}”`, byClass: taken.problemClass.name }
        : undefined;
    const issue = own ? fromState(own) : problem ? fromProblem(problem, matching, context.screenName) : byClass;
    const item: ReportViolation = {
      ...violation,
      group: key,
      problemCode: problem?.code ?? problemCode(context.projectId, key),
      ...(taken ? { problemClass: taken.problemClass.name } : {}),
      ...(issue ? { issue } : {}),
    };
    (issue?.status === 'ignored' ? ignored : violations).push(item);
  }
  const present = new Set(report.violations.map((v) => v.id));
  const decidedHere = new Map<string, A11yProblem>();
  for (const list of index.values()) {
    for (const problem of list) {
      if (problem.screenName === context.screenName && problem.status === 'reported')
        decidedHere.set(problem.id, problem);
    }
  }
  const resolved = [
    ...(context.states ?? [])
      .filter((state) => state.status === 'reported' && !present.has(state.violationId))
      .map((state) => ({ violationId: state.violationId, jiraKey: state.jiraKey, jiraUrl: state.jiraUrl })),
    // a problem filed from this screen that the screen no longer has
    ...[...decidedHere.values()]
      .filter((problem) => !matched.has(problem.id))
      .map((problem) => ({ violationId: problem.code, jiraKey: problem.jiraKey, jiraUrl: problem.jiraUrl })),
  ];

  // advice (severity info) is shown but never counted
  const counted = violations.filter((v) => v.severity !== 'info');
  const untracked = counted.filter((v) => !v.issue);
  return {
    ...report,
    violations,
    ignored,
    resolved,
    summary: {
      new: untracked.filter((v) => v.status === 'new').length,
      existing: untracked.filter((v) => v.status === 'existing').length,
      reported: counted.length - untracked.length,
      ignored: ignored.length,
      fixed: report.summary.fixed,
      total: counted.length,
    },
  };
}
