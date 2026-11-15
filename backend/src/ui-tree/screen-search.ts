import { componentOf } from '../a11y/a11y-problems';
import { findBySelector, selectorProblem } from './comparison-inputs';
import { Rect, UiNode, UiTree } from './ui-tree.types';

/** Where a node matched the query: its text, its accessibility label, or a selector. */
export type MatchPlace = 'text' | 'label' | 'selector';

export type ScreenQuery =
  { kind: 'text'; value: string } | { kind: 'selector'; value: string } | { kind: 'component'; value: string };

export type QueryProblem = 'short' | 'empty' | ReturnType<typeof selectorProblem>;

export interface ScreenMatch {
  key: string;
  bounds: Rect;
  where: MatchPlace[];
}

const SELECTOR_PREFIX = /^(id|class|text|xpath):/;
const COMPONENT_PREFIX = 'component:';
// one letter finds half of every screen; two is the least that says something (REQ-053-04)
export const MIN_TEXT_LENGTH = 2;

/** Lower case, NBSP as a space, runs of spaces as one: what a person types matches what a screen shows. */
export const normalizeText = (text: string): string =>
  text.replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** The query as typed, or why it cannot be searched (REQ-053-04, REQ-053-22). */
export function parseQuery(raw: string): ScreenQuery | { problem: QueryProblem } {
  const query = raw.trim();
  if (!query) return { problem: 'empty' };
  if (query.toLowerCase().startsWith(COMPONENT_PREFIX)) {
    const value = query.slice(COMPONENT_PREFIX.length).trim();
    return value ? { kind: 'component', value } : { problem: 'empty' };
  }
  if (SELECTOR_PREFIX.test(query)) {
    const problem = selectorProblem(query);
    return problem ? { problem } : { kind: 'selector', value: query };
  }
  const value = normalizeText(query);
  return value.length < MIN_TEXT_LENGTH ? { problem: 'short' } : { kind: 'text', value };
}

// what a person on the app can see: hidden and zero-sized nodes are the framework's (REQ-053-03)
const shown = (node: UiNode) => node.visible && node.bounds.width > 0 && node.bounds.height > 0;

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/**
 * Of matches nested one inside another (a row and the text in it), the innermost: it is the one
 * that says the words, and outlining the row too would count one thing twice.
 */
export function innermost(tree: UiTree, nodes: UiNode[]): UiNode[] {
  const found = new Set(nodes.map((node) => node.index));
  const byIndex = new Map(tree.nodes.map((node) => [node.index, node]));
  const hasFoundDescendant = new Set<number>();
  for (const node of nodes) {
    let parent = node.parent;
    while (parent !== null && parent !== undefined) {
      if (found.has(parent)) hasFoundDescendant.add(parent);
      parent = byIndex.get(parent)?.parent ?? null;
    }
  }
  return nodes.filter(
    (node) =>
      !hasFoundDescendant.has(node.index) &&
      // a tree without parents still nests by bounds
      !nodes.some(
        (other) => other !== node && contains(node.bounds, other.bounds) && !contains(other.bounds, node.bounds)
      )
  );
}

function textMatches(tree: UiTree, value: string): ScreenMatch[] {
  const hits = new Map<UiNode, MatchPlace[]>();
  for (const node of tree.nodes) {
    if (!shown(node)) continue;
    const where: MatchPlace[] = [];
    if (node.text && normalizeText(node.text).includes(value)) where.push('text');
    if (node.label && normalizeText(node.label).includes(value)) where.push('label');
    if (where.length) hits.set(node, where);
  }
  return innermost(tree, [...hits.keys()]).map((node) => ({
    key: node.key,
    bounds: node.bounds,
    where: hits.get(node),
  }));
}

/**
 * The elements of one screen the query finds. Selectors run through the same code as element
 * rules, so the search finds exactly what a rule with that selector would (SC-053-03).
 */
export function matchTree(tree: UiTree, query: ScreenQuery): ScreenMatch[] {
  if (query.kind === 'text') return textMatches(tree, query.value);
  // no innermost here: a selector counts what a rule would count, nested or not (REQ-053-20)
  const nodes =
    query.kind === 'selector'
      ? (findBySelector(tree, query.value) ?? [])
      : tree.nodes.filter((node) => shown(node) && componentOf(node.key)?.toLowerCase() === query.value.toLowerCase());
  return nodes.map((node) => ({ key: node.key, bounds: node.bounds, where: ['selector'] }));
}

export interface Suggestion {
  kind: 'text' | 'label' | 'id' | 'component';
  // what goes into the field when it is picked: the text itself, or a selector
  query: string;
  // checks (name + tags) where it is found
  screens: number;
}

export const MAX_TEXT_SUGGESTIONS = 5;
export const MAX_ELEMENT_SUGGESTIONS = 3;

const shortId = (resourceId: string) => resourceId.replace(/^.*:id\//, '');

/**
 * What to search for, from the project's own screens, while the query is typed (053, beta):
 * texts and labels that hold it, ids and components whose name holds it, most screens first. A
 * person picks one instead of remembering the selector syntax.
 */
export function suggest(screens: Array<{ check: string; tree: UiTree }>, raw: string): Suggestion[] {
  const value = normalizeText(raw);
  if (value.length < MIN_TEXT_LENGTH || SELECTOR_PREFIX.test(value) || value.startsWith(COMPONENT_PREFIX)) return [];
  const found = new Map<string, { kind: Suggestion['kind']; query: string; checks: Set<string> }>();
  const add = (kind: Suggestion['kind'], query: string, check: string) => {
    const id = `${kind}\n${query}`;
    const entry = found.get(id) ?? { kind, query, checks: new Set<string>() };
    entry.checks.add(check);
    found.set(id, entry);
  };
  for (const { check, tree } of screens) {
    for (const node of tree.nodes) {
      if (!shown(node)) continue;
      const text = node.text.replace(/\s+/g, ' ').trim();
      if (text && normalizeText(text).includes(value)) add('text', text, check);
      const label = node.label.replace(/\s+/g, ' ').trim();
      if (label && label !== text && normalizeText(label).includes(value)) add('label', label, check);
      const id = node.resourceId && !node.resourceId.startsWith('android:id/') ? shortId(node.resourceId) : '';
      if (id && !id.includes('#') && id.toLowerCase().includes(value)) add('id', `id:${id}`, check);
      const component = componentOf(node.key);
      if (component && component.toLowerCase().includes(value) && component !== id)
        add('component', `component:${component}`, check);
    }
  }
  const ranked = [...found.values()]
    .map((entry) => ({ kind: entry.kind, query: entry.query, screens: entry.checks.size }))
    .sort((a, b) => b.screens - a.screens || a.query.localeCompare(b.query));
  const texts = ranked.filter((item) => item.kind === 'text' || item.kind === 'label').slice(0, MAX_TEXT_SUGGESTIONS);
  const elements = ranked
    .filter((item) => item.kind === 'id' || item.kind === 'component')
    .slice(0, MAX_ELEMENT_SUGGESTIONS);
  return [...texts, ...elements];
}
