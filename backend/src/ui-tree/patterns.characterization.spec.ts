import { matchesSelector, parseSelector, selectorProblem } from './comparison-inputs';
import { PLACE_PATTERNS, SELECTOR_PATTERNS, TEXTS } from './pattern-corpus';
import { UiNode } from './ui-tree.types';
import { checkVariableText, partsProblem, TextPart } from './variable-text';

/*
 * Pins what element rules with a pattern find today, so that running them on an engine with
 * linear time (051, VIS-SEC-015) changes no match. The snapshots were taken before the change.
 */

const node = (text: string) => ({ text, label: '', resourceId: '', className: 'android.widget.TextView' }) as UiNode;

describe('element rules with a pattern, as they are (characterization for VIS-SEC-015)', () => {
  it('finds the same texts with a text:/…/ selector', () => {
    const rows = SELECTOR_PATTERNS.map(([source, flags]) => {
      const selector = `text:/${source}/${flags}`;
      const parsed = parseSelector(selector);
      const found = parsed ? TEXTS.map((text) => (matchesSelector(node(text), parsed) ? 1 : 0)).join('') : null;
      return `${selector} problem=${selectorProblem(selector)} ${found}`;
    });
    expect(rows).toMatchSnapshot();
  });

  it('checks variable texts the same way', () => {
    const shapes: TextPart[][] = PLACE_PATTERNS.flatMap((pattern) => [
      [{ pattern }],
      [{ text: 'Сума ' }, { pattern }, { text: ' ₴' }],
      [{ text: 'Updated at ' }, { pattern }],
    ]);
    const rows = shapes.map((parts) => {
      const results = TEXTS.map((text) => {
        const result = checkVariableText(parts, text);
        return result.ok ? 'ok' : result.reason;
      });
      return `${JSON.stringify(parts)} problem=${partsProblem(parts)} ${results.join(',')}`;
    });
    expect(rows).toMatchSnapshot();
  });
});
