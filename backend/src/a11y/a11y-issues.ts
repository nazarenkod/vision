import { A11yIssueState } from '@prisma/client';
import { A11yReport, A11yViolation } from './a11y.types';

export type A11yIssueStatus = 'reported' | 'ignored';

export interface A11yIssueInfo {
  status: A11yIssueStatus;
  jiraKey?: string | null;
  jiraUrl?: string | null;
  comment?: string | null;
}

/** A bug filed for the same problem (same rule, same component) on another screen. */
export interface KnownBug {
  jiraKey: string | null;
  jiraUrl: string | null;
  screenName: string;
}

type ReportViolation = A11yReport['violations'][number] & {
  issue?: A11yIssueInfo;
  // the problem it is: same rule on the same component, wherever it shows
  group: string;
  knownBug?: KnownBug;
};

/**
 * The component an element belongs to, from its key: the part of a Compose
 * test tag after "#" (…#PbButton), a resource id without its index (tab_0,
 * tab_1 → tab), else the element class. Elements of one component share the
 * fix, so their issues are one problem.
 */
export function componentOf(elementKey: string): string {
  const key = elementKey.replace(/#\d+$/, '');
  const [kind, ...rest] = key.split(':');
  const value = rest.join(':');
  if (kind === 'id') {
    const tag = value.includes('#') ? value.slice(value.lastIndexOf('#') + 1) : value.replace(/^.*:id\//, '');
    return tag.replace(/[_-]?\d+$/, '') || tag;
  }
  if (kind === 'path') {
    const last = value.split('/').pop() ?? value;
    return last.replace(/\[\d+\]$/, '').replace(/^.*\./, '');
  }
  // Class:text — the class says what kind of element it is
  return kind;
}

/** Identity of a problem: the rule and the component, from an issue id (rule|elementKey). */
export function problemOf(violationId: string): string {
  const index = violationId.indexOf('|');
  return index < 0 ? violationId : `${violationId.slice(0, index)}|${componentOf(violationId.slice(index + 1))}`;
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

const info = (state: A11yIssueState): A11yIssueInfo => ({
  status: state.status as A11yIssueStatus,
  jiraKey: state.jiraKey,
  jiraUrl: state.jiraUrl,
  comment: state.comment,
});

/**
 * Applies the screen's issue states to a stored report. Bugs filed anywhere in
 * the project for the same problem mark the issue as known: it is not new,
 * and the review offers to link it instead of filing a duplicate.
 */
export function reviewReport(
  report: A11yReport,
  states: A11yIssueState[],
  projectReported: A11yIssueState[] = []
): ReviewedA11yReport {
  const byId = new Map(states.map((state) => [state.violationId, state]));
  const bugByProblem = new Map<string, KnownBug>();
  // a bug of this screen first, then the oldest one elsewhere
  for (const state of [...states, ...projectReported]) {
    if (state.status !== 'reported' || !state.jiraKey) continue;
    const problem = problemOf(state.violationId);
    if (!bugByProblem.has(problem)) {
      bugByProblem.set(problem, { jiraKey: state.jiraKey, jiraUrl: state.jiraUrl, screenName: state.screenName });
    }
  }
  const violations: ReportViolation[] = [];
  const ignored: ReportViolation[] = [];
  for (const violation of report.violations) {
    const state = byId.get(violation.id);
    const group = problemOf(violation.id);
    const knownBug = state ? undefined : bugByProblem.get(group);
    const item: ReportViolation = {
      ...violation,
      group,
      ...(state ? { issue: info(state) } : {}),
      ...(knownBug ? { knownBug } : {}),
    };
    (state?.status === 'ignored' ? ignored : violations).push(item);
  }
  const present = new Set(report.violations.map((v) => v.id));
  const resolved = states
    .filter((state) => state.status === 'reported' && !present.has(state.violationId))
    .map((state) => ({ violationId: state.violationId, jiraKey: state.jiraKey, jiraUrl: state.jiraUrl }));

  // advice (severity info) is shown but never counted
  const counted = violations.filter((v) => v.severity !== 'info');
  // a problem with a bug filed on another screen is tracked already
  const untracked = counted.filter((v) => !v.issue && !v.knownBug);
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
