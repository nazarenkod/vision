import { A11yIssueState } from '@prisma/client';
import { A11yReport, A11yViolation } from './a11y.types';

export type A11yIssueStatus = 'reported' | 'ignored';

export interface A11yIssueInfo {
  status: A11yIssueStatus;
  jiraKey?: string | null;
  jiraUrl?: string | null;
  comment?: string | null;
}

type ReportViolation = A11yReport['violations'][number] & { issue?: A11yIssueInfo };

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

/** Applies the screen's issue states to a stored report. */
export function reviewReport(report: A11yReport, states: A11yIssueState[]): ReviewedA11yReport {
  const byId = new Map(states.map((state) => [state.violationId, state]));
  const violations: ReportViolation[] = [];
  const ignored: ReportViolation[] = [];
  for (const violation of report.violations) {
    const state = byId.get(violation.id);
    const item = state ? { ...violation, issue: info(state) } : violation;
    (state?.status === 'ignored' ? ignored : violations).push(item);
  }
  const present = new Set(report.violations.map((v) => v.id));
  const resolved = states
    .filter((state) => state.status === 'reported' && !present.has(state.violationId))
    .map((state) => ({ violationId: state.violationId, jiraKey: state.jiraKey, jiraUrl: state.jiraUrl }));

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
