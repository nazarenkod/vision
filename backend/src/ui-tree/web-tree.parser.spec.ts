import { readFileSync } from 'fs';
import { join } from 'path';
import { parseUiTree } from './ui-tree.parser';
import { UiNode, UiTree } from './ui-tree.types';

// collected in Chromium by web-tree/collect-tree.js (web-tree/make-fixtures.cjs)
const fixture = (name: string): UiTree => {
  const dir = join(__dirname, '__fixtures__', 'web');
  const size = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
  return parseUiTree(readFileSync(join(dir, `${name}.html`), 'utf8'), {
    imageWidth: size.width,
    imageHeight: size.height,
  });
};

const byId = (tree: UiTree, id: string): UiNode => tree.nodes.find((node) => node.resourceId === id);

describe('web tree parser', () => {
  it('reads a Selenium page source as a web tree', () => {
    const html = readFileSync(join(__dirname, '__fixtures__', 'web', 'shop-page-source.html'), 'utf8');
    const tree = parseUiTree(html, { imageWidth: 800, imageHeight: 600 });

    expect(tree.format).toBe('web');
    expect(tree.positioned).toBe(false);
    expect(byId(tree, 'buy')).toMatchObject({ className: 'button', text: 'Buy', clickable: true });
    // no positions without the SDK: nothing can be drawn or measured
    expect(tree.nodes.every((node) => node.bounds.width === 0 && node.bounds.height === 0)).toBe(true);
    // a script and a style are not elements of the page
    expect(tree.nodes.some((node) => node.className === 'script' || node.className === 'style')).toBe(false);
  });

  it('reads tag, role, id, text, name, placeholder and state of each element', () => {
    const tree = fixture('shop');

    expect(byId(tree, 'menu')).toMatchObject({ className: 'button', role: 'button', label: '', clickable: true });
    expect(byId(tree, 'search')).toMatchObject({ className: 'input', role: 'searchbox', hint: 'Search' });
    expect(byId(tree, 'agree')).toMatchObject({ role: 'checkbox', checked: true });
    expect(byId(tree, 'fake')).toMatchObject({
      className: 'div',
      role: 'button',
      clickable: true,
      text: 'Fake button',
    });
    expect(tree.nodes.find((node) => node.text === 'Later')).toMatchObject({ enabled: false });
    expect(tree.nodes.find((node) => node.text === 'Tea')).toMatchObject({ role: 'link', clickable: true });
    // hidden by CSS: not shown, so it takes part in neither comparison nor accessibility
    expect(byId(tree, 'promo').visible).toBe(false);
    expect(tree.nodes.find((node) => node.className === 'div' && node.visible === false)).toBeTruthy();
  });

  it('names an element as the browser does', () => {
    const tree = fixture('shop');

    expect(byId(tree, 'email').label).toBe('Email'); // <label for>
    expect(byId(tree, 'agree').label).toBe('I agree'); // wrapping <label>
    expect(byId(tree, 'pay').label).toBe('Pay now'); // aria-labelledby
    expect(tree.nodes.find((node) => node.className === 'img').label).toBe('Logo'); // alt
    expect(byId(tree, 'nameless').label).toBe('');
  });

  it('turns CSS pixels into screenshot pixels by the page scale', () => {
    const one = byId(fixture('shop'), 'menu').bounds;
    const two = byId(fixture('shop-dpr2'), 'menu').bounds;

    expect(one).toEqual({ x: 764, y: 18, width: 20, height: 20 });
    expect(two).toEqual({ x: 1528, y: 36, width: 40, height: 40 });
    expect(fixture('shop-dpr2').pixelsPerDp).toBe(2);
  });

  it('ignores a screen density sent with a web tree: the page scale decides', () => {
    const dir = join(__dirname, '__fixtures__', 'web');
    const size = JSON.parse(readFileSync(join(dir, 'shop-dpr2.json'), 'utf8'));
    const tree = parseUiTree(readFileSync(join(dir, 'shop-dpr2.html'), 'utf8'), {
      imageWidth: size.width,
      imageHeight: size.height,
      densityDpi: 480,
    });

    expect(tree.pixelsPerDp).toBe(2);
  });

  it('places elements of a full-page screenshot below the scroll', () => {
    const scrolled = byId(fixture('shop-scrolled'), 'card');
    const full = byId(fixture('shop-full'), 'card');
    const top = byId(fixture('shop'), 'card');

    // a window shot at the scroll sees the card higher up; a full-page shot where the page has it
    expect(scrolled.bounds.y).toBe(top.bounds.y - 200);
    expect(full.bounds.y).toBe(top.bounds.y);
    // what was scrolled out of the window is not on its screenshot
    expect(byId(fixture('shop-scrolled'), 'menu').visible).toBe(false);
    expect(byId(fixture('shop-full'), 'menu').visible).toBe(true);
  });

  it('reads iframe and shadow DOM content in place', () => {
    const tree = fixture('shop');
    const frame = byId(tree, 'frame');
    const inside = byId(tree, 'inside');
    const shadow = byId(tree, 'shadow-btn');

    // the frame's button is its descendant, at the frame's place on the page
    let parent = inside.parent;
    while (parent !== null && parent !== frame.index) parent = tree.nodes[parent].parent;
    expect(parent).toBe(frame.index);
    expect(inside.bounds.x).toBe(frame.bounds.x + 2);
    expect(inside.bounds.y).toBe(frame.bounds.y + 2);
    expect(tree.nodes[shadow.parent].resourceId).toBe('card');
    expect(shadow.visible).toBe(true);
  });

  it('reads a tree by its format whatever the project platform', () => {
    const html = readFileSync(join(__dirname, '__fixtures__', 'web', 'shop.html'), 'utf8');

    // a client that calls it an Android tree still gets the page read as a page
    expect(parseUiTree(html, { format: 'appium-android', imageWidth: 800, imageHeight: 600 }).format).toBe('web');
    expect(
      parseUiTree('<hierarchy><node class="android.widget.Button" bounds="[0,0][10,10]"/></hierarchy>', {
        imageWidth: 10,
        imageHeight: 10,
      }).format
    ).toBe('appium-android');
  });

  it('keeps element keys stable between a page and the same page with a banner', () => {
    const before = fixture('shop');
    const after = fixture('shop-banner');
    const keys = (tree: UiTree) => tree.nodes.map((node) => node.key);

    expect(keys(after)).toEqual(expect.arrayContaining(keys(before)));
  });
});
