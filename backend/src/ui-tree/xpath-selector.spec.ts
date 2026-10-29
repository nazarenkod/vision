import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from './ui-tree.parser';
import { evaluateXpath, parseXpath, xpathProblem } from './xpath-selector';

const fixture = (name: string) => readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');
const android = parseUiTree(fixture('android-offers.xml'), { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
// at the tree's own width iOS points are pixels, so bounds read as in the page source
const ios = parseUiTree(fixture('ios-offers.xml'), { imageWidth: 390, imageHeight: 844 });

const find = (tree: typeof android, expression: string) => {
  const parsed = parseXpath(expression);
  if (!parsed.ok) throw new Error(`${expression}: ${parsed.problem}`);
  return evaluateXpath(tree, parsed.xpath).map(({ bounds: b }) =>
    tree === ios ? `${b.x},${b.y},${b.width},${b.height}` : `[${b.x},${b.y}][${b.x + b.width},${b.y + b.height}]`
  );
};

describe('xpath selectors', () => {
  // expected: what xpath@0.0.34 over @xmldom/xmldom finds on the raw fixture, as Appium would
  it('finds what XPath over the page source finds', () => {
    const offers = "//*[@resource-id='com.bank.app:id/offers_list']";
    const label = "//*[@resource-id='com.bank.app:id/cashback_label']";
    expect(find(android, `${offers}/android.view.ViewGroup[1]/android.widget.ImageView[1]`)).toEqual([
      '[925,925][1005,1000]',
    ]);
    expect(find(android, `${offers}//android.widget.ImageView[1]`)).toEqual([
      '[42,900][1010,1250]',
      '[925,925][1005,1000]',
      '[75,1200][105,1235]',
      '[80,1455][120,1495]',
      '[1052,900][2020,1250]',
      '[1935,925][2015,1000]',
      '[1085,1200][1115,1235]',
      '[1090,1455][1130,1495]',
    ]);
    expect(find(android, `${label}/..`)).toEqual(['[810,1270][995,1310]', '[1820,1270][2005,1310]']);
    expect(find(android, `${label}/../..`)).toEqual(['[42,900][1010,1520]', '[1052,900][2020,1520]']);
    expect(find(android, `${label}/ancestor::android.view.ViewGroup[2]`)).toEqual([
      '[42,900][1010,1520]',
      '[1052,900][2020,1520]',
    ]);
    expect(find(android, `${label}/ancestor::*[3]`)).toEqual(['[0,840][1080,1540]']);
    expect(
      find(
        android,
        "//*[@content-desc='-211 днів Побутова техніка кешбек до 3%']/android.widget.LinearLayout/android.widget.ImageView[2]"
      )
    ).toEqual(['[140,1455][180,1495]']);
    expect(find(android, "//android.widget.TextView[@text='Привіт']/..")).toEqual(['[0,63][1080,200]']);
    expect(find(android, "//*[@text='кешбек до 5%']/..")).toEqual(['[1820,1270][2005,1310]']);
    expect(find(android, `${offers}//*[2]`)).toEqual([
      '[925,925][1005,1000]',
      '[140,1455][180,1495]',
      '[1052,900][2020,1520]',
      '[1935,925][2015,1000]',
      '[1150,1455][1190,1495]',
    ]);

    expect(find(ios, "//*[@name='offersList']/XCUIElementTypeCell[1]/XCUIElementTypeButton[1]")).toEqual([
      '316,328,32,32',
    ]);
    expect(find(ios, "//*[@name='cashbackLabel']/..")).toEqual(['280,450,70,20']);
    expect(find(ios, "//*[@label='-211 днів Побутова техніка']//XCUIElementTypeOther[2]")).toEqual(['280,450,70,20']);
    expect(find(ios, "//XCUIElementTypeCell[@name='-211 днів Побутова техніка']/XCUIElementTypeOther[1]")).toEqual([
      '16,320,340,120',
    ]);
  });

  it('accepts an anchor with steps down or steps up', () => {
    expect(parseXpath("//*[@resource-id='com.app:id/list']/android.view.ViewGroup[1]//*[2]")).toEqual({
      ok: true,
      xpath: {
        anchor: { test: '*', attribute: 'resource-id', value: 'com.app:id/list' },
        steps: [
          { axis: 'child', test: 'android.view.ViewGroup', position: 1 },
          { axis: 'descendant', test: '*', position: 2 },
        ],
      },
    });
    expect(parseXpath('//XCUIElementTypeStaticText[@label="it\'s"]/../ancestor::XCUIElementTypeCell[1]')).toEqual({
      ok: true,
      xpath: {
        anchor: { test: 'XCUIElementTypeStaticText', attribute: 'label', value: "it's" },
        steps: [
          { axis: 'parent', test: '*' },
          { axis: 'ancestor', test: 'XCUIElementTypeCell', position: 1 },
        ],
      },
    });
    expect(xpathProblem("xpath://*[@text='Pay']")).toBeNull();
  });

  it('rejects siblings, functions, or, several anchors and mixed directions', () => {
    const problem = (expression: string) => xpathProblem(`xpath:${expression}`);
    expect(problem("//*[@text='Побутова техніка']/following-sibling::*[1]")).toBe('axis');
    expect(problem("//*[contains(@content-desc,'Побутова')]")).toBe('function');
    expect(problem('count(//*)')).toBe('function');
    expect(problem("//*[@text='a' or @text='b']")).toBe('or');
    expect(problem("//*[@text='a'] | //*[@text='b']")).toBe('or');
    expect(problem("//*[@text='a' and @resource-id='b']")).toBe('anchor');
    expect(problem("//*[@text='a']/android.view.View[@text='b']")).toBe('anchor');
    expect(problem('//android.widget.ImageView[2]')).toBe('anchor');
    expect(problem("/hierarchy/*[@text='a']")).toBe('anchor');
    expect(problem("//*[@class='android.widget.Button']")).toBe('attribute');
    expect(problem("//*[@text='a']/../android.widget.ImageView[1]")).toBe('mixed');
    // a value in quotes may hold the words and brackets the checks look for
    expect(problem("//*[@text='or (contains) | following-sibling::']")).toBeNull();
  });

  it('rejects text that does not parse', () => {
    const problem = (expression: string) => xpathProblem(`xpath:${expression}`);
    expect(problem("//*[@text='a']/")).toBe('syntax');
    expect(problem("//*[@text='a']/android.view.View[0]")).toBe('syntax');
    expect(problem("//*[@text='a']garbage")).toBe('syntax');
    expect(problem('//')).toBe('syntax');
  });

  it('finds nothing for an attribute the platform does not have', () => {
    expect(find(ios, "//*[@resource-id='cashbackLabel']")).toEqual([]);
    expect(find(android, "//*[@name='com.bank.app:id/offers_list']")).toEqual([]);
  });
});
