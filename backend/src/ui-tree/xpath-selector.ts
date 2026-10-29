import { UiNode, UiTree } from './ui-tree.types';

/**
 * The part of XPath a rule may use (REQ-027-30): one stable element found by
 * an attribute, then steps only down to its descendants or only up to its
 * ancestors. Anything wider is refused with a reason (REQ-027-31), because a
 * free expression is hard to read in review and to keep working across builds
 * (ADR-0021). Evaluated on the parsed tree: the raw page source is not kept.
 */
export const XPATH_PREFIX = 'xpath:';

export type XpathAttribute = 'resource-id' | 'text' | 'content-desc' | 'name' | 'label';

export type XpathProblem = 'syntax' | 'anchor' | 'attribute' | 'axis' | 'function' | 'or' | 'mixed';

export interface XpathStep {
  axis: 'child' | 'descendant' | 'parent' | 'ancestor';
  // a class as the page source names it, or * for any
  test: string;
  position?: number;
}

export interface ParsedXpath {
  anchor: { test: string; attribute: XpathAttribute; value: string };
  steps: XpathStep[];
}

export type XpathParse =
  { ok: true; xpath: ParsedXpath; problem?: undefined } | { ok: false; problem: XpathProblem; xpath?: undefined };

const ATTRIBUTES: XpathAttribute[] = ['resource-id', 'text', 'content-desc', 'name', 'label'];
const NAME = /^(\*|[A-Za-z_][\w.$-]*)/;

const fail = (problem: XpathProblem): XpathParse => ({ ok: false, problem });

// quoted values may hold anything, so the checks for functions and "or" look past them
const withoutLiterals = (source: string) => source.replace(/'[^']*'|"[^"]*"/g, "''");

/** Parses the expression after `xpath:`. */
export function parseXpath(expression: string): XpathParse {
  const source = expression.trim();
  const bare = withoutLiterals(source);
  if (/[(]/.test(bare)) return fail('function');
  if (/\|/.test(bare) || /\bor\b/.test(bare)) return fail('or');
  const axis = /([a-z-]+)::/.exec(bare);
  if (axis && axis[1] !== 'ancestor') return fail('axis');

  let at = 0;
  const rest = () => source.slice(at);
  const readName = (): string | null => {
    const match = NAME.exec(rest());
    if (!match) return null;
    at += match[0].length;
    return match[0];
  };
  const readPosition = (): number | undefined | null => {
    const match = /^\[\s*(\d+)\s*\]/.exec(rest());
    if (!match) return rest().startsWith('[') ? null : undefined;
    at += match[0].length;
    const position = Number(match[1]);
    return position >= 1 ? position : null;
  };

  if (!source.startsWith('//')) return fail('anchor');
  at = 2;
  const anchorTest = readName();
  if (!anchorTest) return fail('syntax');
  const condition = /^\[\s*@([\w-]+)\s*=\s*('([^']*)'|"([^"]*)")\s*\]/.exec(rest());
  // a bare //Class, or conditions joined with "and", is not one stable element
  if (!condition) return fail('anchor');
  const attribute = condition[1] as XpathAttribute;
  if (!ATTRIBUTES.includes(attribute)) return fail('attribute');
  at += condition[0].length;
  const anchor = { test: anchorTest, attribute, value: condition[3] ?? condition[4] };

  const steps: XpathStep[] = [];
  while (at < source.length) {
    if (rest().startsWith('[')) return fail('anchor');
    let step: XpathStep;
    if (rest().startsWith('/..')) {
      at += 3;
      step = { axis: 'parent', test: '*' };
    } else if (rest().startsWith('/ancestor::')) {
      at += '/ancestor::'.length;
      const test = readName();
      if (!test) return fail('syntax');
      step = { axis: 'ancestor', test };
    } else if (rest().startsWith('//') || rest().startsWith('/')) {
      const descendant = rest().startsWith('//');
      at += descendant ? 2 : 1;
      const test = readName();
      if (!test) return fail('syntax');
      step = { axis: descendant ? 'descendant' : 'child', test };
    } else {
      return fail('syntax');
    }
    if (step.axis !== 'parent') {
      const position = readPosition();
      if (position === null) return rest().includes('@') ? fail('anchor') : fail('syntax');
      if (position !== undefined) step.position = position;
    }
    steps.push(step);
  }

  const up = steps.filter((step) => step.axis === 'parent' || step.axis === 'ancestor').length;
  if (up && up !== steps.length) return fail('mixed');
  return { ok: true, xpath: { anchor, steps } };
}

/** The value of an attribute as Appium's page source has it on this node. */
export function attributeOf(node: UiNode, attribute: XpathAttribute, format: UiTree['format']): string | null {
  if (format === 'appium-ios') {
    // the parser drops name when it only repeats the label, so the label stands in for it
    if (attribute === 'name') return node.resourceId || node.label || null;
    if (attribute === 'label') return node.label || null;
    return null;
  }
  if (attribute === 'resource-id') return node.resourceId || null;
  if (attribute === 'text') return node.text || null;
  if (attribute === 'content-desc') return node.label || null;
  return null;
}

const childrenCache = new WeakMap<UiTree, number[][]>();

/** Each node's children in page-source order; the parser walks the tree depth-first. */
export function childrenOf(tree: UiTree): number[][] {
  let children = childrenCache.get(tree);
  if (!children) {
    children = tree.nodes.map(() => []);
    for (const node of tree.nodes) if (node.parent !== null) children[node.parent].push(node.index);
    childrenCache.set(tree, children);
  }
  return children;
}

const fits = (node: UiNode, test: string) => test === '*' || node.className === test;

// every nameless element of a screen is offered with a path, and most share an anchor
const anchorCache = new WeakMap<UiTree, Map<string, number[]>>();

function anchorsOf(tree: UiTree, anchor: ParsedXpath['anchor']): number[] {
  let byAnchor = anchorCache.get(tree);
  if (!byAnchor) anchorCache.set(tree, (byAnchor = new Map()));
  const key = JSON.stringify([anchor.test, anchor.attribute, anchor.value]);
  let found = byAnchor.get(key);
  if (!found) {
    found = tree.nodes
      .filter((node) => fits(node, anchor.test) && attributeOf(node, anchor.attribute, tree.format) === anchor.value)
      .map((node) => node.index);
    byAnchor.set(key, found);
  }
  return found;
}

const nth = (indices: number[], position?: number) =>
  position === undefined ? indices : indices[position - 1] === undefined ? [] : [indices[position - 1]];

/** The nodes an expression finds, in tree order. */
export function evaluateXpath(tree: UiTree, xpath: ParsedXpath): UiNode[] {
  const children = childrenOf(tree);
  const { anchor } = xpath;
  let context = anchorsOf(tree, anchor);

  const descendantsOrSelf = (index: number): number[] => {
    const all = [index];
    for (let i = 0; i < all.length; i++) all.push(...children[all[i]]);
    return all;
  };

  for (const step of xpath.steps) {
    const next = new Set<number>();
    for (const index of context) {
      if (step.axis === 'child' || step.axis === 'descendant') {
        const parents = step.axis === 'child' ? [index] : descendantsOrSelf(index);
        for (const parent of parents) {
          const matching = children[parent].filter((child) => fits(tree.nodes[child], step.test));
          nth(matching, step.position).forEach((child) => next.add(child));
        }
      } else if (step.axis === 'parent') {
        const parent = tree.nodes[index].parent;
        if (parent !== null) next.add(parent);
      } else {
        // a reverse axis: [1] is the nearest ancestor
        const ancestors: number[] = [];
        for (let up = tree.nodes[index].parent; up !== null; up = tree.nodes[up].parent) {
          if (fits(tree.nodes[up], step.test)) ancestors.push(up);
        }
        nth(ancestors, step.position).forEach((ancestor) => next.add(ancestor));
      }
    }
    context = [...next];
  }
  return [...new Set(context)].sort((a, b) => a - b).map((index) => tree.nodes[index]);
}

/** Why a `xpath:` selector cannot be used, or null when it can. */
export function xpathProblem(selector: string): XpathProblem | null {
  const parsed = parseXpath(selector.trim().slice(XPATH_PREFIX.length));
  return parsed.ok ? null : parsed.problem;
}

export const isXpathSelector = (selector: string) => selector.trim().startsWith(XPATH_PREFIX);
