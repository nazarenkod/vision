import { RE2JS } from 're2js';
import { cacheWeight, compileLinear, isLinearRegex, programEstimate, translate } from './linear-regex';
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

  // found in review: a dash after a set in a class is a dash in JavaScript, a range to RE2
  it('reads a dash next to a set in a class as JavaScript does', () => {
    const patterns: Array<[string, string]> = [
      ['^\\+?[\\d\\s-()]+$', ''],
      ['[\\w\\s-.]+', ''],
      ['[\\s-.]', ''],
      ['[\\s-x]', ''],
      ['[\\s-\\d]', ''],
      ['[a-\\s]', ''],
      ['[\\S-x]', ''],
      ['[\\d-x]+', ''],
      ['[\\w-.]+', ''],
      ['[a-c-e]', ''],
      ['[-a]', ''],
      ['[a-]', ''],
    ];
    const texts = [
      '+380 (44) 123-45-67',
      '-',
      '.',
      'x',
      ' ',
      'a',
      'b',
      'd',
      '5',
      'word-word.x',
      'Б',
      'e',
      'c',
      '\u00a0',
      '',
    ];
    const differences: string[] = [];
    for (const [source, flags] of patterns) {
      const linear = compileLinear(source, flags);
      if (!isLinearRegex(linear)) {
        differences.push(`/${source}/${flags}: ${linear}`);
        continue;
      }
      for (const text of texts) {
        if (linear.test(text) !== new RegExp(source, flags).test(text))
          differences.push(`/${source}/${flags} on ${JSON.stringify(text)}`);
      }
    }
    expect(differences).toEqual([]);
  });

  it('names what JavaScript takes and RE2 cannot run, instead of dropping the rule', () => {
    for (const [source, flags] of [
      ['\\d{1,2000}', ''],
      ['(?:[a-z]{1,50}\\s?){1,30}', ''],
      ['(?s:a.b)', ''],
    ]) {
      expect([source, compileLinear(source, flags)]).toEqual([source, 'unsupported']);
    }
    // the long names and short scripts JavaScript takes run as they mean
    const same = (source: string, texts: string[]) => {
      const linear = compileLinear(source, 'u');
      if (!isLinearRegex(linear)) throw new Error(`${source}: ${linear}`);
      for (const text of texts)
        expect([source, text, linear.test(text)]).toEqual([source, text, new RegExp(source, 'u').test(text)]);
    };
    same('^\\p{Script=Cyrl}+$', ['Привіт', 'Hello', 'Привіт1']);
    same('^\\p{sc=Latn}+$', ['Hello', 'Привіт']);
    same('\\p{Dash_Punctuation}', ['a-b', 'ab', 'a—b']);
    same('^\\p{Cased_Letter}+$', ['Aa', '中', 'ǅ']);
    same('^\\P{Cased_Letter}+$', ['中文', 'Aa', '12']);
    same('^[\\p{Cased_Letter}\\d]+$', ['Aa1', '中1']);
    same('^\\p{Lowercase}+$', ['abc', 'ªß', 'Abc']);
    same('\\p{White_Space}', ['a b', 'a\u00a0b', 'ab']);
    same('^\\p{Alphabetic}+$', ['Привіт', 'a1']);
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

  // VIS-SEC-058: repeats multiply the program RE2 builds, and its time and memory with it. One such
  // pattern in 300 characters held 46 MiB and over a second of the API on 200 characters.
  const unrolling = [
    '(?:' + 'x*'.repeat(137) + '){1000}[qz]$',
    '(?:x*x*){1000}[qz]$',
    '(?:\\d{1,9}){500}',
    '(?:a|b|c|d|e){1000}',
    '(?:[a-z]{1,50}\\s?){1,30}',
    '((((a{10}){10}){10}){10})',
  ];

  it('refuses a pattern whose repeats unroll too large, at once and with a reason', () => {
    for (const source of unrolling) {
      const started = performance.now();
      expect([source, compileLinear(source)]).toEqual([source, 'unsupported']);
      expect([source, performance.now() - started < 50]).toEqual([source, true]);
    }
  });

  it('takes the repeats people write, up to a thousand of a character or two', () => {
    for (const source of ['.{0,1000}', '(?:ab){1000}', '\\d{1,1000}', '^\\d{1,3}(?:\\s\\d{3}){0,5}$', '[а-я]{3,40}']) {
      expect([source, isLinearRegex(compileLinear(source))]).toEqual([source, true]);
    }
  });

  it('never counts a program smaller than RE2 builds it', () => {
    const sources = [
      ...SELECTOR_PATTERNS.map(([source]) => source),
      ...PLACE_PATTERNS,
      '.{0,1000}',
      '(?:ab){1000}',
      '(a){3,7}',
      '(?P<x>a|bc)+?',
      'a{2,}b*?c??',
      '[\\]A-Z\\u{1F600}]{4}',
      '\\p{L}{2,9}',
      '(?i:ab){20}',
    ];
    for (const source of sources) {
      const translated = translate(source, true);
      const built = RE2JS.compile(translated).programSize();
      expect([source, programEstimate(translated, Infinity) >= built]).toEqual([source, true]);
    }
  });

  it('keeps no more compiled patterns than its budget of instructions', () => {
    // 300 different patterns of about 1800 instructions each: 540 000 if all were kept
    for (let i = 0; i < 300; i++) {
      expect(isLinearRegex(compileLinear(`(?:${String.fromCharCode(0x400 + i)}b){900}`))).toBe(true);
    }
    expect(cacheWeight()).toBeLessThanOrEqual(200_000);
  });

  it('checks the largest pattern it takes on 2000 characters in under 50 ms', () => {
    const text = 'x'.repeat(1999) + '!';
    for (const source of ['(?:x?x){1000}q', '.{0,1000}q', '(?:x*x){600}q']) {
      const pattern = compileLinear(source);
      if (!isLinearRegex(pattern)) throw new Error(`${source}: ${pattern}`);
      pattern.test(text);
      const started = performance.now();
      pattern.test(text);
      expect([source, performance.now() - started < 50]).toEqual([source, true]);
    }
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
