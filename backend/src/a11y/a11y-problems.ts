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
 * The same for every project (021): nobody set it per project, and nobody could tell how.
 */
export type DuplicateMode = 'component-value' | 'component' | 'screen';

export const DUPLICATE_MODES: Record<A11yRule, DuplicateMode> = {
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
 * What is known about one occurrence of a problem, independent of how
 * problems are told apart. Problems keep these, so when that changes, what is
 * one problem is worked out again from the facts, and ids and bugs stay.
 */
export interface ProblemFacets {
  rule: string;
  // the element id (resource id or Compose tag) without the "#1" of repeats; null without one
  element: string | null;
  // the element's identity on its screen (id:…, Class:text or path:…)
  nodeKey: string;
  // the component by the default reading of the id (…#PbButton → PbButton)
  component: string | null;
  // the screen's title, else the check's name
  screen: string;
  // what the rule measured (38x38, 3.1), empty where it measures nothing
  measure: string;
  className: string;
  label: string;
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

/** The facts of an issue on a screen. */
export function facetsOf(
  violation: Pick<A11yViolation, 'rule' | 'nodeKey' | 'details'> & Partial<Pick<A11yViolation, 'className' | 'label'>>,
  screen: string
): ProblemFacets {
  return {
    rule: violation.rule,
    element: violation.nodeKey.startsWith('id:') ? violation.nodeKey.slice(3).replace(/#\d+$/, '') : null,
    nodeKey: violation.nodeKey,
    component: componentOf(violation.nodeKey),
    screen,
    measure: measurementOf(violation),
    className: violation.className ?? '',
    label: violation.label ?? '',
  };
}

const modeOf = (rule: string): DuplicateMode => DUPLICATE_MODES[rule as A11yRule] ?? 'screen';

/**
 * Which problem an occurrence is. Worked out from the facts every time, for
 * issues and for stored problems alike, so a problem decided when problems
 * were told apart otherwise (by the per-project settings of 004) keeps its id
 * and bug in every part it now falls into.
 */
export function problemKeyOf(facets: ProblemFacets): string {
  const mode = modeOf(facets.rule);
  const { component } = facets;
  if (component && mode !== 'screen') {
    return `${facets.rule}|c:${component}|${mode === 'component-value' ? facets.measure : ''}`;
  }
  return component
    ? `${facets.rule}|s:${facets.screen}|c:${component}|${facets.measure}`
    : `${facets.rule}|s:${facets.screen}|e:${facets.nodeKey}`;
}

/**
 * The id a new problem gets, as people see it in Vision and in Jira (summary,
 * label, description): short, searchable as one word. Given once, at
 * creation, and kept whatever problems are later told apart by.
 */
export function problemCode(projectId: string, key: string): string {
  return `a11y-${createHash('sha1').update(`${projectId}\n${key}`).digest('hex').slice(0, 8)}`;
}

/** The component a problem key is about, if it is a component problem. */
export function problemComponent(key: string): string | null {
  const match = /\|c:([^|]+)\|/.exec(key);
  return match ? match[1] : null;
}

/** Problems that hold on every screen (a component's), rather than on one screen. */
export const isComponentProblem = (key: string) => /^[^|]+\|c:/.test(key);

/** A Jira label from free text: labels take no spaces. */
export const asLabel = (value: string) => value.replace(/[^\p{L}\p{N}_.-]+/gu, '_').slice(0, 100);

/**
 * Markers of a problem in Jira, as labels: its id, the rule, the component and
 * the measured values. Bugs are found by the id, or by the markers problems are
 * told apart with, so a bug filed by another Vision or by hand with the
 * markers is found too.
 */
export function problemMarkers(code: string, facets: ProblemFacets): string[] {
  return [
    code,
    `a11y-${facets.rule}`,
    ...(facets.component ? [asLabel(`a11y-component-${facets.component}`)] : []),
    ...(facets.measure ? [asLabel(`a11y-value-${facets.measure}`)] : []),
  ];
}

/**
 * The labels a bug of the same problem carries, all of which must be on it;
 * null when the problem is one screen's (found by its id only).
 */
export function markerQuery(facets: ProblemFacets): string[] | null {
  const mode = modeOf(facets.rule);
  if (!facets.component || mode === 'screen') return null;
  return [
    `a11y-${facets.rule}`,
    asLabel(`a11y-component-${facets.component}`),
    ...(mode === 'component-value' && facets.measure ? [asLabel(`a11y-value-${facets.measure}`)] : []),
  ];
}

/** The label a bug gets when it is unlinked from a problem: a11y-3f9c2a1b → a11y-unlinked-3f9c2a1b. */
export const unlinkedLabel = (code: string) => code.replace(/^a11y-/, 'a11y-unlinked-');

/** Labels Vision puts on bugs (to take them off when a bug is unlinked). */
export const isVisionMarker = (label: string) => /^a11y-/.test(label) && !/^a11y-unlinked/.test(label);

/** Facts of a problem stored before facts were kept, read back from its key. */
export function facetsFromKey(key: string): ProblemFacets {
  const [rule, ...parts] = key.split('|');
  const part = (prefix: string) => parts.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null;
  const component = part('c:');
  const nodeKey = part('e:') ?? (component ? `id:${component}` : '');
  const measure = parts[parts.length - 1]?.includes(':') ? '' : (parts[parts.length - 1] ?? '');
  return {
    rule,
    element: component,
    nodeKey,
    component,
    screen: part('s:') ?? '',
    measure,
    className: '',
    label: '',
  };
}

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
