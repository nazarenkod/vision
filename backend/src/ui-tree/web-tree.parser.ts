import { parseDocument } from 'htmlparser2';
import { Rect, UiNode, UiTree } from './ui-tree.types';

/**
 * Web pages as a UI tree (050, ADR-0029): the HTML a browser holds, either a plain Selenium
 * page source or the Vision SDK's, which adds data-vision-* attributes with where each element
 * is shown, the page scale and scroll, and the content of shadow roots and same-origin frames.
 * The nodes are the same UiNode an Appium tree gives, so comparison, rules and accessibility
 * need no web branch of their own.
 */

interface HtmlElement {
  type: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: HtmlNode[];
  data?: string;
}
type HtmlNode = HtmlElement;

// not on the screen, or only drawing what the screenshot already shows
const SKIPPED = new Set(['head', 'script', 'style', 'noscript', 'meta', 'link', 'base', 'title', 'template']);

const TEXT_INPUTS = new Set(['', 'text', 'email', 'search', 'tel', 'url', 'number', 'password', 'date', 'time']);
const INPUT_ROLES: Record<string, string> = {
  button: 'button',
  submit: 'button',
  reset: 'button',
  image: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  range: 'slider',
  search: 'searchbox',
};
const TAG_ROLES: Record<string, string> = {
  button: 'button',
  select: 'combobox',
  textarea: 'textbox',
  img: 'img',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  nav: 'navigation',
  summary: 'button',
  dialog: 'dialog',
  ul: 'list',
  ol: 'list',
  li: 'listitem',
};
// roles someone can act on, whatever the tag behind them
const ACTIONABLE_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'textbox',
  'searchbox',
  'combobox',
  'slider',
  'spinbutton',
]);
export const WEB_EDITABLE_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton']);

const squash = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

const has = (attrs: Record<string, string>, name: string) => Object.prototype.hasOwnProperty.call(attrs, name);

function roleOf(tag: string, attrs: Record<string, string>): string {
  const given = squash(attrs.role).split(' ')[0];
  if (given) return given.toLowerCase();
  if (tag === 'a') return has(attrs, 'href') ? 'link' : '';
  if (tag === 'input') {
    const type = (attrs.type ?? '').toLowerCase();
    if (type === 'hidden') return '';
    return INPUT_ROLES[type] ?? 'textbox';
  }
  if (has(attrs, 'contenteditable') && attrs.contenteditable !== 'false') return 'textbox';
  return TAG_ROLES[tag] ?? '';
}

function rectOf(value: string | undefined): Rect | null {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [x, y, width, height] = parts;
  return { x, y, width: Math.max(0, width), height: Math.max(0, height) };
}

function pair(value: string | undefined): [number, number] | null {
  const parts = (value ?? '').split(',').map(Number);
  return parts.length === 2 && parts.every((part) => Number.isFinite(part)) ? [parts[0], parts[1]] : null;
}

const elementsOf = (node: HtmlNode): HtmlElement[] =>
  (node.children ?? []).filter((child) => child.type === 'tag' || child.type === 'script' || child.type === 'style');

/** The element's own text: its text children, as Android's text is a view's own. */
const ownText = (element: HtmlElement): string =>
  squash(
    (element.children ?? [])
      .filter((child) => child.type === 'text')
      .map((child) => child.data)
      .join(' ')
  );

const svgTitle = (element: HtmlElement): string => {
  const title = elementsOf(element).find((child) => child.name === 'title');
  return title ? ownText(title) : '';
};

/**
 * A frame's document comes in a template right after the frame, since HTML reads what is
 * inside <iframe> as text; open shadow roots come as a declarative shadow root inside the host.
 * Both are children of the element they belong to, in that order: shadow content, light content.
 */
function childrenInPlace(element: HtmlElement): HtmlElement[] {
  const children = elementsOf(element);
  const result: HtmlElement[] = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.name === 'template' && child.attribs && has(child.attribs, 'data-vision-frame')) continue;
    if (child.name === 'template' && child.attribs?.shadowrootmode) {
      result.unshift(...elementsOf(child));
      continue;
    }
    if ((child.name === 'iframe' || child.name === 'frame') && children[i + 1]?.name === 'template') {
      const next = children[i + 1];
      if (next.attribs && has(next.attribs, 'data-vision-frame')) {
        result.push({ ...child, children: elementsOf(next) });
        continue;
      }
    }
    result.push(child);
  }
  return result;
}

export interface WebParseOptions {
  imageWidth: number;
  imageHeight: number;
}

export const looksLikeHtml = (text: string): boolean =>
  /^\s*(<!--[\s\S]*?-->\s*)*<(!doctype\s+html|html[\s>])/i.test(text);

/** Parses a web page's HTML into a UiTree, bounds in screenshot pixels when the SDK sent them. */
export function parseWebTree(html: string, options: WebParseOptions): UiTree {
  const document = parseDocument(html, { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true });
  const root = elementsOf(document as unknown as HtmlNode).find((element) => element.name === 'html');
  if (!root) throw new Error('Not a web page: no <html> element');
  const top = root.attribs ?? {};
  const positioned = top['data-vision-tree'] === '1';

  const capture = top['data-vision-capture'] === 'page' ? 'page' : 'viewport';
  const viewport = pair(top['data-vision-viewport']);
  const page = pair(top['data-vision-page']);
  const [scrollX, scrollY] = pair(top['data-vision-scroll']) ?? [0, 0];
  const dpr = Number(top['data-vision-dpr']) || 1;
  // CSS pixels → screenshot pixels: by the width of what was taken, which also holds when the
  // browser scaled the shot itself; the page's ratio only when that width is unknown (REQ-050-03)
  const shotWidth = capture === 'page' ? page?.[0] : viewport?.[0];
  const scale = positioned ? (shotWidth > 0 && options.imageWidth > 0 ? options.imageWidth / shotWidth : dpr) : 1;
  // a full-page shot starts at the top of the page, a window shot at the scroll (REQ-050-08)
  const offsetX = capture === 'page' ? scrollX : 0;
  const offsetY = capture === 'page' ? scrollY : 0;
  const capturedWidth = options.imageWidth / scale;
  const capturedHeight = options.imageHeight / scale;

  const nodes: UiNode[] = [];
  const paths: string[] = [];

  const walk = (
    element: HtmlElement,
    parent: number | null,
    depth: number,
    parentPath: string,
    siblingIndex: number,
    inherited: { hidden: boolean; ariaHidden: boolean; disabled: boolean }
  ) => {
    const tag = element.name;
    const attrs = element.attribs ?? {};
    const type = (attrs.type ?? '').toLowerCase();
    const style = (attrs.style ?? '').replace(/\s+/g, '').toLowerCase();
    const hidden =
      inherited.hidden ||
      has(attrs, 'hidden') ||
      has(attrs, 'data-vision-hidden') ||
      (tag === 'input' && type === 'hidden') ||
      (!positioned && /display:none|visibility:hidden/.test(style));
    const ariaHidden = inherited.ariaHidden || attrs['aria-hidden'] === 'true';
    const ownDisabled = (has(attrs, 'disabled') || attrs['aria-disabled'] === 'true') && tag !== 'option';
    const disabled = inherited.disabled || ownDisabled;

    const rect = positioned ? rectOf(attrs['data-vision-rect']) : null;
    const bounds: Rect = rect
      ? {
          x: Math.round((rect.x + offsetX) * scale),
          y: Math.round((rect.y + offsetY) * scale),
          width: Math.round(rect.width * scale),
          height: Math.round(rect.height * scale),
        }
      : { x: 0, y: 0, width: 0, height: 0 };
    // what lies outside the screenshot is not on it, as an element scrolled off an Appium screen
    const onShot =
      !!rect &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.x + offsetX < capturedWidth &&
      rect.y + offsetY < capturedHeight &&
      rect.x + offsetX + rect.width > 0 &&
      rect.y + offsetY + rect.height > 0;
    const visible = !hidden && (positioned ? onShot : true);

    const role = roleOf(tag, attrs);
    const isTextInput = tag === 'input' && TEXT_INPUTS.has(type);
    const value = attrs['data-vision-value'] ?? (isTextInput && type !== 'password' ? attrs.value : undefined);
    let text = ownText(element);
    if (tag === 'input') {
      text = ['button', 'submit', 'reset'].includes(type) ? squash(attrs.value) : squash(value);
    } else if (tag === 'select') {
      text = squash(attrs['data-vision-value']);
    } else if (tag === 'textarea') {
      text = squash(attrs['data-vision-value'] ?? ownText(element));
    }
    const label = squash(
      attrs['data-vision-name'] ||
        attrs['aria-label'] ||
        (tag === 'img' || (tag === 'input' && type === 'image') || tag === 'area' ? attrs.alt : '') ||
        (tag === 'svg' ? svgTitle(element) : '') ||
        attrs.title
    );
    const tabindex = has(attrs, 'tabindex') ? Number(attrs.tabindex) : null;
    const actionable =
      ACTIONABLE_ROLES.has(role) ||
      (tag === 'a' && has(attrs, 'href')) ||
      ['button', 'select', 'textarea', 'summary'].includes(tag) ||
      (tag === 'input' && type !== 'hidden');
    const clickable = actionable || has(attrs, 'onclick') || (tabindex !== null && tabindex >= 0);
    const checked =
      attrs['data-vision-checked'] !== undefined
        ? attrs['data-vision-checked'] === '1'
        : has(attrs, 'checked') || attrs['aria-checked'] === 'true';

    const path = `${parentPath}/${tag}[${siblingIndex}]`;
    nodes.push({
      index: nodes.length,
      parent,
      depth,
      key: '',
      className: tag,
      resourceId: squash(attrs.id),
      text,
      label,
      hint: squash(attrs.placeholder || attrs['aria-placeholder']),
      clickable,
      focusable: clickable || tabindex !== null,
      enabled: !disabled,
      visible,
      accessible: !ariaHidden,
      checked,
      selected: attrs['aria-selected'] === 'true' || has(attrs, 'selected'),
      ...(role ? { role } : {}),
      bounds,
    });
    paths.push(path);
    const current = nodes.length - 1;

    const seen = new Map<string, number>();
    for (const child of childrenInPlace(element)) {
      if (SKIPPED.has(child.name) || child.type !== 'tag') continue;
      const index = seen.get(child.name) ?? 0;
      seen.set(child.name, index + 1);
      // a disabled fieldset disables what is in it; a disabled button does not disable its icon's role
      walk(child, current, depth + 1, path, index, {
        hidden,
        ariaHidden,
        disabled: inherited.disabled || (ownDisabled && tag === 'fieldset'),
      });
    }
  };
  walk(root, null, 0, '', 0, { hidden: false, ariaHidden: false, disabled: false });

  // the same identity rules as an Appium tree: an id, else a tag and its text, else the path
  const keyCounts = new Map<string, number>();
  for (const node of nodes) {
    const named = node.resourceId
      ? `id:${node.resourceId}`
      : node.text || node.label
        ? `${node.className}:${node.text || node.label}`
        : `path:${paths[node.index]}`;
    const occurrence = keyCounts.get(named) ?? 0;
    keyCounts.set(named, occurrence + 1);
    node.key = occurrence ? `${named}#${occurrence}` : named;
  }

  return {
    format: 'web',
    scale,
    width: options.imageWidth,
    height: options.imageHeight,
    // the web's unit is the CSS pixel (WCAG 2.5.8 counts in them)
    pixelsPerDp: scale,
    pixelsPerDpEstimated: !positioned,
    positioned,
    nodes,
  };
}
