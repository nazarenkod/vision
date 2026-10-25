import { A11yIssueState, A11yProblem } from '@prisma/client';
import { A11yReport } from './a11y.types';
import { classOf, problemCode, problemKeyOf, ProblemSettings } from './a11y-problems';

export type A11yIssueStatus = 'reported' | 'ignored';
// a bug for the problem is being created right now
export type A11yProblemStatus = A11yIssueStatus | 'filing';

export interface A11yIssueInfo {
  status: A11yProblemStatus;
  jiraKey?: string | null;
  jiraUrl?: string | null;
  comment?: string | null;
  // set when it was decided on another check: the problem of a component holds on every screen
  screenName?: string;
  screenTitle?: string | null;
  // ignored by the project's problem class of this name, not by a decision
  byClass?: string;
}

type ReportViolation = A11yReport['violations'][number] & {
  issue?: A11yIssueInfo;
  // the problem it is (a11y-problems problemKeyOf), and its id as people see it
  group: string;
  problemCode: string;
  // the project's problem class that took it
  problemClass?: string;
};

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
  // decisions on problems: those of this report's problems, and those made on this screen
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

const fromProblem = (problem: A11yProblem, screenName: string): A11yIssueInfo => ({
  status: problem.status as A11yProblemStatus,
  jiraKey: problem.jiraKey,
  jiraUrl: problem.jiraUrl,
  comment: problem.comment,
  ...(problem.screenName !== screenName ? { screenName: problem.screenName, screenTitle: problem.screenTitle } : {}),
});

/**
 * Applies the team's decisions to a stored report. Each issue is a problem by
 * the project's duplicate settings; a problem filed or marked as a false
 * positive anywhere covers it on every screen it shows on. Decisions of old,
 * kept per issue, still apply on their screen.
 */
export function reviewReport(report: A11yReport, context: ReviewContext): ReviewedA11yReport {
  const byId = new Map((context.states ?? []).map((state) => [state.violationId, state]));
  const byKey = new Map((context.problems ?? []).map((problem) => [problem.key, problem]));
  const violations: ReportViolation[] = [];
  const ignored: ReportViolation[] = [];
  const keys = new Set<string>();
  for (const violation of report.violations) {
    const key = problemKeyOf(violation, context.screen, context.settings);
    keys.add(key);
    const own = byId.get(violation.id);
    const problem = byKey.get(key);
    const taken = classOf(violation, context.settings?.classes);
    const byClass: A11yIssueInfo | undefined =
      taken?.problemClass.action === 'ignore'
        ? { status: 'ignored', comment: `Class “${taken.problemClass.name}”`, byClass: taken.problemClass.name }
        : undefined;
    const issue = own ? fromState(own) : problem ? fromProblem(problem, context.screenName) : byClass;
    const item: ReportViolation = {
      ...violation,
      group: key,
      problemCode: problemCode(context.projectId, key),
      ...(taken ? { problemClass: taken.problemClass.name } : {}),
      ...(issue ? { issue } : {}),
    };
    (issue?.status === 'ignored' ? ignored : violations).push(item);
  }
  const present = new Set(report.violations.map((v) => v.id));
  const resolved = [
    ...(context.states ?? [])
      .filter((state) => state.status === 'reported' && !present.has(state.violationId))
      .map((state) => ({ violationId: state.violationId, jiraKey: state.jiraKey, jiraUrl: state.jiraUrl })),
    // a problem filed from this screen that the screen no longer has
    ...(context.problems ?? [])
      .filter(
        (problem) =>
          problem.status === 'reported' && problem.screenName === context.screenName && !keys.has(problem.key)
      )
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
