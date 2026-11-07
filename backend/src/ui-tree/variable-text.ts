import { compileLinear, isLinearRegex, LinearRegex } from './linear-regex';

/**
 * A text with places that change between runs (spec 033): the fixed parts must
 * match literally, each place its pattern. The patterns come from the review
 * screen, built from the value the QA marked; here they are only checked.
 */
export type TextPart = { text: string } | { pattern: string; sample?: string };

export type VariableTextReason = 'text' | 'pattern' | 'too-long';

// a contract or terms text is not a value anyone marks; checking it would only cost time (REQ-033-24)
export const MAX_CHECKED_TEXT = 2000;
const MAX_PATTERN = 200;
const MAX_PARTS = 20;

const isPlace = (part: TextPart): part is { pattern: string; sample?: string } => 'pattern' in part;

// non-breaking and narrow spaces are how apps print amounts; to a reader they are spaces
const spaces = (text: string) => text.replace(/[\u00a0\u202f\u2007]/g, ' ').replace(/\s+/g, ' ');
const normalize = (text: string) => spaces(text).trim();

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// a fixed part keeps the spaces at its ends: they sit between it and a place
const literal = (text: string) => escape(spaces(text)).replace(/ /g, ' +');

// in linear time whatever the pattern (051): a place's pattern comes from the review screen
function compile(source: string): LinearRegex | null {
  const pattern = compileLinear(`^ *${source} *$`, 'u');
  return isLinearRegex(pattern) ? pattern : null;
}

export const unrunnablePattern = (pattern: string) => {
  const problem = compileLinear(`^ *(?:${pattern}) *$`, 'u');
  return problem === 'backreference' || problem === 'lookaround';
};

/** Why parts cannot be saved as a check, or null when they can. */
export function partsProblem(parts: unknown): string | null {
  if (!Array.isArray(parts) || !parts.length) return 'The check has no parts';
  if (parts.length > MAX_PARTS) return `The check has more than ${MAX_PARTS} parts`;
  let places = 0;
  for (const part of parts as TextPart[]) {
    if (!part || typeof part !== 'object') return 'A part of the check is not a text or a place';
    if (isPlace(part)) {
      if (typeof part.pattern !== 'string' || !part.pattern || part.pattern.length > MAX_PATTERN) {
        return `A place needs a pattern of 1 to ${MAX_PATTERN} characters`;
      }
      if (unrunnablePattern(part.pattern)) {
        return `The pattern ${part.pattern} uses a back-reference or look-around, which Vision does not run`;
      }
      if (!compile(part.pattern)) return `The pattern ${part.pattern} does not parse`;
      places++;
    } else if (typeof (part as { text: unknown }).text !== 'string') {
      return 'A part of the check is not a text or a place';
    }
  }
  return places ? null : 'Mark at least one place that changes';
}

/** The whole check as one expression: fixed parts literally, places by their patterns. */
export function partsRegex(parts: TextPart[]): LinearRegex | null {
  return compile(parts.map((part) => (isPlace(part) ? `(?:${part.pattern})` : literal(part.text))).join(''));
}

/** The same check with any value in the places: tells a changed fixed text from a wrong value. */
function skeleton(parts: TextPart[]): LinearRegex | null {
  return compile(parts.map((part) => (isPlace(part) ? '.*?' : literal(part.text))).join(''));
}

export interface VariableTextResult {
  ok: boolean;
  reason?: VariableTextReason;
}

/** Whether a text is what the check expects (REQ-033-17, 18, 24). */
export function checkVariableText(parts: TextPart[], text: string): VariableTextResult {
  if (text.length > MAX_CHECKED_TEXT) return { ok: false, reason: 'too-long' };
  const value = normalize(text);
  if (partsRegex(parts)?.test(value)) return { ok: true };
  return { ok: false, reason: skeleton(parts)?.test(value) ? 'pattern' : 'text' };
}

/** A variable text that did not hold: its rule, and on which element and why. */
export interface VariableTextProblem {
  ruleId: string;
  kind: 'failed' | 'gone';
  // the element as the UI tree names it, for the reason in the Changes tab
  element: string;
  text?: string;
  reason?: VariableTextReason;
  bounds: { x: number; y: number; width: number; height: number };
}

/** A run that passed on its pixels goes to review when a variable text did not hold (REQ-033-18, 19). */
export function variableTextStatus<S extends string>(status: S, problems: VariableTextProblem[]): S | 'unresolved' {
  return problems.length && (status === 'ok' || status === 'autoApproved') ? 'unresolved' : status;
}

const overlaps = (a: VariableTextProblem['bounds'], b: VariableTextProblem['bounds']) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** With compare only, what lies outside the compared elements is not checked (REQ-033-21). */
export function insideKeep(problems: VariableTextProblem[], keep: VariableTextProblem['bounds'][] | null) {
  return keep ? problems.filter((problem) => keep.some((rect) => overlaps(rect, problem.bounds))) : problems;
}
