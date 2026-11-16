import { findBySelector, MAX_SELECTOR_LENGTH } from './comparison-inputs';
import { childrenOf, positionAmongSameClass, XPATH_PREFIX } from './xpath-selector';
import { Rect, UiNode, UiTree } from './ui-tree.types';

/** A way to find an element with no name of its own: a path from a stable one (spec 027). */
export interface SelectorVariant {
  selector: string;
  // down from a stable ancestor, or up from a stable descendant
  direction: 'down' | 'up';
  // the stable element, as people read it: its id without the package, or its text
  anchor: string;
  anchorKind: 'id' | 'text';
  // found by the start of its text, which anchor then is in full (REQ-060-07)
  anchorMatch?: 'start';
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

// a longer text is found by its start (REQ-060-01): an iOS container's label holds every child's label
export const TEXT_ANCHOR_LENGTH = 40;

// Node has Intl.Segmenter; the project's TypeScript lib predates it
type Segmenter = { segment(text: string): Iterable<{ segment: string }> };
const graphemes: Segmenter = new (
  Intl as unknown as { Segmenter: new (locale: undefined, options: { granularity: 'grapheme' }) => Segmenter }
).Segmenter(undefined, { granularity: 'grapheme' });

/**
 * The start a long text is found by: whole words within TEXT_ANCHOR_LENGTH visible characters,
 * or just that many when the first word is longer; null when the text is short enough to be
 * found whole (REQ-060-01, REQ-060-02). Cut from the value as the page source has it, since
 * starts-with() reads that, not a trimmed one.
 */
export function textStart(value: string): string | null {
  const characters = Array.from(graphemes.segment(value), (part) => part.segment);
  if (characters.length <= TEXT_ANCHOR_LENGTH) return null;
  const head = characters.slice(0, TEXT_ANCHOR_LENGTH + 1);
  // a space right after the limit still ends a whole word
  let cut = head.length;
  while (cut > 0 && !/^\s$/u.test(head[cut - 1])) cut--;
  const words = head.slice(0, cut).join('').trimEnd();
  return words.trim() ? words : characters.slice(0, TEXT_ANCHOR_LENGTH).join('');
}

interface AnchorStep {
  step: string;
  // found by the start of its text: that start
  start?: string;
}

/** The anchor step for a stable node, with the attribute Appium's page source gives it. */
function anchorStep(tree: UiTree, node: UiNode): AnchorStep | null {
  const ios = tree.format === 'appium-ios';
  const web = tree.format === 'web';
  let attribute: string;
  let value: string;
  if (hasAppId(node)) {
    [attribute, value] = [ios ? 'name' : web ? 'id' : 'resource-id', node.resourceId];
  } else if (web) {
    [attribute, value] = node.text ? ['text', node.text] : ['aria-label', node.label];
  } else if (ios) {
    [attribute, value] = ['label', node.label];
  } else {
    [attribute, value] = node.text ? ['text', node.text] : ['content-desc', node.label];
  }
  if (!value.trim()) return null;
  // an id is matched whole; a long text by its start, quoted by what is written (REQ-060-06)
  const start = hasAppId(node) ? null : textStart(value);
  const literal = quoted(start ?? value);
  if (!literal) return null;
  return start
    ? { step: `//*[starts-with(@${attribute},${literal})]`, start }
    : { step: `//*[@${attribute}=${literal}]` };
}

const anchorName = (node: UiNode) =>
  hasAppId(node)
    ? node.resourceId.replace(/^.*:id\//, '')
    : Array.from((node.text || node.label).trim())
        .slice(0, 40)
        .join('');

/** The nearest node of each kind in a sequence that can serve as an anchor: id first, else text. */
function pickAnchor(tree: UiTree, candidates: Iterable<number>): ({ node: UiNode } & AnchorStep) | null {
  let text: ({ node: UiNode } & AnchorStep) | null = null;
  for (const index of candidates) {
    const node = tree.nodes[index];
    const kind = stableKind(node);
    const step = kind && anchorStep(tree, node);
    if (!step) continue;
    if (kind === 'id') return { node, ...step };
    text ??= { node, ...step };
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
  return `/${node.className}[${positionAmongSameClass(tree, node)}]`;
}

/**
 * A path down to a node from its nearest ancestor with an app id, built
 * without evaluating it: a text whose value changes is found next run by
 * where it is, not by what it says (REQ-033-27). Null without such an ancestor.
 */
export function pathFromIdAbove(tree: UiTree, node: UiNode): string | null {
  const above = [...ancestors(tree, node)].find((index) => stableKind(tree.nodes[index]) === 'id');
  if (above === undefined) return null;
  const step = anchorStep(tree, tree.nodes[above]);
  if (!step) return null;
  const path: string[] = [];
  for (let at = node; at.index !== above; at = tree.nodes[at.parent]) path.unshift(stepTo(tree, at));
  const selector = `${XPATH_PREFIX}${step.step}${path.join('')}`;
  // the server would refuse a longer rule (REQ-060-04)
  return selector.length <= MAX_SELECTOR_LENGTH ? selector : null;
}

/**
 * Selectors for an element with no name: down from its nearest stable
 * ancestor (REQ-027-11) and up from its nearest stable descendant
 * (REQ-027-15), best first (REQ-027-16). A variant that would not find the
 * element itself is dropped.
 */
export function selectorVariants(tree: UiTree, node: UiNode): SelectorVariant[] {
  const variants: SelectorVariant[] = [];
  const add = (
    anchor: { node: UiNode } & AnchorStep,
    path: string,
    direction: SelectorVariant['direction'],
    levels: number
  ) => {
    const selector = `${XPATH_PREFIX}${anchor.step}${path}`;
    // the server would refuse a longer rule, so it is not offered (REQ-060-04)
    if (selector.length > MAX_SELECTOR_LENGTH) return;
    const found = findBySelector(tree, selector) ?? [];
    if (!found.includes(node)) return;
    variants.push({
      selector,
      direction,
      anchor: anchor.start ?? anchorName(anchor.node),
      anchorKind: stableKind(anchor.node),
      ...(anchor.start ? { anchorMatch: 'start' as const } : {}),
      levels,
      count: found.length,
    });
  };

  const above = pickAnchor(tree, ancestors(tree, node));
  if (above) {
    const path: string[] = [];
    for (let at = node; at.index !== above.node.index; at = tree.nodes[at.parent]) path.unshift(stepTo(tree, at));
    add(above, path.join(''), 'down', path.length);
  }

  const below = pickAnchor(tree, descendants(tree, node));
  if (below) {
    let hops = 0;
    for (let at = below.node; at.index !== node.index; at = tree.nodes[at.parent]) hops++;
    add(below, '/..'.repeat(hops), 'up', hops);
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
