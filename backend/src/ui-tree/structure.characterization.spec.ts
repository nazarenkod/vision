import { readFileSync } from 'fs';
import path from 'path';
import { findBySelector } from './comparison-inputs';
import { pathFromIdAbove, selectorVariants } from './selector-variants';
import { parseUiTree } from './ui-tree.parser';
import { pickableElements } from './ui-tree.service';
import { UiTree } from './ui-tree.types';

/*
 * Pins what the structure view and the element rules give today, so that making them faster
 * (VIS-SEC-043) cannot change a single selector, variant or match. The snapshots were taken
 * before the change; a difference in them is a change of behaviour, not a new expectation.
 */

const fixture = (name: string) => readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');
const android = (xml: string) => parseUiTree(xml, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
const ios = (xml: string) => parseUiTree(xml, { imageWidth: 1170, imageHeight: 2532 });

// the same pseudo-random screens on every run
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const ANDROID_CLASSES = [
  'android.widget.FrameLayout',
  'android.widget.LinearLayout',
  'android.view.ViewGroup',
  'android.widget.TextView',
  'android.widget.ImageView',
  'android.widget.Button',
];
const IOS_CLASSES = [
  'XCUIElementTypeOther',
  'XCUIElementTypeCell',
  'XCUIElementTypeStaticText',
  'XCUIElementTypeButton',
  'XCUIElementTypeImage',
];

/**
 * A screen with what real ones have: lists of look-alike rows, ids from the app and from the
 * system, texts, labels, elements with no name, invisible and zero-size ones, wrappers with the
 * bounds of their only child, and texts with quotes that XPath cannot always write.
 */
function syntheticScreen(seed: number, platform: 'android' | 'ios', size: number): string {
  const next = random(seed);
  const pick = <T>(items: T[]) => items[Math.floor(next() * items.length)];
  const classes = platform === 'android' ? ANDROID_CLASSES : IOS_CLASSES;
  const texts = ['', '', '', 'Pay', 'Оплатити', "Don't", 'say "hi"', 'Сума 1 250,00 ₴', '  ', 'Card •••• 4242'];
  let count = 0;

  const element = (x: number, y: number, width: number, height: number, depth: number): string => {
    count++;
    const className = pick(classes);
    const roll = next();
    const id = roll < 0.2 ? `com.bank.app:id/item_${Math.floor(next() * 6)}` : roll < 0.27 ? 'android:id/content' : '';
    const text = pick(texts);
    const label = next() < 0.15 ? pick(['Back', 'Close', 'Меню', '']) : '';
    const visible = next() < 0.95;
    const [w, h] = next() < 0.04 ? [0, height] : [width, height];

    let children = '';
    if (depth < 6 && count < size && height > 12) {
      // the screen and its first levels always hold something; deeper ones now and then
      const rows =
        depth < 2 ? 3 + Math.floor(next() * 6) : next() < 0.35 ? 1 + Math.floor(next() * 8) : Math.floor(next() * 3);
      const rowHeight = Math.max(8, Math.floor(height / Math.max(rows, 1)));
      for (let i = 0; i < rows && count < size; i++) {
        // a wrapper the size of its parent now and then, as layouts nest
        const same = rows === 1 && next() < 0.4;
        children += same
          ? element(x, y, width, height, depth + 1)
          : element(x + 4, y + i * rowHeight + 2, Math.max(1, width - 8), Math.max(1, rowHeight - 4), depth + 1);
      }
    }

    if (platform === 'android') {
      const attrs =
        `class="${className}" package="com.bank.app" resource-id="${id}" text="${escape(text)}" ` +
        `content-desc="${escape(label)}" clickable="${next() < 0.3}" enabled="true" focusable="false" ` +
        `displayed="${visible}" bounds="[${x},${y}][${x + w},${y + h}]"`;
      return children ? `<${className} ${attrs}>${children}</${className}>` : `<${className} ${attrs}/>`;
    }
    const name = id ? id.replace(/^.*:id\//, '') : '';
    const attrs =
      `type="${className}" name="${escape(name || text)}" label="${escape(label || text)}" enabled="true" ` +
      `visible="${visible}" accessible="${next() < 0.5}" x="${x / 3}" y="${y / 3}" width="${w / 3}" height="${h / 3}"`;
    return children ? `<${className} ${attrs}>${children}</${className}>` : `<${className} ${attrs}/>`;
  };

  if (platform === 'android') {
    return (
      `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0" width="1080" height="2400">` +
      element(0, 0, 1080, 2400, 0) +
      '</hierarchy>'
    );
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?><AppiumAUT>` +
    `<XCUIElementTypeApplication type="XCUIElementTypeApplication" name="Bank" label="Bank" enabled="true" ` +
    `visible="true" accessible="false" x="0" y="0" width="390" height="844">` +
    element(0, 0, 1170, 2532, 0) +
    '</XCUIElementTypeApplication></AppiumAUT>'
  );
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A wide list of rows with no name under one id: the shape VIS-SEC-043 was about, kept small here. */
function wideList(rows: number, rowClasses: string[]): string {
  const items = Array.from({ length: rows }, (_, i) => {
    const className = rowClasses[i % rowClasses.length];
    const text = i % 7 === 0 ? `Row ${i}` : '';
    return (
      `<${className} class="${className}" resource-id="" text="${text}" content-desc="" displayed="true" ` +
      `bounds="[0,${i * 20}][1080,${i * 20 + 18}]"/>`
    );
  }).join('');
  return (
    `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0" width="1080" height="2400">` +
    `<android.widget.FrameLayout class="android.widget.FrameLayout" resource-id="com.bank.app:id/root" ` +
    `text="" content-desc="" displayed="true" bounds="[0,0][1080,2400]">${items}</android.widget.FrameLayout></hierarchy>`
  );
}

/**
 * Rows of a list that share one id, as a RecyclerView gives them, each with parts of no name: every
 * part's path starts from all the rows at once (VIS-SEC-043, again). Some parts are hidden, some rows
 * lack a part, and some parts are found from a text below them.
 */
function sharedIdList(rows: number): string {
  const part = (className: string, x: number, y: number, shown = true, inside = '') =>
    `<${className} class="${className}" resource-id="" text="" content-desc="" displayed="${shown}" ` +
    `bounds="[${x},${y}][${x + 90},${y + 18}]">${inside}</${className}>`;
  const items = Array.from({ length: rows }, (_, i) => {
    const y = i * 20;
    const label =
      i % 5 === 0
        ? `<android.widget.TextView class="android.widget.TextView" resource-id="" text="Amount" content-desc="" ` +
          `displayed="true" bounds="[400,${y}][480,${y + 18}]"/>`
        : '';
    const parts =
      part('android.view.View', 0, y) +
      (i % 3 === 0 ? '' : part('android.view.View', 100, y, i % 4 !== 0)) +
      part('android.widget.ImageView', 200, y) +
      (label ? part('android.view.ViewGroup', 300, y, true, label) : '');
    return (
      `<android.widget.LinearLayout class="android.widget.LinearLayout" resource-id="com.bank.app:id/row" text="" ` +
      `content-desc="" displayed="true" bounds="[0,${y}][1080,${y + 18}]">${parts}</android.widget.LinearLayout>`
    );
  }).join('');
  return (
    `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0" width="1080" height="2400">` +
    `<android.widget.FrameLayout class="android.widget.FrameLayout" resource-id="com.bank.app:id/root" ` +
    `text="" content-desc="" displayed="true" bounds="[0,0][1080,2400]">${items}</android.widget.FrameLayout></hierarchy>`
  );
}

const trees: Record<string, () => UiTree> = {
  'android-offers': () => android(fixture('android-offers.xml')),
  'android-payment': () => android(fixture('android-payment.xml')),
  'ios-offers': () => ios(fixture('ios-offers.xml')),
  'ios-payment': () => ios(fixture('ios-payment.xml')),
  'synthetic android 1': () => android(syntheticScreen(1, 'android', 400)),
  'synthetic android 2': () => android(syntheticScreen(2, 'android', 400)),
  'synthetic android 3': () => android(syntheticScreen(3, 'android', 400)),
  'synthetic ios 1': () => ios(syntheticScreen(11, 'ios', 400)),
  'synthetic ios 2': () => ios(syntheticScreen(12, 'ios', 400)),
  'wide list': () =>
    android(wideList(300, ['android.view.View', 'android.view.View', 'android.widget.ImageView', 'android.view.View'])),
  'rows sharing one id': () => android(sharedIdList(60)),
};

// short and diffable: one line per element
const describeElements = (tree: UiTree) =>
  pickableElements(tree).map((element) =>
    JSON.stringify([
      element.index,
      element.parent,
      element.selector,
      element.nameless ?? false,
      element.text ?? null,
      element.stableSelector ?? null,
      element.bounds,
      (element.variants ?? []).map((v) => [v.selector, v.direction, v.anchor, v.anchorKind, v.levels, v.count]),
    ])
  );

/** Expressions a rule may hold: every one the screen offers, and the wider ones people write by hand. */
function selectorsFor(tree: UiTree): string[] {
  const offered = pickableElements(tree).flatMap((element) => [
    element.selector,
    ...(element.stableSelector ? [element.stableSelector] : []),
    ...(element.variants ?? []).map((variant) => variant.selector),
  ]);
  const ids = [...new Set(tree.nodes.map((node) => node.resourceId).filter(Boolean))].slice(0, 6);
  const attribute = tree.format === 'appium-ios' ? 'name' : 'resource-id';
  const classes = [...new Set(tree.nodes.map((node) => node.className))].slice(0, 3);
  const written = ids.flatMap((id) => [
    `xpath://*[@${attribute}='${id}']`,
    `xpath://*[@${attribute}='${id}']/*`,
    `xpath://*[@${attribute}='${id}']/*[2]`,
    `xpath://*[@${attribute}='${id}']//*`,
    `xpath://*[@${attribute}='${id}']//*[1]`,
    `xpath://*[@${attribute}='${id}']/..`,
    `xpath://*[@${attribute}='${id}']/../..`,
    `xpath://*[@${attribute}='${id}']/ancestor::*`,
    `xpath://*[@${attribute}='${id}']/ancestor::*[2]`,
    ...classes.flatMap((className) => [
      `xpath://*[@${attribute}='${id}']/${className}`,
      `xpath://*[@${attribute}='${id}']/${className}[1]`,
      `xpath://*[@${attribute}='${id}']/${className}[3]`,
      `xpath://*[@${attribute}='${id}']//${className}`,
      `xpath://*[@${attribute}='${id}']//${className}[2]`,
      `xpath://*[@${attribute}='${id}']/*/${className}[1]`,
      `xpath://*[@${attribute}='${id}']/ancestor::${className}`,
      `xpath://${className}[@${attribute}='${id}']/*`,
    ]),
  ]);
  return [...new Set([...offered, ...written])];
}

const describeMatches = (tree: UiTree) =>
  selectorsFor(tree).map(
    (selector) => `${selector} → ${JSON.stringify(findBySelector(tree, selector)?.map((n) => n.index) ?? null)}`
  );

describe('structure view and element rules, as they are (characterization for VIS-SEC-043)', () => {
  for (const [name, build] of Object.entries(trees)) {
    describe(name, () => {
      const tree = build();

      it('offers the same elements, selectors and variants for picking', () => {
        expect(describeElements(tree)).toMatchSnapshot();
      });

      it('finds the same elements for every selector a rule may hold', () => {
        expect(describeMatches(tree)).toMatchSnapshot();
      });

      it('builds the same paths and variants for every element', () => {
        const described = tree.nodes.map((node) =>
          JSON.stringify([
            node.index,
            pathFromIdAbove(tree, node),
            selectorVariants(tree, node).map((v) => [v.selector, v.direction, v.levels, v.count]),
          ])
        );
        expect(described).toMatchSnapshot();
      });
    });
  }

  it('gives the same answer when asked twice for the same tree', () => {
    const tree = trees['synthetic android 1']();
    expect(describeElements(tree)).toEqual(describeElements(tree));
    expect(describeMatches(tree)).toEqual(describeMatches(tree));
  });
});
