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
      xml.replace('resource-id="com.bank.app:id/btn_help"', 'resource-id=""').replace('content-desc="Help"', '')
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
