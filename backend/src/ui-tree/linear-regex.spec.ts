import { compileLinear, isLinearRegex } from './linear-regex';
import { PLACE_PATTERNS, SELECTOR_PATTERNS, TEXTS } from './pattern-corpus';

const NO_BACKTRACKING = ['(a+)+$'];

describe('patterns on an engine with linear time (051)', () => {
  it('finds what RegExp found for every pattern and text', () => {
    const patterns: Array<[string, string]> = [
      ...SELECTOR_PATTERNS,
      ...PLACE_PATTERNS.map((pattern): [string, string] => [`^ *(?:${pattern}) *$`, 'u']),
      ...PLACE_PATTERNS.map((pattern): [string, string] => [`^ *Сума +(?:${pattern}) +₴ *$`, 'u']),
    ];
    const differences: string[] = [];
    let compared = 0;
    let matched = 0;
    for (const [source, flags] of patterns) {
      const linear = compileLinear(source, flags);
      if (!isLinearRegex(linear)) {
        differences.push(`/${source}/${flags} does not compile: ${linear}`);
        continue;
      }
      const native = new RegExp(source, flags);
      for (const text of NO_BACKTRACKING.includes(source) ? TEXTS.filter((t) => t.length < 20) : TEXTS) {
        compared++;
        if (native.test(text)) matched++;
        if (linear.test(text) !== native.test(text)) {
          differences.push(`/${source}/${flags} on ${JSON.stringify(text)}: RegExp ${native.test(text)}`);
        }
      }
    }
    expect(differences).toEqual([]);
    // the corpus really compares: thousands of pairs, both answers among them
    expect(compared).toBeGreaterThan(3000);
    expect(matched).toBeGreaterThan(300);
    expect(compared - matched).toBeGreaterThan(300);
  });

  it('finds what RegExp found for thousands of generated patterns', () => {
    let state = 7;
    const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = <T>(items: T[]) => items[Math.floor(next() * items.length)];
    const atoms = [
      'a',
      'б',
      'B',
      'Б',
      '1',
      ' ',
      '\\u00a0',
      '\\s',
      '\\S',
      '\\d',
      '\\D',
      '\\w',
      '\\W',
      '.',
      '[a-c]',
      '[^a]',
      '[\\s1]',
      '[\\S]',
      '[^\\s\\d]',
      '\\.',
      '\\b',
      '[.]',
      '\\t',
      '\\x41',
      '\\u0431',
      '\\p{L}',
      '\\P{L}',
      '[\\p{Lu}1]',
      ':',
      '-',
    ];
    const quantifiers = ['', '', '', '?', '*', '+', '{2}', '{1,2}', '{0,}', '*?', '+?'];
    const generate = (depth: number): string => {
      const parts = Array.from({ length: 1 + Math.floor(next() * 3) }, () => {
        const atom =
          depth < 2 && next() < 0.2
            ? `(?:${generate(depth + 1)}${next() < 0.3 ? '|' + generate(depth + 1) : ''})`
            : pick(atoms);
        // a quantifier on a group only at the top: nested ones would backtrack in RegExp itself
        return atom + (depth === 0 || !atom.startsWith('(') ? pick(quantifiers) : '');
      });
      return (next() < 0.2 ? '^' : '') + parts.join('') + (next() < 0.2 ? '$' : '');
    };
    const letters = [
      'a',
      'b',
      'c',
      'б',
      'Б',
      'B',
      '1',
      '2',
      ' ',
      '\u00a0',
      '\u202f',
      '\n',
      '\r',
      '\t',
      ':',
      '.',
      '-',
      'A',
      'É',
      'é',
      '😀',
    ];
    const texts = Array.from({ length: 40 }, () =>
      Array.from({ length: Math.floor(next() * 8) }, () => pick(letters)).join('')
    );
    const differences: string[] = [];
    let compared = 0;
    for (let i = 0; i < 3000; i++) {
      const source = generate(0);
      const flags = pick(['', 'u', 'i', 'iu']);
      let native: RegExp;
      try {
        native = new RegExp(source, flags);
      } catch {
        continue;
      }
      const linear = compileLinear(source, flags);
      if (!isLinearRegex(linear)) {
        differences.push(`/${source}/${flags} does not compile: ${linear}`);
        continue;
      }
      for (const text of texts) {
        compared++;
        if (linear.test(text) !== native.test(text)) {
          differences.push(`/${source}/${flags} on ${JSON.stringify(text)}: RegExp ${native.test(text)}`);
        }
      }
    }
    expect(differences.slice(0, 20)).toEqual([]);
    expect(compared).toBeGreaterThan(50_000);
  });

  it('refuses back-references and look-around with a reason', () => {
    expect(compileLinear('(a)\\1')).toBe('backreference');
    expect(compileLinear('(?<x>a)\\k<x>')).toBe('backreference');
    expect(compileLinear('Pay(?= now)')).toBe('lookaround');
    expect(compileLinear('Pay(?! now)')).toBe('lookaround');
    expect(compileLinear('(?<=Сума )\\d+', 'u')).toBe('lookaround');
    expect(compileLinear('(?<!-)\\d+')).toBe('lookaround');
    // what JavaScript does not take either
    expect(compileLinear('(unclosed')).toBe('syntax');
    expect(compileLinear('\\p{L', 'u')).toBe('syntax');
  });

  it('checks a catastrophic pattern on 2000 characters in under 50 ms', () => {
    const text = 'a'.repeat(1999) + '!';
    for (const source of ['(a+)+$', '(a|aa)+$', '(\\w+\\s?)+$', '^(\\d+)*x']) {
      const pattern = compileLinear(source);
      if (!isLinearRegex(pattern)) throw new Error(`${source}: ${pattern}`);
      const started = performance.now();
      pattern.test(text);
      expect(performance.now() - started).toBeLessThan(50);
    }
  });

  it('reads a no-break space as a space, as JavaScript does', () => {
    const amount = compileLinear('^\\d{1,3}(?:\\s\\d{3})*$', 'u');
    if (!isLinearRegex(amount)) throw new Error(amount);
    expect(amount.test('1 250')).toBe(true);
    expect(amount.test('1 250')).toBe(true);
    expect(amount.test('1x250')).toBe(false);
  });
});
