import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from './ui-tree.parser';
import { pickableElements } from './ui-tree.service';

const xml = readFileSync(path.join(__dirname, '__fixtures__', 'android-payment.xml'), 'utf8');
const parse = (source: string) => parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });

describe('pickableElements', () => {
  it('gives each element the selector a rule would use: its id, else its text', () => {
    const elements = pickableElements(parse(xml));
    expect(elements).toContainEqual(
      expect.objectContaining({ selector: 'id:btn_pay', bounds: { x: 42, y: 2200, width: 996, height: 126 } })
    );
    expect(elements.find((e) => e.selector === 'id:btn_help')?.element).toContain('Help');
  });

  it('leaves out the full-screen root and elements nothing can find', () => {
    const tree = parse(
      xml
        .replace('resource-id="com.bank.app:id/btn_help"', 'resource-id=""')
        .replace('content-desc="Help"', '')
        // with an id on the toolbar the button would be found by a path from it (spec 027)
        .replace('resource-id="com.bank.app:id/toolbar"', 'resource-id=""')
        .replace('resource-id="com.bank.app:id/toolbar_title"', 'resource-id=""')
        .replace('text="Payment"', 'text=""')
        .replace('content-desc="Navigate up"', '')
    );
    const elements = pickableElements(tree);
    expect(elements.some((e) => e.bounds.width === 1080 && e.bounds.height === 2400)).toBe(false);
    expect(elements.some((e) => e.bounds.x === 960 && e.bounds.y === 100)).toBe(false);
  });

  it('picks by text when the element has no id of its own', () => {
    const tree = parse(xml.replace('resource-id="com.bank.app:id/btn_pay"', 'resource-id=""'));
    expect(pickableElements(tree).map((e) => e.selector)).toContain('text:Pay');
  });
});

describe('pickableElements: elements with no name (spec 027)', () => {
  const offers = readFileSync(path.join(__dirname, '__fixtures__', 'android-offers.xml'), 'utf8');
  const tree = parse(offers);
  const elements = pickableElements(tree);
  const at = (x: number, y: number) => elements.filter((e) => e.bounds.x === x && e.bounds.y === y);

  it('offers a nameless element inside a named one', () => {
    const [plus] = at(925, 925);
    expect(plus).toMatchObject({
      nameless: true,
      selector:
        "xpath://*[@resource-id='com.bank.app:id/offers_list']/android.view.ViewGroup[1]/android.widget.ImageView[1]",
      element: 'ImageView',
    });
    expect(plus.variants).toHaveLength(1);
    // the card around it is still there to step up to
    expect(elements.find((e) => e.index === plus.parent)?.selector).toBe(
      'text:-211 днів Побутова техніка кешбек до 3%'
    );
    // the timer, the badge and both rating buttons too
    expect(at(70, 1195)).toHaveLength(1);
    expect(at(810, 1270)).toHaveLength(1);
    expect(at(80, 1455)).toHaveLength(1);
    expect(at(140, 1455)).toHaveLength(1);
  });

  it('leaves out a nameless wrapper the size of its parent or child', () => {
    // the picture is a frame around an image of the same size: one of them is offered
    const picture = elements.filter((e) => e.bounds.x === 42 && e.bounds.y === 900 && e.bounds.height === 350);
    expect(picture).toHaveLength(1);
    // the innermost one: a step up then lands on the card, not on a frame of the same size
    expect(tree.nodes[picture[0].index].className).toBe('android.widget.ImageView');
    const sameAsNamed = parse(offers.replace('bounds="[815,1275][990,1305]"', 'bounds="[810,1270][995,1310]"'));
    // a badge frame exactly as big as its label is the label
    expect(
      pickableElements(sameAsNamed)
        .filter((e) => e.bounds.x === 810 && e.bounds.y === 1270)
        .map((e) => e.selector)
    ).toEqual(['id:cashback_label']);
  });

  it('leaves out a nameless element with nothing stable above or below', () => {
    // the tab bar at the bottom: no id, no text in it or around it
    expect(at(0, 2200)).toEqual([]);
    expect(at(100, 2220)).toEqual([]);
  });

  it('offers named elements as before', () => {
    const named = (source: string, width = 1080, height = 2400) =>
      pickableElements(parseUiTree(source, { imageWidth: width, imageHeight: height, densityDpi: 420 }))
        .filter((e) => !e.nameless)
        .map((e) => [e.index, e.selector, e.element]);
    // what the screen offered before spec 027
    expect(named(offers)).toEqual([
      [2, 'id:header', 'ViewGroup (id/header)'],
      [3, 'text:Привіт', 'TextView "Привіт"'],
      [4, 'text:Search', 'ImageView "Search"'],
      [5, 'id:offers_list', 'RecyclerView (id/offers_list)'],
      [6, 'text:-211 днів Побутова техніка кешбек до 3%', 'ViewGroup "-211 днів Побутова техніка кешбек до 3%"'],
      [13, 'id:cashback_label', 'TextView "кешбек до 3%" (id/cashback_label)'],
      [17, 'text:-211 днів Кешбек на все кешбек до 5%', 'ViewGroup "-211 днів Кешбек на все кешбек до 5%"'],
      [24, 'id:cashback_label', 'TextView "кешбек до 5%" (id/cashback_label)'],
    ]);
    expect(named(xml).map(([, selector]) => selector)).toEqual([
      'id:toolbar',
      'text:Navigate up',
      'id:toolbar_title',
      'id:btn_help',
      'id:et_recipient',
      'id:btn_scan_qr',
      'id:et_amount',
      'id:tv_fee',
      'id:row_template',
      'text:Use template',
      'id:btn_next_top',
      'id:btn_next_bottom',
      'id:btn_close',
      'id:btn_pay',
    ]);
  });

  it('works out the elements of a 2 000-node screen in under half a second', () => {
    const card = offers.slice(
      offers.indexOf('<android.view.ViewGroup class="android.view.ViewGroup" text="" content-desc="-211'),
      offers.indexOf('<android.view.ViewGroup class="android.view.ViewGroup" text="" content-desc="-211 днів Кешбек')
    );
    const big = offers.replace(card, card.repeat(200));
    const large = parse(big);
    expect(large.nodes.length).toBeGreaterThan(2000);
    const started = Date.now();
    pickableElements(large);
    // about 100 ms on its own; the whole suite runs in parallel and doubles it
    expect(Date.now() - started).toBeLessThan(500);
  });
});
