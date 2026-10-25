import { createHash } from 'crypto';
import { A11yRule, A11yViolation } from './a11y.types';
import { UiNode, UiTree } from '../ui-tree/ui-tree.types';
import { matchesSelector, parseSelector } from '../ui-tree/comparison-inputs';

/**
 * When two issues are the same problem, per rule:
 * - component-value: same component id and the same measured values (a 38 × 38 dp
 *   tap area everywhere is one problem; 38 × 40 on another screen is another);
 * - component: same component id, whatever the values;
 * - screen: never across screens; one problem per element id on a screen.
 * Elements without an id are always problems of their own screen.
 */
export type DuplicateMode = 'component-value' | 'component' | 'screen';

export const DEFAULT_DUPLICATE_MODES: Record<A11yRule, DuplicateMode> = {
  'touch-target': 'component-value',
  'low-contrast': 'component-value',
  'missing-label': 'component',
  'input-without-label': 'component',
  'redundant-role': 'component',
  'not-accessible': 'component',
  // two controls announced alike is about what else is on that screen
  'duplicate-label': 'screen',
};

export const DEFAULT_SCREEN_TITLE_SELECTORS = ['id:Appbar#Title'];

/**
 * A class of problems the project defines: which issues it takes (rules and
 * a pattern on the element id) and what they are — how duplicates are told,
 * which part of the id is the component, and whether bugs are filed for them
 * or they are ignored. The first class that takes an issue wins.
 */
export interface ProblemClass {
  id: string;
  name: string;
  // rules it takes; empty or absent for every rule
  rules?: string[];
  // the element id (resource id or Compose tag; for elements without one, Class:text):
  // a glob with * and ?, or /regex/ — a group in the regex is the component id
  match: string;
  // how duplicates are told; the rule's setting when absent
  mode?: DuplicateMode;
  // report: found and filed as usual; ignore: listed with the false positives, never counted or filed
  action?: 'report' | 'ignore';
}

export interface ProblemSettings {
  duplicateModes?: Partial<Record<string, DuplicateMode>>;
  classes?: ProblemClass[];
}

const patterns = new Map<string, RegExp | null>();

/** A class pattern as a regex: /regex/flags as written, else a whole-id glob; null when it does not compile. */
export function compilePattern(pattern: string): RegExp | null {
  if (!patterns.has(pattern)) {
    let compiled: RegExp | null = null;
    try {
      const regex = /^\/(.+)\/([a-z]*)$/s.exec(pattern.trim());
      if (regex) {
        compiled = new RegExp(regex[1], regex[2].replace(/[^imsu]/g, ''));
      } else {
        const glob = pattern
          .trim()
          .replace(/[.+^$(){}|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        compiled = new RegExp(`^${glob}$`, 'i');
      }
    } catch {
      compiled = null;
    }
    if (patterns.size > 1000) patterns.clear();
    patterns.set(pattern, compiled);
  }
  return patterns.get(pattern);
}

/** What a class pattern is matched against: the element id, else the element key. */
export const matchTargetOf = (violation: Pick<A11yViolation, 'nodeKey'>): string =>
  violation.nodeKey.startsWith('id:') ? violation.nodeKey.slice(3).replace(/#\d+$/, '') : violation.nodeKey;

/** The class that takes an issue, and the component its pattern captured, if any. */
export function classOf(
  violation: Pick<A11yViolation, 'rule' | 'nodeKey'>,
  classes: ProblemClass[] = []
): { problemClass: ProblemClass; component: string | null } | null {
  const target = matchTargetOf(violation);
  for (const problemClass of classes) {
    if (problemClass.rules?.length && !problemClass.rules.includes(violation.rule)) continue;
    const match = problemClass.match ? compilePattern(problemClass.match)?.exec(target) : null;
    if (!match) continue;
    return { problemClass, component: match[1]?.trim() || null };
  }
  return null;
}

/**
 * The component id of an element, from its key, or null when it has none:
 * the part of a Compose test tag after "#" (…#PbButton), else the resource id
 * without its package. Elements of a screen with the same id are told apart
 * by "#1", "#2"…, which is dropped: they are the same component.
 */
export function componentOf(elementKey: string): string | null {
  if (!elementKey.startsWith('id:')) return null;
  const id = elementKey.slice(3).replace(/#\d+$/, '');
  const component = id.includes('#') ? id.slice(id.lastIndexOf('#') + 1) : id.replace(/^.*:id\//, '');
  return component.trim() || null;
}

/** What the rule measured, where it measures: the values a problem is the same with. */
export function measurementOf(violation: Pick<A11yViolation, 'rule' | 'details'>): string {
  const details = violation.details ?? {};
  if (violation.rule === 'touch-target' && details.widthDp !== undefined) {
    return `${Math.round(Number(details.widthDp))}x${Math.round(Number(details.heightDp))}`;
  }
  if (violation.rule === 'low-contrast' && details.ratio !== undefined) return Number(details.ratio).toFixed(1);
  return '';
}

export function duplicateModeOf(rule: A11yRule, settings: ProblemSettings = {}): DuplicateMode {
  const mode = settings.duplicateModes?.[rule];
  return mode === 'component-value' || mode === 'component' || mode === 'screen'
    ? mode
    : (DEFAULT_DUPLICATE_MODES[rule] ?? 'screen');
}

/** Identity of the problem an issue is, by the project's settings. */
export function problemKeyOf(
  violation: Pick<A11yViolation, 'rule' | 'nodeKey' | 'details'>,
  screen: string,
  settings: ProblemSettings = {}
): string {
  const taken = classOf(violation, settings.classes);
  const mode = taken?.problemClass.mode ?? duplicateModeOf(violation.rule, settings);
  const component = taken?.component ?? componentOf(violation.nodeKey);
  const measured = measurementOf(violation);
  if (component && mode !== 'screen') {
    return `${violation.rule}|c:${component}|${mode === 'component-value' ? measured : ''}`;
  }
  return component
    ? `${violation.rule}|s:${screen}|c:${component}|${measured}`
    : `${violation.rule}|s:${screen}|e:${violation.nodeKey}`;
}

/**
 * The problem's id as people see it in Vision and in Jira (summary, label,
 * description): short, stable for the project, searchable as one word.
 */
export function problemCode(projectId: string, key: string): string {
  return `a11y-${createHash('sha1').update(`${projectId}\n${key}`).digest('hex').slice(0, 8)}`;
}

/** The component a problem is about, from its key, if it is a component problem. */
export function problemComponent(key: string): string | null {
  const match = /\|c:([^|]+)\|/.exec(key);
  return match ? match[1] : null;
}

/** Problems that hold on every screen with the component, rather than on one screen. */
export const isComponentProblem = (key: string) => /^[^|]+\|c:/.test(key);

const textOf = (tree: UiTree, node: UiNode, selectorValue: string): string | null => {
  // a content description that is the tag itself is not the title
  const tagged = node.label.toLowerCase() === selectorValue.toLowerCase();
  const own = [node.text, tagged ? '' : node.label].find((value) => value?.trim());
  if (own) return own.trim();
  // the tag can sit on a container whose child holds the text
  const child = tree.nodes.find((item) => item.parent === node.index && (item.text || item.label));
  return child ? (child.text || child.label).trim() : null;
};

/**
 * The screen's own title from the UI tree, by the project's selectors (first
 * match wins): `id:Appbar#Title` (a resource id or a content description),
 * `class:…`, `text:…` or `text:/regex/`. Null when none matches.
 */
export function screenTitle(tree: UiTree | null, selectors: string[] = DEFAULT_SCREEN_TITLE_SELECTORS): string | null {
  if (!tree) return null;
  for (const raw of selectors) {
    const selector = parseSelector(raw.includes(':') ? raw : `id:${raw}`);
    if (!selector) continue;
    const value = typeof selector.value === 'string' ? selector.value : '';
    const node = tree.nodes.find(
      (item) =>
        matchesSelector(item, selector) ||
        (selector.by === 'id' && !!item.label && item.label.toLowerCase() === value.toLowerCase())
    );
    const title = node ? textOf(tree, node, value) : null;
    if (title) return title;
  }
  return null;
}
