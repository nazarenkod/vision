// Public report links (031, ADR-0022): how long they live, whether one still
// opens, and what a reader without an account gets to see. Pure, so the white
// list of fields is tested as it is.
import { randomBytes } from 'crypto';
import { TestStatus } from '@prisma/client';
import { BuildOverviewResponse } from '../builds/build-overview.service';

export const SECTIONS = ['sum', 'chg', 'bugs', 'dev', 'feat', 'a11y'] as const;
export type Section = (typeof SECTIONS)[number];
export type ReportLanguage = 'en' | 'uk';
// a report lists this many changed screenshots and counts the rest (REQ-031-44)
export const MAX_CHANGES = 20;

/** 32 random bytes: nothing about the build is in it, and guessing one is hopeless (REQ-031-67). */
export const newToken = (): string => randomBytes(32).toString('base64url');

export const sectionsOf = (input: unknown): Section[] => {
  const wanted = Array.isArray(input) ? input : [];
  const kept = SECTIONS.filter((section) => wanted.includes(section));
  return kept.length ? kept : ['sum', 'chg', 'bugs'];
};

export const languageOf = (input: unknown): ReportLanguage => (input === 'uk' ? 'uk' : 'en');

/** A link opens for as long as its build is kept; only revoking ends it (REQ-031-61). */
export const linkState = (link: { revokedAt: Date | null }): 'ok' | 'expired' => (link.revokedAt ? 'expired' : 'ok');

/** The run fields a report reads. */
export interface ReportRun {
  id: string;
  name: string;
  device: string | null;
  os: string | null;
  status: TestStatus;
  diffPercent: number | null;
  imageName: string;
  baselineName: string | null;
  diffName: string | null;
  a11yNewCount: number | null;
}

export interface PublicReport {
  state: 'ok' | 'expired' | 'gone';
  sections?: Section[];
  language?: ReportLanguage;
  createdBy?: string | null;
  overview?: Omit<BuildOverviewResponse, 'build' | 'a11y'> & {
    build: Pick<
      BuildOverviewResponse['build'],
      'id' | 'number' | 'branchName' | 'ciBuildId' | 'projectName' | 'createdAt' | 'updatedAt'
    > & {
      projectId: string;
    };
  };
  changes?: Array<{
    testRunId: string;
    name: string;
    device: string;
    os: string;
    status: string;
    diffPercent: number | null;
    imageName: string;
    baselineName: string | null;
    diffName: string | null;
  }>;
  moreChanges?: number;
  a11y?: Array<{ testRunId: string; name: string; device: string; os: string; newCount: number }>;
}

// the order of a report's changes: what waits first, new screens next, rejected last
const CHANGE_ORDER: TestStatus[] = [TestStatus.unresolved, TestStatus.new, TestStatus.failed];
/**
 * A screenshot the report shows: one that differs from its baseline and waits
 * or was rejected, or a new one with no baseline yet. The new ones wait too,
 * so leaving them out made the report count more than it showed.
 */
const shownAsChange = (run: ReportRun) =>
  run.status === TestStatus.new ||
  ((run.status === TestStatus.unresolved || run.status === TestStatus.failed) && !!run.baselineName);

/**
 * What a public report shows, field by field (REQ-031-62, -68): numbers,
 * screenshot names and people's names, nothing from accounts. Sections the
 * link leaves out are empty rather than hidden by the page.
 */
export function publicReport(
  overview: BuildOverviewResponse,
  runs: ReportRun[],
  link: { sections: Section[]; language: ReportLanguage; createdBy: string | null }
): PublicReport {
  const has = (section: Section) => link.sections.includes(section);
  const changed = runs
    .filter(shownAsChange)
    .sort(
      (a, b) =>
        CHANGE_ORDER.indexOf(a.status) - CHANGE_ORDER.indexOf(b.status) ||
        (b.diffPercent ?? 0) - (a.diffPercent ?? 0) ||
        a.name.localeCompare(b.name)
    );
  const a11y = runs
    .filter((run) => run.a11yNewCount)
    .sort((a, b) => (b.a11yNewCount ?? 0) - (a.a11yNewCount ?? 0) || a.name.localeCompare(b.name))
    .slice(0, MAX_CHANGES);
  return {
    state: 'ok',
    sections: link.sections,
    language: link.language,
    createdBy: link.createdBy,
    overview: {
      verdict: overview.verdict,
      counts: overview.counts,
      progress: {
        decided: overview.progress.decided,
        needed: overview.progress.needed,
        people: overview.progress.people.map(({ name, approved, rejected }) => ({ name, approved, rejected })),
      },
      // kept whatever the sections: the header counts the devices
      devices: overview.devices,
      features: has('feat') ? overview.features : [],
      quietFeatures: has('feat') ? overview.quietFeatures : { count: 0, screens: 0, features: [] },
      bugs: has('bugs')
        ? overview.bugs.map(({ kind, jiraKey, jiraUrl, summary, testRunId, isNew }) => ({
            kind,
            jiraKey,
            jiraUrl,
            summary,
            testRunId,
            isNew,
          }))
        : [],
      previous: overview.previous,
      build: {
        id: overview.build.id,
        number: overview.build.number,
        branchName: overview.build.branchName,
        ciBuildId: overview.build.ciBuildId,
        projectId: overview.build.projectId,
        projectName: overview.build.projectName,
        createdAt: overview.build.createdAt,
        updatedAt: overview.build.updatedAt,
      },
      asOf: overview.asOf,
    },
    changes: has('chg')
      ? changed.slice(0, MAX_CHANGES).map((run) => ({
          testRunId: run.id,
          name: run.name,
          device: run.device ?? '',
          os: run.os ?? '',
          status: run.status,
          diffPercent: run.diffPercent,
          imageName: run.imageName,
          baselineName: run.baselineName,
          diffName: run.diffName,
        }))
      : [],
    moreChanges: has('chg') ? Math.max(0, changed.length - MAX_CHANGES) : 0,
    a11y: has('a11y')
      ? a11y.map((run) => ({
          testRunId: run.id,
          name: run.name,
          device: run.device ?? '',
          // the device shows as tags, the OS next to its model (spec 037)
          os: run.os ?? '',
          newCount: run.a11yNewCount ?? 0,
        }))
      : [],
  };
}
