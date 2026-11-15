import { readFileSync } from 'fs';
import { join } from 'path';
import { parseUiTree } from './ui-tree.parser';
import { UiTree } from './ui-tree.types';
import { diffTrees } from './structure-diff';
import { computeMoves, findBySelector, findSystemBars, resolveRules } from './comparison-inputs';
import { pickableElements } from './ui-tree.service';

// collected in Chromium by web-tree/collect-tree.js: the same page, then with a sale banner on top
const page = (name: string): UiTree =>
  parseUiTree(readFileSync(join(__dirname, '__fixtures__', 'web', `${name}.html`), 'utf8'), {
    imageWidth: 800,
    imageHeight: 600,
  });

describe('comparing web pages by element', () => {
  it('does not mark the list as changed when a banner pushes it down', () => {
    const before = page('shop');
    const after = page('shop-banner');
    const changes = diffTrees(before, after);

    // the list and what is in it only moved: a move is compensated, not a change of the list
    const ofList = changes.filter((change) => ['id:list', 'a:Tea', 'a:Coffee', 'id:buy'].includes(change.key));
    expect(ofList.map((change) => change.kind)).toEqual(['moved', 'moved', 'moved', 'moved']);
    const moves = computeMoves(before, after, null);
    expect(moves.find((move) => move.key === 'id:list')).toMatchObject({
      to: { y: before.nodes.find((n) => n.key === 'id:list').bounds.y + 80 },
    });
    // the banner is what changed
    expect(changes.filter((change) => change.key === 'id:promo').map((change) => change.kind)).toContain('resized');
  });

  it('finds web elements by id, text and xpath rules', () => {
    const tree = page('shop');

    expect(findBySelector(tree, 'id:clock').map((node) => node.text)).toEqual(['12:00']);
    expect(findBySelector(tree, 'text:Coffee').map((node) => node.className)).toEqual(['a']);
    expect(findBySelector(tree, "xpath://*[@id='list']/li[2]/a").map((node) => node.text)).toEqual(['Coffee']);
    expect(findBySelector(tree, "xpath://*[@aria-label='Close']")).toEqual([]);

    // an ignore rule on the clock leaves its place out of the pixel comparison
    const resolved = resolveRules([{ id: 'r1', selector: 'id:clock', action: 'ignore' }], [tree, page('shop-banner')]);
    expect(resolved.matches.r1).toBe(1);
    // with a margin around the element, on both screenshots, as for a mobile screen
    const clock = tree.nodes.find((node) => node.resourceId === 'clock').bounds;
    expect(resolved.ignore.length).toBeGreaterThan(0);
    for (const area of resolved.ignore) {
      expect(area.x).toBeLessThanOrEqual(clock.x);
      expect(area.y).toBeLessThanOrEqual(clock.y);
      expect(area.x + area.width).toBeGreaterThanOrEqual(clock.x + clock.width);
      expect(area.y + area.height).toBeGreaterThanOrEqual(clock.y + clock.height);
    }
  });

  it('lets an element on a web page be picked on the screenshot', () => {
    const picked = pickableElements(page('shop'));
    expect(picked.find((element) => element.selector === 'id:menu')).toMatchObject({
      bounds: { x: 764, y: 18, width: 20, height: 20 },
    });
    // without positions there is nothing to pick (REQ-050-09)
    const plain = parseUiTree(readFileSync(join(__dirname, '__fixtures__', 'web', 'shop-page-source.html'), 'utf8'), {
      imageWidth: 800,
      imageHeight: 600,
    });
    expect(pickableElements(plain)).toEqual([]);
  });

  it('leaves no system bars out of a web page', () => {
    expect(findSystemBars(page('shop'))).toEqual([]);
  });
});
