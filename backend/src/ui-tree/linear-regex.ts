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

export type PatternProblem = 'backreference' | 'lookaround' | 'syntax';

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
  Cased_Letter: 'L',
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
  const literal = (char: string) => (!unicode && isHalf(char.charCodeAt(0)) ? hex(asHalf(char.charCodeAt(0))) : char);

  // an escape; `inClass` decides what \b and \s turn into
  const escape = (): string => {
    const next = source[at + 1];
    if (next === undefined) throw new Problem('syntax');
    at += 2;
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
        return `\\${next}{${PROPERTY_NAMES[name] ?? name}}`;
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
      } else {
        out += literal(char);
      }
      classStart = false;
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

const compiled = new Map<string, LinearRegex | PatternProblem>();
const CACHE_SIZE = 500;

/**
 * A pattern with JavaScript's meaning on an engine with linear time; the problem instead when it
 * holds what that engine cannot run, or does not parse. Flags: i (any case) and u (Unicode).
 */
export function compileLinear(source: string, flags = ''): LinearRegex | PatternProblem {
  const key = `${flags}/${source}`;
  const known = compiled.get(key);
  if (known) return known;
  let result: LinearRegex | PatternProblem;
  try {
    // JavaScript itself must take it first: what it refuses, a rule never held
    new RegExp(source, flags.replace(/[^iu]/g, ''));
    const pattern = RE2JS.compile(
      translate(source, flags.includes('u')),
      flags.includes('i') ? RE2JS.CASE_INSENSITIVE : 0
    );
    const unicode = flags.includes('u');
    result = { source, test: (text: string) => pattern.matcher(unicode ? text : halvesApart(text)).find() };
  } catch (error) {
    result = error instanceof Problem ? error.problem : 'syntax';
  }
  if (compiled.size >= CACHE_SIZE) compiled.delete(compiled.keys().next().value as string);
  compiled.set(key, result);
  return result;
}

export const isLinearRegex = (value: LinearRegex | PatternProblem): value is LinearRegex => typeof value !== 'string';
