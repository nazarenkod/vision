import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from './ui-tree.parser';
import { selectorVariants, stableKind } from './selector-variants';
import { UiTree } from './ui-tree.types';

const offers = readFileSync(path.join(__dirname, '__fixtures__', 'android-offers.xml'), 'utf8');
const parse = (source: string) => parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
const at = (tree: UiTree, x: number, y: number) =>
  tree.nodes.find((node) => node.bounds.x === x && node.bounds.y === y && !node.resourceId && !node.text);

const LIST = "//*[@resource-id='com.bank.app:id/offers_list']";
const LABEL = "//*[@resource-id='com.bank.app:id/cashback_label']";

describe('selectorVariants', () => {
  it('treats an app id or a text as stable, not a hint or a system id', () => {
    const tree = parse(offers);
    const kind = (match: (node: UiTree['nodes'][number]) => boolean) => stableKind(tree.nodes.find(match));
    expect(kind((node) => node.resourceId === 'com.bank.app:id/offers_list')).toBe('id');
    expect(kind((node) => node.text === 'Привіт')).toBe('text');
    expect(kind((node) => node.label.startsWith('-211 днів Побутова'))).toBe('text');
    expect(kind((node) => node.hint === 'Search')).toBeNull();
    expect(kind((node) => node.resourceId === 'android:id/statusBarBackground')).toBeNull();
  });

  it('goes down from the nearest ancestor with an id, past a nearer text', () => {
    const tree = parse(offers);
    const plus = at(tree, 925, 925);
    expect(selectorVariants(tree, plus)).toEqual([
      {
        selector: `xpath:${LIST}/android.view.ViewGroup[1]/android.widget.ImageView[1]`,
        direction: 'down',
        anchor: 'offers_list',
        anchorKind: 'id',
        count: 1,
      },
    ]);

    // with no id above, the card's label is the anchor
    const noList = parse(offers.replace('resource-id="com.bank.app:id/offers_list"', 'resource-id=""'));
    expect(selectorVariants(noList, at(noList, 925, 925))).toEqual([
      expect.objectContaining({
        selector: "xpath://*[@content-desc='-211 днів Побутова техніка кешбек до 3%']/android.widget.ImageView[1]",
        anchor: '-211 днів Побутова техніка кешбек до 3%',
        anchorKind: 'text',
        count: 1,
      }),
    ]);
  });

  it('offers a path up from the nearest stable descendant', () => {
    const tree = parse(offers);
    const badge = at(tree, 810, 1270);
    expect(selectorVariants(tree, badge)).toContainEqual({
      selector: `xpath:${LABEL}/..`,
      direction: 'up',
      anchor: 'cashback_label',
      anchorKind: 'id',
      count: 2,
    });
  });

  it('puts first the id variant that finds only this element', () => {
    const tree = parse(offers);
    expect(selectorVariants(tree, at(tree, 810, 1270)).map((variant) => [variant.direction, variant.count])).toEqual([
      ['down', 1],
      ['up', 2],
    ]);

    // an id below beats a text above, even when it finds the badge on every card
    const noList = parse(offers.replace('resource-id="com.bank.app:id/offers_list"', 'resource-id=""'));
    expect(
      selectorVariants(noList, at(noList, 810, 1270)).map((variant) => [variant.direction, variant.anchorKind])
    ).toEqual([
      ['up', 'id'],
      ['down', 'text'],
    ]);
  });

  it('quotes an anchor with an apostrophe and skips one with both quotes', () => {
    const withLabel = (label: string) =>
      parse(
        offers
          .replace('-211 днів Побутова техніка кешбек до 3%', label)
          .replace('resource-id="com.bank.app:id/offers_list"', 'resource-id=""')
      );
    const apostrophe = withLabel("It's a deal");
    expect(selectorVariants(apostrophe, at(apostrophe, 925, 925))[0].selector).toBe(
      `xpath://*[@content-desc="It's a deal"]/android.widget.ImageView[1]`
    );
    // XPath 1.0 cannot write this label without concat(), so the id below is the only anchor
    const both = withLabel(`"Побутова" it's`);
    expect(selectorVariants(both, at(both, 810, 1270)).map((variant) => variant.selector)).toEqual([
      `xpath:${LABEL}/..`,
    ]);
  });
});
