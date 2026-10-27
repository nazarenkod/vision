import { readFileSync } from 'fs';
import path from 'path';
import { parseUiTree } from './ui-tree.parser';
import { projectVocabulary } from './project-vocabulary';

const xml = readFileSync(path.join(__dirname, '__fixtures__', 'android-payment.xml'), 'utf8');
const parse = (source: string) => parseUiTree(source, { imageWidth: 1080, imageHeight: 2400, densityDpi: 420 });
const payment = parse(xml);
const transfer = parse(xml.replace('text="Payment"', 'text="Transfer"').replace('text="Pay"', 'text="Send"'));
// a screen without the toolbar title or the pay button
const help = parse(
  xml
    .replace(/<android.widget.TextView[^>]*toolbar_title[^>]*\/>/, '')
    .replace(/<android.widget.Button[^>]*btn_pay"[^>]*\/>/, '')
);

describe('projectVocabulary', () => {
  it('lists the elements, classes and screens of the trees with how often they occur', () => {
    const vocabulary = projectVocabulary(
      [
        { tree: payment, checkName: 'payment' },
        { tree: transfer, checkName: 'transfer' },
        { tree: help, checkName: 'help' },
      ],
      ['id:toolbar_title']
    );

    // screens are named as accessibility problems name them: by title, else by the check
    expect(vocabulary.screens).toEqual(['Payment', 'Transfer', 'help']);
    expect(vocabulary.trees).toBe(3);
    const pay = vocabulary.elements.find((item) => item.element === 'com.bank.app:id/btn_pay');
    expect(pay).toMatchObject({ selector: 'id:btn_pay', className: 'android.widget.Button', screens: [0, 1] });
    const close = vocabulary.elements.find((item) => item.element === 'com.bank.app:id/btn_close');
    expect(close).toMatchObject({ label: 'Close button', screens: [0, 1, 2] });
    // the most common elements come first
    expect(vocabulary.elements[0].screens).toHaveLength(3);
    expect(vocabulary.classes).toContainEqual({ name: 'ImageButton', screens: 3 });
    // invisible elements are left out: nothing can be seen to change on them
    expect(vocabulary.elements.some((item) => item.element.endsWith('btn_hidden'))).toBe(false);
  });

  it('suggests the title selector that names most screens differently', () => {
    const vocabulary = projectVocabulary(
      [
        { tree: payment, checkName: 'payment' },
        { tree: transfer, checkName: 'transfer' },
        { tree: help, checkName: 'help' },
      ],
      []
    );

    expect(vocabulary.titleCandidates[0]).toEqual({
      selector: 'id:toolbar_title',
      screens: 2,
      examples: ['Payment', 'Transfer'],
    });
    // the help button is in the app bar too, but names every screen the same
    expect(vocabulary.titleCandidates.some((item) => item.selector === 'id:btn_help')).toBe(false);
  });

  it('has nothing to suggest without trees', () => {
    expect(projectVocabulary([], ['id:Appbar#Title'])).toEqual({
      trees: 0,
      screens: [],
      elements: [],
      classes: [],
      titleCandidates: [],
    });
  });
});
