import { readFileSync } from 'fs';
import { join } from 'path';
import { inspectorTree, nodeLocators } from './inspector-tree';
import { parseUiTree } from './ui-tree.parser';
import { UiTree } from './ui-tree.types';

const ANDROID = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <android.widget.FrameLayout class="android.widget.FrameLayout" bounds="[0,0][1080,2400]" displayed="true">
    <android.widget.LinearLayout class="android.widget.LinearLayout" resource-id="com.shop.app:id/content" bounds="[0,0][1080,2400]">
      <android.widget.TextView class="android.widget.TextView" resource-id="com.shop.app:id/welcome" text="Welcome back" bounds="[120,700][960,800]" />
      <android.widget.Button class="android.widget.Button" resource-id="com.shop.app:id/sign_in" text="Sign in" content-desc="Sign in button" clickable="true" focusable="true" bounds="[96,1320][984,1480]" />
      <android.widget.ImageView class="android.widget.ImageView" bounds="[0,1500][100,1600]" />
      <android.widget.ImageView class="android.widget.ImageView" bounds="[100,1500][200,1600]" />
      <android.widget.TextView class="android.widget.TextView" text="Item" bounds="[0,1700][500,1800]" />
      <android.widget.TextView class="android.widget.TextView" text="Item" bounds="[500,1700][1080,1800]" />
      <android.view.View class="android.view.View" displayed="false" bounds="[0,0][10,10]" />
    </android.widget.LinearLayout>
  </android.widget.FrameLayout>
</hierarchy>`;

const IOS = `<?xml version="1.0" encoding="UTF-8"?>
<AppiumAUT>
  <XCUIElementTypeApplication type="XCUIElementTypeApplication" name="Shop" label="Shop" x="0" y="0" width="390" height="844">
    <XCUIElementTypeButton type="XCUIElementTypeButton" name="signIn" label="Sign in" enabled="true" visible="true" accessible="true" x="16" y="440" width="358" height="48" />
    <XCUIElementTypeStaticText type="XCUIElementTypeStaticText" value="Forgot password?" enabled="true" visible="true" x="100" y="500" width="190" height="20" />
  </XCUIElementTypeApplication>
</AppiumAUT>`;

const android = () => parseUiTree(ANDROID, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
const ios = () => parseUiTree(IOS, { imageWidth: 1170, imageHeight: 2532 });
const node = (tree: UiTree, test: (n: UiTree['nodes'][number]) => boolean) => tree.nodes.find(test);

describe('inspectorTree', () => {
  it('names Android attributes as UiAutomator writes them', () => {
    const tree = android();
    const button = inspectorTree(tree).nodes.find((n) => n.id === 'sign_in');
    expect(button).toMatchObject({ name: 'Button', className: 'android.widget.Button', text: 'Sign in' });
    expect(Object.fromEntries(button.attributes)).toMatchObject({
      class: 'android.widget.Button',
      'resource-id': 'com.shop.app:id/sign_in',
      text: 'Sign in',
      'content-desc': 'Sign in button',
      clickable: 'true',
      enabled: 'true',
      displayed: 'true',
      bounds: '[96,1320][984,1480]',
    });
    expect(button.bounds).toEqual({ x: 96, y: 1320, width: 888, height: 160 });
  });

  it('names iOS attributes in points as XCUITest writes them', () => {
    const tree = ios();
    const button = inspectorTree(tree).nodes.find((n) => n.name === 'Button');
    expect(Object.fromEntries(button.attributes)).toMatchObject({
      type: 'XCUIElementTypeButton',
      name: 'signIn',
      label: 'Sign in',
      x: '16',
      y: '440',
      width: '358',
      height: '48',
    });
    // on the screenshot, in its pixels: three per point
    expect(button.bounds).toEqual({ x: 48, y: 1320, width: 1074, height: 144 });
  });

  it('keeps nodes without a position in the tree without bounds', () => {
    const hidden = inspectorTree(android()).nodes.find((n) => n.name === 'View');
    expect(hidden).toMatchObject({ bounds: null, hidden: 'invisible' });

    const html = readFileSync(join(__dirname, '__fixtures__', 'web', 'shop-page-source.html'), 'utf8');
    const page = inspectorTree(parseUiTree(html, { imageWidth: 1280, imageHeight: 800 }));
    expect(page.positioned).toBe(false);
    expect(page.nodes.every((n) => n.bounds === null && n.hidden === 'unpositioned')).toBe(true);
  });
});

describe('nodeLocators', () => {
  it('builds an id, accessibility id and xpath for an Android element', () => {
    const tree = android();
    const { vision, test } = nodeLocators(
      tree,
      node(tree, (n) => n.resourceId.endsWith('sign_in'))
    );
    expect(vision).toEqual([{ kind: 'id', value: 'id:sign_in', matches: 1 }]);
    expect(test).toEqual([
      { kind: 'id', value: 'com.shop.app:id/sign_in', matches: 1 },
      { kind: 'accessibility id', value: 'Sign in button', matches: 1 },
      { kind: 'xpath', value: '//android.widget.Button[@resource-id="com.shop.app:id/sign_in"]', matches: 1 },
    ]);
  });

  it('goes the whole way down for an element with nothing of its own', () => {
    const tree = android();
    const second = tree.nodes.filter((n) => n.className === 'android.widget.ImageView')[1];
    const { vision, test } = nodeLocators(tree, second);
    expect(test).toEqual([
      {
        kind: 'xpath',
        value: '/hierarchy/android.widget.FrameLayout[1]/android.widget.LinearLayout[1]/android.widget.ImageView[2]',
        matches: 1,
      },
    ]);
    // Vision finds it by a path from the nearest id, as Select elements offers it (027)
    expect(vision[0].value).toMatch(/^xpath:/);
  });

  it('builds accessibility id, predicate and xpath for an iOS element', () => {
    const tree = ios();
    const { test } = nodeLocators(
      tree,
      node(tree, (n) => n.className === 'XCUIElementTypeButton')
    );
    expect(test).toEqual([
      { kind: 'accessibility id', value: 'signIn', matches: 1 },
      { kind: '-ios predicate string', value: "type == 'XCUIElementTypeButton' AND name == 'signIn'", matches: 1 },
      { kind: 'xpath', value: '//XCUIElementTypeButton[@name="signIn"]', matches: 1 },
    ]);
  });

  it('builds CSS and xpath for a web element', () => {
    const html = `<html><body><main><button id="pay">Pay</button><p>Total</p></main></body></html>`;
    const tree = parseUiTree(html, { imageWidth: 1280, imageHeight: 800 });
    const pay = node(tree, (n) => n.resourceId === 'pay');
    expect(nodeLocators(tree, pay).test).toEqual([
      { kind: 'css', value: '#pay', matches: 1 },
      { kind: 'xpath', value: '//button[@id="pay"]', matches: 1 },
    ]);
    const total = node(tree, (n) => n.text === 'Total');
    expect(nodeLocators(tree, total).test).toEqual([
      {
        kind: 'css',
        value: 'html:nth-of-type(1) > body:nth-of-type(1) > main:nth-of-type(1) > p:nth-of-type(1)',
        matches: 1,
      },
      { kind: 'xpath', value: '//p[normalize-space()="Total"]', matches: 1 },
    ]);
  });

  it('counts how many nodes each locator finds', () => {
    const tree = android();
    const item = node(tree, (n) => n.text === 'Item');
    const { vision, test } = nodeLocators(tree, item);
    expect(vision).toEqual([{ kind: 'text', value: 'text:Item', matches: 2 }]);
    expect(test).toEqual([{ kind: 'xpath', value: '//android.widget.TextView[@text="Item"]', matches: 2 }]);
  });
});
