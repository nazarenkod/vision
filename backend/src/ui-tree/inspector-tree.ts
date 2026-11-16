import { findBySelector } from './comparison-inputs';
import { selectorVariants } from './selector-variants';
import { selectorForNode } from './ui-tree.service';
import { Rect, UiNode, UiTree } from './ui-tree.types';
import { positionAmongSameClass } from './xpath-selector';

/**
 * The UI tree as the Elements tab shows it (060): every node with the attributes Vision keeps,
 * named as the platform's page source names them, so QA reads it as in Appium Inspector.
 */
export interface InspectorNode {
  index: number;
  parent: number | null;
  // matches the same element on the other tree, and the changes and findings about it
  key: string;
  className: string;
  // the class without its package, the iOS type without XCUIElementType, the tag on the web
  name: string;
  // the id without the app's package
  id: string;
  // what the element says: its text, else its label
  text: string;
  attributes: Array<[string, string]>;
  // where it is on the screenshot, in its pixels; null when it cannot be shown there (REQ-060-15)
  bounds: Rect | null;
  hidden?: 'unpositioned' | 'invisible' | 'empty';
}

export interface InspectorTree {
  format: UiTree['format'];
  positioned: boolean;
  width: number;
  height: number;
  nodes: InspectorNode[];
}

export interface Locator {
  // id:, text:, xpath: for Vision; id, accessibility id, -ios predicate string, xpath, css for tests
  kind: string;
  value: string;
  // how many nodes of this tree it finds (REQ-060-30)
  matches: number;
}

export interface NodeLocators {
  vision: Locator[];
  test: Locator[];
}

const shortName = (className: string) => className.split('.').pop().replace('XCUIElementType', '');

const flag = (value: boolean) => String(value);

// tree units: Android writes pixels, iOS points, the web CSS pixels
const unit = (px: number, scale: number) => {
  const value = px / (scale || 1);
  return String(Math.round(value * 100) / 100);
};

function attributesOf(tree: UiTree, node: UiNode): Array<[string, string]> {
  const { bounds: b, scale } = { bounds: node.bounds, scale: tree.scale };
  const optional = (name: string, value: boolean | undefined): Array<[string, string]> =>
    value === undefined ? [] : [[name, flag(value)]];
  if (tree.format === 'appium-ios') {
    return [
      ['type', node.className],
      ['name', node.resourceId || node.label],
      ['label', node.label],
      ['value', node.text],
      ['placeholderValue', node.hint],
      ['enabled', flag(node.enabled)],
      ['visible', flag(node.visible)],
      ['accessible', flag(node.accessible)],
      ...optional('selected', node.selected),
      ['x', unit(b.x, scale)],
      ['y', unit(b.y, scale)],
      ['width', unit(b.width, scale)],
      ['height', unit(b.height, scale)],
    ];
  }
  if (tree.format === 'web') {
    const positioned = tree.positioned !== false;
    return [
      ['tag', node.className],
      ['id', node.resourceId],
      ['text', node.text],
      ['aria-label', node.label],
      ['placeholder', node.hint],
      ['role', node.role ?? ''],
      ['disabled', flag(!node.enabled)],
      ['visible', flag(node.visible)],
      ...optional('checked', node.checked),
      ...optional('selected', node.selected),
      ...(positioned
        ? ([
            ['x', unit(b.x, scale)],
            ['y', unit(b.y, scale)],
            ['width', unit(b.width, scale)],
            ['height', unit(b.height, scale)],
          ] as Array<[string, string]>)
        : []),
    ];
  }
  const corner = (x: number, y: number) => `[${unit(x, scale)},${unit(y, scale)}]`;
  return [
    ['class', node.className],
    ['resource-id', node.resourceId],
    ['text', node.text],
    ['content-desc', node.label],
    ['hint', node.hint],
    ['clickable', flag(node.clickable)],
    ['focusable', flag(node.focusable)],
    ['enabled', flag(node.enabled)],
    ['displayed', flag(node.visible)],
    ...optional('checked', node.checked),
    ...optional('selected', node.selected),
    ['bounds', `${corner(b.x, b.y)}${corner(b.x + b.width, b.y + b.height)}`],
  ];
}

function hiddenWhy(tree: UiTree, node: UiNode): InspectorNode['hidden'] | undefined {
  if (tree.positioned === false) return 'unpositioned';
  if (!node.visible) return 'invisible';
  if (node.bounds.width <= 0 || node.bounds.height <= 0) return 'empty';
  return undefined;
}

/** Every node of a tree with what the Elements tab shows about it (REQ-060-03, 06, 15). */
export function inspectorTree(tree: UiTree): InspectorTree {
  return {
    format: tree.format,
    positioned: tree.positioned !== false,
    width: tree.width,
    height: tree.height,
    nodes: tree.nodes.map((node) => {
      const hidden = hiddenWhy(tree, node);
      return {
        index: node.index,
        parent: node.parent,
        key: node.key,
        className: node.className,
        name: shortName(node.className),
        id: node.resourceId.replace(/^.*:id\//, ''),
        text: (node.text || node.label).trim(),
        attributes: attributesOf(tree, node),
        bounds: hidden ? null : node.bounds,
        ...(hidden ? { hidden } : {}),
      };
    }),
  };
}

// XPath 1.0 has no escape: a value with both quotes cannot be written without concat()
const xpathLiteral = (value: string): string | null =>
  !value.includes('"') ? `"${value}"` : !value.includes("'") ? `'${value}'` : null;

const predicateLiteral = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const cssIdent = (value: string) => /^[A-Za-z_][\w-]*$/.test(value);

const count = (tree: UiTree, test: (node: UiNode) => boolean) => tree.nodes.filter(test).length;

const chain = (tree: UiTree, node: UiNode): UiNode[] => {
  const nodes: UiNode[] = [];
  for (let at: UiNode | undefined = node; at; at = at.parent === null ? undefined : tree.nodes[at.parent]) {
    nodes.unshift(at);
  }
  return nodes;
};

// a top node has no parent to count siblings in: it is counted among the other top nodes
const placeOf = (tree: UiTree, node: UiNode) =>
  node.parent !== null
    ? positionAmongSameClass(tree, node)
    : tree.nodes.filter((n) => n.parent === null && n.className === node.className && n.index <= node.index).length;

/** The full path Appium or the browser takes from the top, one class and place per level. */
function absoluteXpath(tree: UiTree, node: UiNode): string {
  const steps = chain(tree, node).map((at) => `${at.className}[${placeOf(tree, at)}]`);
  // UiAutomator2 wraps the screen in <hierarchy>; XCUITest and HTML start at the element itself
  return `${tree.format === 'appium-android' ? '/hierarchy' : ''}/${steps.join('/')}`;
}

function androidLocators(tree: UiTree, node: UiNode): Locator[] {
  const found: Locator[] = [];
  if (node.resourceId) {
    found.push({ kind: 'id', value: node.resourceId, matches: count(tree, (n) => n.resourceId === node.resourceId) });
  }
  if (node.label) {
    found.push({ kind: 'accessibility id', value: node.label, matches: count(tree, (n) => n.label === node.label) });
  }
  const [attribute, value, same] = node.resourceId
    ? ['resource-id', node.resourceId, (n: UiNode) => n.resourceId === node.resourceId]
    : node.text
      ? ['text', node.text, (n: UiNode) => n.text === node.text]
      : node.label
        ? ['content-desc', node.label, (n: UiNode) => n.label === node.label]
        : [null, null, null];
  const literal = value ? xpathLiteral(value) : null;
  found.push(
    literal
      ? {
          kind: 'xpath',
          value: `//${node.className}[@${attribute}=${literal}]`,
          matches: count(tree, (n) => n.className === node.className && same(n)),
        }
      : { kind: 'xpath', value: absoluteXpath(tree, node), matches: 1 }
  );
  return found;
}

function iosLocators(tree: UiTree, node: UiNode): Locator[] {
  const found: Locator[] = [];
  // what XCUITest's name holds: the identifier, else the label
  const nameOf = (n: UiNode) => n.resourceId || n.label;
  const name = nameOf(node);
  if (name) found.push({ kind: 'accessibility id', value: name, matches: count(tree, (n) => nameOf(n) === name) });
  const [attribute, value, same] = name
    ? ['name', name, (n: UiNode) => nameOf(n) === name]
    : node.text
      ? ['value', node.text, (n: UiNode) => n.text === node.text]
      : [null, null, null];
  if (value) {
    found.push({
      kind: '-ios predicate string',
      value: `type == '${node.className}' AND ${attribute} == ${predicateLiteral(value)}`,
      matches: count(tree, (n) => n.className === node.className && same(n)),
    });
  }
  const literal = value ? xpathLiteral(value) : null;
  found.push(
    literal
      ? {
          kind: 'xpath',
          value: `//${node.className}[@${attribute}=${literal}]`,
          matches: count(tree, (n) => n.className === node.className && same(n)),
        }
      : { kind: 'xpath', value: absoluteXpath(tree, node), matches: 1 }
  );
  return found;
}

function webLocators(tree: UiTree, node: UiNode): Locator[] {
  const found: Locator[] = [];
  const sameId = (n: UiNode) => n.resourceId === node.resourceId;
  if (node.resourceId) {
    found.push({
      kind: 'css',
      value: cssIdent(node.resourceId) ? `#${node.resourceId}` : `[id="${node.resourceId.replace(/"/g, '\\"')}"]`,
      matches: count(tree, sameId),
    });
  } else {
    const path = chain(tree, node)
      .map((at) => `${at.className}:nth-of-type(${placeOf(tree, at)})`)
      .join(' > ');
    found.push({ kind: 'css', value: path, matches: 1 });
  }
  const [attribute, value, same] = node.resourceId
    ? ['@id', node.resourceId, sameId]
    : node.text
      ? ['normalize-space()', node.text, (n: UiNode) => n.text === node.text]
      : node.label
        ? ['@aria-label', node.label, (n: UiNode) => n.label === node.label]
        : [null, null, null];
  const literal = value ? xpathLiteral(value) : null;
  found.push(
    literal
      ? {
          kind: 'xpath',
          value: `//${node.className}[${attribute}=${literal}]`,
          matches: count(tree, (n) => n.className === node.className && same(n)),
        }
      : { kind: 'xpath', value: absoluteXpath(tree, node), matches: 1 }
  );
  return found;
}

/**
 * How to find a node: Vision's selectors for rules, as Select elements offers them, and the
 * locators a test would use, each with how many nodes of the tree it finds (REQ-060-23, 30).
 */
export function nodeLocators(tree: UiTree, node: UiNode): NodeLocators {
  const vision: Locator[] = [];
  const own = selectorForNode(node);
  if (own)
    vision.push({ kind: own.slice(0, own.indexOf(':')), value: own, matches: findBySelector(tree, own)?.length ?? 0 });
  // a nameless element is found by a path from something stable around it (027)
  if (!own) {
    for (const variant of selectorVariants(tree, node)) {
      vision.push({ kind: 'xpath', value: variant.selector, matches: variant.count });
    }
  }
  const test =
    tree.format === 'appium-ios'
      ? iosLocators(tree, node)
      : tree.format === 'web'
        ? webLocators(tree, node)
        : androidLocators(tree, node);
  return { vision, test };
}
