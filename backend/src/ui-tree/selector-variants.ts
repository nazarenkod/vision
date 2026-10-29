import { findBySelector } from './comparison-inputs';
import { childrenOf, XPATH_PREFIX } from './xpath-selector';
import { Rect, UiNode, UiTree } from './ui-tree.types';

/** A way to find an element with no name of its own: a path from a stable one (spec 027). */
export interface SelectorVariant {
  selector: string;
  // down from a stable ancestor, or up from a stable descendant
  direction: 'down' | 'up';
  // the stable element, as people read it: its id without the package, or its text
  anchor: string;
  anchorKind: 'id' | 'text';
  // how many levels apart the element and the anchor are: 1 is a child or a parent
  levels: number;
  // how many elements the selector takes on this screenshot
  count: number;
}

const hasAppId = (node: UiNode) => !!node.resourceId && !node.resourceId.startsWith('android:id/');

/**
 * An app id, else a text or label, is what a path may start from (REQ-027-10);
 * a hint is only a field's placeholder, and system ids repeat on every screen.
 */
export function stableKind(node: UiNode): 'id' | 'text' | null {
  if (hasAppId(node)) return 'id';
  return node.text.trim() || node.label.trim() ? 'text' : null;
}

// XPath 1.0 has no escape: a value with both quotes cannot be written without concat()
const quoted = (value: string): string | null =>
  !value.includes("'") ? `'${value}'` : !value.includes('"') ? `"${value}"` : null;

/** The anchor step for a stable node, with the attribute Appium's page source gives it. */
function anchorStep(tree: UiTree, node: UiNode): string | null {
  const ios = tree.format === 'appium-ios';
  let attribute: string;
  let value: string;
  if (hasAppId(node)) {
    [attribute, value] = [ios ? 'name' : 'resource-id', node.resourceId];
  } else if (ios) {
    [attribute, value] = ['label', node.label];
  } else {
    [attribute, value] = node.text ? ['text', node.text] : ['content-desc', node.label];
  }
  const literal = value.trim() ? quoted(value) : null;
  return literal ? `//*[@${attribute}=${literal}]` : null;
}

const anchorName = (node: UiNode) =>
  hasAppId(node)
    ? node.resourceId.replace(/^.*:id\//, '')
    : Array.from((node.text || node.label).trim())
        .slice(0, 40)
        .join('');

/** The nearest node of each kind in a sequence that can serve as an anchor: id first, else text. */
function pickAnchor(tree: UiTree, candidates: Iterable<number>): { node: UiNode; step: string } | null {
  let text: { node: UiNode; step: string } | null = null;
  for (const index of candidates) {
    const node = tree.nodes[index];
    const kind = stableKind(node);
    const step = kind && anchorStep(tree, node);
    if (!step) continue;
    if (kind === 'id') return { node, step };
    text ??= { node, step };
  }
  return text;
}

function* ancestors(tree: UiTree, node: UiNode) {
  for (let up = node.parent; up !== null; up = tree.nodes[up].parent) yield up;
}

// nearest first: level by level, in tree order within a level
function* descendants(tree: UiTree, node: UiNode) {
  const children = childrenOf(tree);
  let level = children[node.index];
  while (level.length) {
    yield* level;
    level = level.flatMap((index) => children[index]);
  }
}

/** The step from a node's parent to it: its class and its place among siblings of that class. */
function stepTo(tree: UiTree, node: UiNode): string {
  const siblings = childrenOf(tree)[node.parent];
  const position = siblings.filter((index) => tree.nodes[index].className === node.className).indexOf(node.index) + 1;
  return `/${node.className}[${position}]`;
}

/**
 * Selectors for an element with no name: down from its nearest stable
 * ancestor (REQ-027-11) and up from its nearest stable descendant
 * (REQ-027-15), best first (REQ-027-16). A variant that would not find the
 * element itself is dropped.
 */
export function selectorVariants(tree: UiTree, node: UiNode): SelectorVariant[] {
  const variants: SelectorVariant[] = [];
  const add = (anchor: UiNode, expression: string, direction: SelectorVariant['direction'], levels: number) => {
    const selector = `${XPATH_PREFIX}${expression}`;
    const found = findBySelector(tree, selector) ?? [];
    if (!found.includes(node)) return;
    variants.push({
      selector,
      direction,
      anchor: anchorName(anchor),
      anchorKind: stableKind(anchor),
      levels,
      count: found.length,
    });
  };

  const above = pickAnchor(tree, ancestors(tree, node));
  if (above) {
    const path: string[] = [];
    for (let at = node; at.index !== above.node.index; at = tree.nodes[at.parent]) path.unshift(stepTo(tree, at));
    add(above.node, above.step + path.join(''), 'down', path.length);
  }

  const below = pickAnchor(tree, descendants(tree, node));
  if (below) {
    let hops = 0;
    for (let at = below.node; at.index !== node.index; at = tree.nodes[at.parent]) hops++;
    add(below.node, below.step + '/..'.repeat(hops), 'up', hops);
  }

  const rank = (variant: SelectorVariant) => (variant.anchorKind === 'id' ? (variant.count === 1 ? 0 : 1) : 2);
  return variants.sort((a, b) => rank(a) - rank(b) || (a.direction === 'down' ? -1 : 1));
}

// a redrawn edge or a rounding of dp can leave a wrapper a pixel off its content
const SAME_BOUNDS_PX = 1;

export const sameBounds = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) <= SAME_BOUNDS_PX &&
  Math.abs(a.y - b.y) <= SAME_BOUNDS_PX &&
  Math.abs(a.x + a.width - (b.x + b.width)) <= SAME_BOUNDS_PX &&
  Math.abs(a.y + a.height - (b.y + b.height)) <= SAME_BOUNDS_PX;

/**
 * Whether a nameless node is worth offering on its own (REQ-027-02): a chain
 * of same-sized wrappers is offered once, as its innermost node, and not at
 * all when a named element of the same size stands for it.
 */
export function addsSomething(tree: UiTree, node: UiNode, named: (index: number) => boolean): boolean {
  if (childrenOf(tree)[node.index].some((child) => sameBounds(tree.nodes[child].bounds, node.bounds))) return false;
  const parent = node.parent;
  return parent === null || !named(parent) || !sameBounds(tree.nodes[parent].bounds, node.bounds);
}
