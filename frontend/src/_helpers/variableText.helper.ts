import { PickableElement, TextPart } from "../types/insights";

/**
 * Marking the part of a text that changes between runs (spec 033): the text
 * in clickable pieces, a pattern for each marked place built from its value,
 * and the selector that still finds the element once the value is different.
 */

export interface Piece {
  text: string;
  start: number;
  end: number;
}

// A number takes the sign right before it and its separators: "−245,90",
// "12 480,50", "02.11.2026", "14:07" are one piece each (REQ-033-03).
const PIECE = /[+\-−]?\d+(?:[ \u00a0\u202f.,:/-]\d+)*|\p{L}+|[^\s\p{L}\d]/gu;

export function splitPieces(text: string): Piece[] {
  return Array.from(text.matchAll(PIECE), (match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

// what the value is made of, left to right; a grouped number is one token
const TOKEN =
  /([+\-−])(?=\d)|(\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?!\d)|(\d+)|(\p{L}+)|(\s+)|([\s\S])/gu;

/**
 * A pattern of the same shape as the value (REQ-033-07): the first group of
 * a number any length, each next one after `:`, `.`, `,`, `/`, `-` exactly as
 * long as now, thousands in groups of three, a sign optional, words any
 * letters, spaces any spaces, everything else itself.
 */
export function patternFor(value: string): string {
  const out: string[] = [];
  let inNumber = false;
  let afterSeparator = false;
  for (const [, sign, grouped, digits, letters, space, other] of value.matchAll(
    TOKEN,
  )) {
    if (sign) {
      out.push("[+\\-−]?");
      inNumber = false;
      afterSeparator = false;
    } else if (grouped) {
      out.push("\\d{1,3}(?:\\s\\d{3})*");
      inNumber = true;
      afterSeparator = false;
    } else if (digits) {
      out.push(inNumber && afterSeparator ? `\\d{${digits.length}}` : "\\d+");
      inNumber = true;
      afterSeparator = false;
    } else if (letters) {
      out.push("\\p{L}+");
      inNumber = false;
      afterSeparator = false;
    } else if (space) {
      out.push("\\s+");
      inNumber = false;
      afterSeparator = false;
    } else {
      out.push(escape(other));
      afterSeparator = inNumber && /[.,:/-]/.test(other);
      if (!afterSeparator) inNumber = false;
    }
  }
  return out.join("");
}

const isPlace = (
  part: TextPart,
): part is { pattern: string; sample?: string } => "pattern" in part;

/**
 * The check from the marked pieces: marked pieces with only spaces between
 * them are one place (REQ-033-04); the rest of the text stays literal.
 */
export function partsOf(
  text: string,
  pieces: Piece[],
  marked: ReadonlySet<number>,
): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  let i = 0;
  while (i < pieces.length) {
    if (!marked.has(i)) {
      i++;
      continue;
    }
    let j = i;
    while (
      j + 1 < pieces.length &&
      marked.has(j + 1) &&
      !text.slice(pieces[j].end, pieces[j + 1].start).trim()
    )
      j++;
    const start = pieces[i].start;
    const end = pieces[j].end;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    const sample = text.slice(start, end);
    parts.push({ pattern: patternFor(sample), sample });
    cursor = end;
    i = j + 1;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

// non-breaking and narrow spaces are how apps print amounts; to a reader they are spaces
const spaces = (text: string) =>
  text.replace(/[\u00a0\u202f\u2007]/g, " ").replace(/\s+/g, " ");

/** The whole check as one expression, the same way the server reads it. */
export function partsRegex(parts: TextPart[]): RegExp | null {
  try {
    const source = parts
      .map((part) =>
        isPlace(part)
          ? `(?:${part.pattern})`
          : escape(spaces(part.text)).replace(/ /g, " +"),
      )
      .join("");
    return new RegExp(`^ *${source} *$`, "u");
  } catch {
    return null;
  }
}

/** Whether a text is what the check expects. */
export function fitsParts(parts: TextPart[], text: string): boolean {
  return !!partsRegex(parts)?.test(spaces(text).trim());
}

export const hasPlace = (parts: TextPart[]) => parts.some(isPlace);

// a selector the server keeps to this length
const MAX_SELECTOR = 300;

/**
 * How the rule finds the element when its value is new (REQ-033-25…28): its
 * id; else its fixed text with anything in the places, when that text has a
 * letter; else a path down from an id above it. Null when nothing would find
 * it next run.
 */
export function variableSelector(
  element: Pick<PickableElement, "selector" | "stableSelector">,
  parts: TextPart[],
): string | null {
  if (element.selector.startsWith("id:")) return element.selector;
  const fixed = parts.filter(
    (part): part is { text: string } => !isPlace(part),
  );
  if (fixed.some((part) => /\p{L}/u.test(part.text))) {
    // any value in a place, so a broken one is still found and reported, not lost
    const source = parts
      .map((part) =>
        isPlace(part)
          ? ".*?"
          : escape(spaces(part.text).trim()).replace(/ /g, "\\s*"),
      )
      .join("\\s*");
    const selector = `text:/^${source}$/u`;
    if (selector.length <= MAX_SELECTOR) return selector;
  }
  return element.stableSelector ?? null;
}

/** The value in each place of a text, in order, for showing it highlighted. */
export function placesIn(
  parts: TextPart[],
  text: string,
): Array<{ text: string; place: boolean }> {
  const source = parts
    .map((part) =>
      isPlace(part)
        ? `(${part.pattern.replace(/(?<!\\)\((?!\?)/g, "(?:")})`
        : `(${escape(spaces(part.text)).replace(/ /g, " +")})`,
    )
    .join("");
  try {
    const match = new RegExp(`^ *${source} *$`, "u").exec(spaces(text).trim());
    if (match)
      return parts.map((part, i) => ({
        text: match[i + 1],
        place: isPlace(part),
      }));
  } catch {
    // a pattern that does not parse is shown as plain text
  }
  return [{ text, place: false }];
}

/** A text as the check reads it: one kind of space, none at the ends. */
export const plainText = (text: string) => spaces(text).trim();

/** Which pieces a saved check marks, to change it (REQ-033-14). */
export function markedFrom(parts: TextPart[], text: string): Set<number> {
  const pieces = splitPieces(text);
  const marked = new Set<number>();
  let position = 0;
  for (const segment of placesIn(parts, text)) {
    const end = position + segment.text.length;
    if (segment.place)
      pieces.forEach((piece, i) => {
        if (piece.start >= position && piece.end <= end) marked.add(i);
      });
    position = end;
  }
  return marked;
}
