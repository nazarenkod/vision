import { functionalBlock } from '../a11y/jira-bug';

/** Every bug from the comparison carries it, as accessibility bugs do: filed through Vision. */
export const VISUAL_BUG_LABELS = ['vision'];

export const CHECKPOINT_FILE = 'checkpoint.png';
export const BASELINE_FILE = 'baseline.png';

const MAX_SUMMARY = 250;
const MAX_FEATURE = 60;

/** One marked area of the checkpoint, numbered as the person marked it. */
export interface BugMark {
  n: number;
  x: number;
  y: number;
  width: number;
  height: number;
  // the element's key when the mark was picked from the UI tree
  element?: string;
}

/**
 * The feature a bug is about: what the test sent, else the check's name up to
 * its first dot, as the team names checks "Feature. Screen".
 */
export function featureOf(run: { featureName?: string | null; name: string }): string {
  return run.featureName?.trim() || functionalBlock(run.name);
}

/**
 * `[Automation] [feature] essence`, at most 250 characters. The prefix stays
 * whole, so the essence is what gets cut; brackets in the feature would end
 * its tag early, so they become parentheses.
 */
export function bugSummary(feature: string, essence: string): string {
  const tag = feature.replace(/\[/g, '(').replace(/\]/g, ')').trim().slice(0, MAX_FEATURE).trim();
  const prefix = `[Automation] [${tag}] `;
  return (prefix + essence.trim().replace(/\s+/g, ' ')).slice(0, MAX_SUMMARY).trim();
}

/**
 * Where it was found, from what the run knows, and the team's note that a UI
 * problem shows on every device: the person may still change it.
 */
export function environmentText(run: {
  os?: string | null;
  device?: string | null;
  browser?: string | null;
  viewport?: string | null;
}): string {
  // the device the problem was seen on, its OS beside it; the build is in the
  // description's own line and the link back, not here
  const os = run.os?.trim();
  const osLabel = os && /^\d/.test(os) ? `OS ${os}` : os;
  const what = run.device || [run.browser, run.viewport].filter(Boolean).join(', ');
  const where = what ? `${what}${osLabel ? ` (${osLabel})` : ''}` : osLabel;
  return where
    ? `Проблема виявлена на ${where} і потенційно відтворюється на всіх девайсах.`
    : 'Проблема потенційно відтворюється на всіх девайсах.';
}

/** The description as Jira wiki markup, in the team's order of sections. */
export function bugDescription(input: {
  environment: string;
  steps: string;
  actual: string;
  expected: string;
  // false for a new check with no baseline yet
  hasBaseline: boolean;
  check: { name: string; customTags?: string | null };
  build: { number?: number | null } | null;
  url: string;
}): string {
  const check = input.check.customTags ? `${input.check.name} (${input.check.customTags})` : input.check.name;
  return [
    'h3. Оточення',
    input.environment.trim(),
    '',
    'h3. Кроки',
    input.steps.trim(),
    '',
    'h3. Фактичний результат',
    input.actual.trim(),
    `!${CHECKPOINT_FILE}|thumbnail!`,
    '',
    'h3. Очікуваний результат',
    input.expected.trim(),
    ...(input.hasBaseline ? [`!${BASELINE_FILE}|thumbnail!`] : []),
    '',
    '----',
    `Перевірка: ${check}${input.build?.number ? ` · збірка #${input.build.number}` : ''}`,
    `[Відкрити у Vision|${input.url}]`,
  ].join('\n');
}

/** Marks as stored: numbered from 1 in the order given, whole pixels, nothing else. */
export function normalizeMarks(marks: Array<Partial<BugMark>> | undefined): BugMark[] {
  return (marks ?? [])
    .filter((mark) => mark && mark.width > 0 && mark.height > 0)
    .map((mark, index) => ({
      n: index + 1,
      x: Math.round(mark.x ?? 0),
      y: Math.round(mark.y ?? 0),
      width: Math.round(mark.width),
      height: Math.round(mark.height),
      ...(mark.element ? { element: String(mark.element) } : {}),
    }));
}
