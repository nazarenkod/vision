import { RE2JS } from 're2js';

/*
 * Patterns of element rules (`text:/…/`, spec 027) and of variable texts (spec 033) run on an
 * engine whose time grows with the text, never more: on JavaScript's own engine `(a+)+$` over a
 * text of 30 letters held the API for seconds, and every team waited (051, VIS-SEC-015).
 *
 * That engine (RE2) reads a few things differently from JavaScript, so a pattern is translated
 * first and finds what it found before: `\s` is JavaScript's set of spaces (no-break and narrow
 * ones too, as amounts are printed), `.` leaves out every line end JavaScript does, and escapes
 * RE2 does not know are spelled its way. What it cannot run in linear time at all is refused:
 * back-references and look-around.
 */

// syntax: JavaScript does not take it either; unsupported: JavaScript takes it, RE2 cannot run it
// as it means (a repeat over 1000, a property RE2 does not know, dotAll inside a group)
export type PatternProblem = 'backreference' | 'lookaround' | 'unsupported' | 'syntax';

export interface LinearRegex {
  readonly source: string;
  test(text: string): boolean;
}

// JavaScript's \s: ECMAScript WhiteSpace and LineTerminator
const SPACES =
  '\\t\\n\\x{b}\\f\\r \\x{a0}\\x{1680}\\x{2000}-\\x{200a}\\x{2028}\\x{2029}\\x{202f}\\x{205f}\\x{3000}\\x{feff}';
// the same set as ranges of code points, for \S inside a class, where [^…] cannot nest
const NOT_SPACES = [
  [0x00, 0x08],
  [0x0e, 0x1f],
  [0x21, 0x9f],
  [0xa1, 0x167f],
  [0x1681, 0x1fff],
  [0x200b, 0x2027],
  [0x202a, 0x202e],
  [0x2030, 0x205e],
  [0x2060, 0x2fff],
  [0x3001, 0xfefe],
  [0xff00, 0x10ffff],
]
  .map(([from, to]) => `\\x{${from.toString(16)}}-\\x{${to.toString(16)}}`)
  .join('');
// JavaScript's . without the s flag: anything but a line end
const ANY_BUT_LINE_END = '[^\\n\\r\\x{2028}\\x{2029}]';
const ANY = '\\x{0}-\\x{10ffff}';

// long names of Unicode properties JavaScript takes that RE2 spells short
const PROPERTY_NAMES: Record<string, string> = {
  Letter: 'L',
  LC: 'Lu}\\p{Ll}\\p{Lt',
  Cased_Letter: 'Lu}\\p{Ll}\\p{Lt',
  Uppercase_Letter: 'Lu',
  Lowercase_Letter: 'Ll',
  Titlecase_Letter: 'Lt',
  Modifier_Letter: 'Lm',
  Other_Letter: 'Lo',
  Mark: 'M',
  Number: 'N',
  Decimal_Number: 'Nd',
  digit: 'Nd',
  Letter_Number: 'Nl',
  Other_Number: 'No',
  Punctuation: 'P',
  punct: 'P',
  Symbol: 'S',
  Currency_Symbol: 'Sc',
  Math_Symbol: 'Sm',
  Separator: 'Z',
  Space_Separator: 'Zs',
  Other: 'C',
  Control: 'Cc',
  cntrl: 'Cc',
  Format: 'Cf',
  Unassigned: 'Cn',
  Private_Use: 'Co',
  Surrogate: 'Cs',
  Spacing_Mark: 'Mc',
  Enclosing_Mark: 'Me',
  Nonspacing_Mark: 'Mn',
  Connector_Punctuation: 'Pc',
  Dash_Punctuation: 'Pd',
  Close_Punctuation: 'Pe',
  Final_Punctuation: 'Pf',
  Initial_Punctuation: 'Pi',
  Other_Punctuation: 'Po',
  Open_Punctuation: 'Ps',
  Modifier_Symbol: 'Sk',
  Other_Symbol: 'So',
  Line_Separator: 'Zl',
  Paragraph_Separator: 'Zp',
  // short script codes JavaScript takes after Script=
  Arab: 'Arabic',
  Armn: 'Armenian',
  Cyrl: 'Cyrillic',
  Geor: 'Georgian',
  Grek: 'Greek',
  Hani: 'Han',
  Hebr: 'Hebrew',
  Hira: 'Hiragana',
  Kana: 'Katakana',
  Latn: 'Latin',
  Thai: 'Thai',
  Zyyy: 'Common',
};

const hex = (code: number) => `\\x{${code.toString(16)}}`;

/*
 * Without the u flag JavaScript sees a character beyond the basic plane (an emoji) as two halves,
 * and `.` or `[^a]` takes each half alone. RE2 sees one character. So without u each half, in
 * the text and in the pattern, becomes a character of its own from a plane of private use no
 * screen text holds, and the two engines count alike.
 */
const HALVES = 0xf0000;
const isHalf = (code: number) => code >= 0xd800 && code <= 0xdfff;
const asHalf = (code: number) => HALVES + code - 0xd800;
export const halvesApart = (text: string) =>
  text.replace(/[\ud800-\udfff]/g, (half) => String.fromCodePoint(asHalf(half.charCodeAt(0))));
const isHex = (text: string) => /^[0-9a-fA-F]+$/.test(text);
const QUANTIFIER = /^\{\d+(,\d*)?\}/;

class Problem extends Error {
  constructor(readonly problem: PatternProblem) {
    super(problem);
  }
}

/** JavaScript's pattern as RE2 reads it, meaning the same; throws a Problem when it cannot. */
export function translate(source: string, unicode: boolean): string {
  let out = '';
  let at = 0;
  let inClass = false;
  let classStart = false;
  const peek = (offset = 0) => source[at + offset];
  // the last thing in a class was a set (\s, \d, \p{…}): a - after it is a dash, not a range
  let afterSet = false;
  const SET_ESCAPE = /^\\[sSdDwWpP]/;
  const literal = (char: string) => (!unicode && isHalf(char.charCodeAt(0)) ? hex(asHalf(char.charCodeAt(0))) : char);

  // an escape; `inClass` decides what \b and \s turn into
  const escape = (): string => {
    const next = source[at + 1];
    if (next === undefined) throw new Problem('syntax');
    at += 2;
    afterSet = (inClass && /[sSdDwW]/.test(next)) || (inClass && unicode && /[pP]/.test(next));
    if (/[1-9]/.test(next)) {
      // in a class without u, \1 is the character 1 in octal and \8 the digit itself
      if (inClass && !unicode) return /[1-7]/.test(next) ? hex(Number(next)) : next;
      throw new Problem('backreference');
    }
    if (next === 'k' && peek() === '<') throw new Problem('backreference');
    switch (next) {
      case '0':
        return hex(0);
      case 's':
        return inClass ? SPACES : `[${SPACES}]`;
      case 'S':
        return inClass ? NOT_SPACES : `[^${SPACES}]`;
      case 'b':
        return inClass ? hex(8) : '\\b';
      case 'd':
      case 'D':
      case 'w':
      case 'W':
      case 'B':
      case 't':
      case 'n':
      case 'r':
      case 'f':
        return `\\${next}`;
      case 'v':
        return hex(0x0b);
      case 'c': {
        const letter = peek();
        if (letter && /[A-Za-z]/.test(letter)) {
          at++;
          return hex(letter.charCodeAt(0) % 32);
        }
        return '\\\\c';
      }
      case 'x': {
        const digits = source.slice(at, at + 2);
        if (digits.length === 2 && isHex(digits)) {
          at += 2;
          return hex(parseInt(digits, 16));
        }
        return 'x';
      }
      case 'u': {
        if (unicode && peek() === '{') {
          const end = source.indexOf('}', at);
          const digits = end > at ? source.slice(at + 1, end) : '';
          if (!isHex(digits)) throw new Problem('syntax');
          at = end + 1;
          return hex(parseInt(digits, 16));
        }
        const digits = source.slice(at, at + 4);
        if (digits.length === 4 && isHex(digits)) {
          at += 4;
          const code = parseInt(digits, 16);
          if (!unicode && isHalf(code)) return hex(asHalf(code));
          // a surrogate pair written as two escapes is one character
          const low = /^\\u([0-9a-fA-F]{4})/.exec(source.slice(at));
          if (code >= 0xd800 && code <= 0xdbff && low) {
            const second = parseInt(low[1], 16);
            if (second >= 0xdc00 && second <= 0xdfff) {
              at += 6;
              return hex((code - 0xd800) * 0x400 + (second - 0xdc00) + 0x10000);
            }
          }
          return hex(code);
        }
        if (unicode) throw new Problem('syntax');
        return 'u';
      }
      case 'p':
      case 'P': {
        if (!unicode) return next;
        const match = /^\{([^}]*)\}/.exec(source.slice(at));
        if (!match) throw new Problem('syntax');
        at += match[0].length;
        let name = match[1];
        const [key, value] = name.split('=');
        if (value !== undefined) {
          if (!['Script', 'sc', 'Script_Extensions', 'scx', 'General_Category', 'gc'].includes(key)) {
            throw new Problem('syntax');
          }
          name = value;
        }
        const property = `\\${next}{${PROPERTY_NAMES[name] ?? name}}`;
        // a property RE2 spells as several: a class of them, or a list inside one
        if (!property.includes('}\\p{')) return property;
        if (next === 'P') {
          if (inClass) throw new Problem('unsupported');
          return `[^${property.replace('\\P{', '\\p{')}]`;
        }
        return inClass ? property : `[${property}]`;
      }
      default:
        // an identity escape: a letter or digit stands for itself, punctuation stays escaped
        if (/[A-Za-z0-9_]/.test(next)) {
          if (unicode) throw new Problem('syntax');
          return next;
        }
        return /[\\^$.|?*+()[\]{}\-/]/.test(next) ? `\\${next}` : hex(next.codePointAt(0) as number);
    }
  };

  while (at < source.length) {
    const char = source[at];
    if (char === '\\') {
      out += escape();
      classStart = false;
      continue;
    }
    if (inClass) {
      if (char === ']' && !classStart) {
        inClass = false;
        out += ']';
      } else if (char === ']' && classStart) {
        // JavaScript's [] takes nothing and [^] takes anything; RE2 reads ] there as a letter
        out = out.endsWith('[^') ? `${out.slice(0, -2)}[${ANY}]` : `${out.slice(0, -1)}[^${ANY}]`;
        inClass = false;
      } else if (char === '[') {
        out += '\\[';
      } else if (char === '-' && (afterSet || SET_ESCAPE.test(source.slice(at + 1)))) {
        // JavaScript reads [\s-x] and [x-\s] as three things; RE2 would read a range
        out += '\\-';
      } else {
        out += literal(char);
      }
      classStart = false;
      afterSet = false;
      at++;
      continue;
    }
    if (char === '[') {
      inClass = true;
      classStart = true;
      out += '[';
      at++;
      if (peek() === '^') {
        out += '^';
        at++;
      }
      continue;
    }
    if (char === '.') {
      out += ANY_BUT_LINE_END;
      at++;
      continue;
    }
    if (char === '(' && peek(1) === '?') {
      const head = source.slice(at, at + 4);
      if (/^\(\?[=!]/.test(head) || /^\(\?<[=!]/.test(head)) throw new Problem('lookaround');
      // dotAll inside a group changes what . means there, which the translation of . does not follow
      const modifiers = /^\(\?([a-z]*)(?:-[a-z]*)?:/.exec(source.slice(at));
      if (modifiers?.[1].includes('s')) throw new Problem('unsupported');
      if (/^\(\?<[A-Za-z_$]/.test(head)) {
        out += '(?P<';
        at += 3;
        continue;
      }
    }
    if (char === '{') {
      const quantifier = QUANTIFIER.exec(source.slice(at));
      if (quantifier) {
        out += quantifier[0];
        at += quantifier[0].length;
        continue;
      }
      if (unicode) throw new Problem('syntax');
      out += '\\{';
      at++;
      continue;
    }
    if (char === '}') {
      if (unicode) throw new Problem('syntax');
      out += '\\}';
      at++;
      continue;
    }
    out += literal(char);
    at++;
  }
  if (inClass) throw new Problem('syntax');
  return out;
}

/*
 * RE2's time is linear in the text but also in the size of the compiled program, and repeats
 * multiply that size: `(?:x*x*…){1000}` fits in 300 characters, unrolls into 274 000 instructions,
 * holds 46 MiB and takes over a second on 200 characters (VIS-SEC-058). The patterns people write
 * stay under 300 instructions and `.{0,1000}` takes 2002; at 4000 a test of 2000 characters
 * still fits in the 50 ms of REQ-051-11.
 */
export const MAX_PROGRAM = 4000;

/**
 * An upper bound on the instructions RE2 compiles a translated pattern into, worked out from the
 * text alone, so that a pattern too large is refused before it is built. Each atom is one, a group
 * that captures adds its brackets, a repeat {n,m} copies its atom m times. Stops counting once over
 * `limit`.
 */
export function programEstimate(pattern: string, limit = MAX_PROGRAM): number {
  let at = 0;
  const skipBraces = () => {
    const end = pattern.indexOf('}', at);
    at = end < 0 ? pattern.length : end + 1;
  };
  const escape = () => {
    at++;
    const next = pattern[at];
    at++;
    if (/[xpP]/.test(next) && pattern[at] === '{') skipBraces();
  };
  const atom = (): number => {
    const char = pattern[at];
    if (char === '\\') {
      escape();
      return 1;
    }
    if (char === '[') {
      at++;
      if (pattern[at] === '^') at++;
      while (at < pattern.length && pattern[at] !== ']') {
        if (pattern[at] === '\\') escape();
        else at++;
      }
      at++;
      return 1;
    }
    if (char === '(') {
      at++;
      // a group that captures saves where it starts and ends; (?: and (?i: compile into nothing
      let brackets = 2;
      if (pattern[at] === '?') {
        brackets = pattern[at + 1] === 'P' ? 2 : 0;
        while (at < pattern.length && pattern[at] !== ':' && pattern[at] !== '>' && pattern[at] !== ')') at++;
        at++;
      }
      const inside = alternatives();
      at++;
      return inside + brackets;
    }
    at++;
    return 1;
  };
  const repeated = (size: number): number => {
    for (;;) {
      const char = pattern[at];
      if (char === '*' || char === '+' || char === '?') {
        at++;
        size += 1;
      } else if (char === '{') {
        const quantifier = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(at));
        if (!quantifier) return size;
        at += quantifier[0].length;
        const least = Number(quantifier[1]);
        const most = quantifier[2] === undefined ? least : quantifier[3] === '' ? least + 1 : Number(quantifier[3]);
        size = size * Math.max(least, most, 1) + Math.max(most - least, 0) + 1;
      } else {
        return size;
      }
      // a lazy repeat compiles as the greedy one does
      if (pattern[at] === '?' && pattern[at - 1] !== '?') at++;
    }
  };
  const sequence = (): number => {
    let size = 0;
    while (at < pattern.length && pattern[at] !== '|' && pattern[at] !== ')') {
      size += repeated(atom());
      if (size > limit) return size;
    }
    return size;
  };
  function alternatives(): number {
    let size = sequence();
    while (pattern[at] === '|' && size <= limit) {
      at++;
      size += sequence() + 1;
    }
    return size;
  }
  // the match, the failure and the whole pattern as group 0
  let size = 3;
  // a stray ) is a syntax error RE2 reports itself; counting just carries on past it
  while (at < pattern.length && size <= limit) {
    size += alternatives();
    if (pattern[at] === ')') at++;
  }
  return size;
}

/*
 * Compiled patterns are kept, as every element of every screen is tested against the same rules;
 * the cache is bounded by the instructions it holds, so that patterns sent one after another cannot
 * fill the memory of the API (VIS-SEC-058).
 */
const compiled = new Map<string, { result: LinearRegex | PatternProblem; weight: number }>();
const CACHE_INSTRUCTIONS = 200_000;
let cachedInstructions = 0;

/** Instructions of the patterns the cache holds now; for tests. */
export const cacheWeight = () => cachedInstructions;

function remember(key: string, result: LinearRegex | PatternProblem, weight: number) {
  compiled.set(key, { result, weight });
  cachedInstructions += weight;
  while (cachedInstructions > CACHE_INSTRUCTIONS) {
    const [oldest, entry] = compiled.entries().next().value as [string, { weight: number }];
    compiled.delete(oldest);
    cachedInstructions -= entry.weight;
  }
}

/**
 * A pattern with JavaScript's meaning on an engine with linear time; the problem instead when it
 * holds what that engine cannot run, or does not parse. Flags: i (any case) and u (Unicode).
 */
export function compileLinear(source: string, flags = ''): LinearRegex | PatternProblem {
  const key = `${flags}/${source}`;
  const known = compiled.get(key);
  if (known) return known.result;
  let result: LinearRegex | PatternProblem;
  let weight = 1;
  const unicode = flags.includes('u');
  try {
    // JavaScript itself must take it first: what it refuses, a rule never held
    new RegExp(source, flags.replace(/[^iu]/g, ''));
    const translated = translate(source, unicode);
    // too large to run in time, refused before RE2 spends time and memory building it
    if (programEstimate(translated) > MAX_PROGRAM) throw new Problem('unsupported');
    try {
      const pattern = RE2JS.compile(translated, flags.includes('i') ? RE2JS.CASE_INSENSITIVE : 0);
      // the estimate is a bound, and this is the program as built: neither lets a large one through
      if (pattern.programSize() > MAX_PROGRAM) throw new Problem('unsupported');
      weight = pattern.programSize();
      result = { source, test: (text: string) => pattern.matcher(unicode ? text : halvesApart(text)).find() };
    } catch {
      // JavaScript takes it and RE2 cannot: said so, never a rule that silently stops working
      result = 'unsupported';
    }
  } catch (error) {
    result = error instanceof Problem ? error.problem : 'syntax';
  }
  remember(key, result, weight);
  return result;
}

export const isLinearRegex = (value: LinearRegex | PatternProblem): value is LinearRegex => typeof value !== 'string';
