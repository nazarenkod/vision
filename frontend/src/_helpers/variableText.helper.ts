import {
  LeftOut,
  PickableElement,
  Rect,
  ScreenRule,
  TextPart,
} from "../types/insights";

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
// An Android tree keeps an emoji or a line break as a character reference
// ("&#128241;", "&#10;"): one piece, not "&", "#", "128241", ";".
const PIECE =
  /&#(?:x[0-9a-f]+|\d+);|[+\-−]?\d+(?:[ \u00a0\u202f.,:/-]\d+)*|\p{L}+|[^\s\p{L}\d]/giu;

const CHAR_REF = /&#(x[0-9a-f]+|\d+);/gi;

/** A text as people read it: character references decoded, a line break shown as ↵. */
export function readable(text: string): string {
  return text.replace(CHAR_REF, (ref, code: string) => {
    const point =
      code[0].toLowerCase() === "x"
        ? parseInt(code.slice(1), 16)
        : Number(code);
    if (point === 10 || point === 13) return " ↵ ";
    return point <= 0x10ffff ? String.fromCodePoint(point) : ref;
  });
}

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

/**
 * Whether a text keeps the whole fixed text of a check, any value in the
 * places: a list row of the same kind as the one the rule is made on (REQ-070-01).
 */
export function fitsSkeleton(parts: TextPart[], text: string): boolean {
  const source = parts
    .map((part) =>
      isPlace(part) ? ".*?" : escape(spaces(part.text)).replace(/ /g, " +"),
    )
    .join("");
  return new RegExp(`^ *${source} *$`, "u").test(spaces(text).trim());
}

/**
 * How many elements a variable-text rule would take on a screenshot while
 * its pieces are marked (REQ-033-29): by its text pattern, or by id only those
 * that keep the fixed text (REQ-070-04); null for a path, the server's to follow.
 */
export function variableCount(
  selector: string,
  parts: TextPart[],
  elements: Pick<PickableElement, "selector" | "text">[],
): number | null {
  const regex = /^text:\/(.+)\/u$/.exec(selector);
  if (regex) {
    try {
      const pattern = new RegExp(regex[1], "u");
      return elements.filter(
        (element) => element.text && pattern.test(element.text.trim()),
      ).length;
    } catch {
      return null;
    }
  }
  if (!selector.startsWith("id:")) return null;
  return elements.filter(
    (element) =>
      element.selector === selector &&
      (!parts.length || fitsSkeleton(parts, element.text ?? "")),
  ).length;
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
  // a value that does not fit is still found by the fixed text around it, to show what is there now
  for (const loose of [false, true]) {
    const source = parts
      .map((part) =>
        isPlace(part)
          ? loose
            ? "(.*?)"
            : `(${part.pattern.replace(/(?<!\\)\((?!\?)/g, "(?:")})`
          : `(${escape(spaces(part.text)).replace(/ /g, " +")})`,
      )
      .join("");
    try {
      const match = new RegExp(`^ *${source} *$`, "u").exec(
        spaces(text).trim(),
      );
      if (match)
        return parts.map((part, i) => ({
          text: match[i + 1],
          place: isPlace(part),
        }));
    } catch {
      // a pattern that does not parse is shown as plain text
    }
  }
  return [{ text, place: false }];
}

/** The text as it was when the check was made: what "expected" means to a person (REQ-033-31). */
export function expectedOf(
  parts: TextPart[],
): Array<{ text: string; place: boolean; pattern?: string }> {
  return parts.map((part) =>
    isPlace(part)
      ? { text: part.sample ?? "…", place: true, pattern: part.pattern }
      : { text: part.text, place: false },
  );
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

// --- what a rule leaves out of the comparison (spec 066) ---

/**
 * Whether a check only asks for words: no fixed part with a letter or a digit,
 * and every place letters only. Any word then passes, which is close to
 * ignoring the element (REQ-066-10).
 */
export function wordsOnly(parts: TextPart[]): boolean {
  if (!parts.some(isPlace)) return false;
  return parts.every((part) => {
    if (!isPlace(part)) return !/[\p{L}\p{N}]/u.test(part.text);
    // a place made before samples were kept: judged by its pattern
    if (part.sample === undefined) return !/\\d|\[0-9/.test(part.pattern);
    return /^[\p{L}\s]+$/u.test(part.sample) && /\p{L}/u.test(part.sample);
  });
}

const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** What the rule leaves out of this element on this screenshot, if the server says (REQ-066-06). */
export function leftOutFor(
  rule: Pick<ScreenRule, "leftOut">,
  side: LeftOut["side"],
  bounds: Rect,
): LeftOut | undefined {
  return rule.leftOut?.find(
    (item) => item.side === side && sameRect(item.element, bounds),
  );
}

/**
 * How a variable-text rule is drawn on a screenshot (REQ-066-05, REQ-072-07):
 * what is not compared hatched, nothing else.
 * Null from a server that does not say: the found elements are drawn as before.
 */
export function leftOutMarks(
  rule: Pick<ScreenRule, "leftOut">,
  side: LeftOut["side"],
): Array<{ rect: Rect; mark: "hatch"; element: Rect }> | null {
  if (!rule.leftOut) return null;
  return (
    rule.leftOut
      .filter((item) => item.side === side)
      // no frame round the element: it added nothing to the hatch and read as a selection
      .flatMap((item) =>
        item.areas.map((rect) => ({
          rect,
          mark: "hatch" as const,
          element: item.element,
        })),
      )
  );
}

/**
 * The text shown inside an element whose own text is only a label: the one
 * element inside it with a text, or null when there is none or several
 * (REQ-066-08).
 */
export function textOnScreen(
  element: PickableElement,
  elements: PickableElement[],
): PickableElement | null {
  if (!element.labelOnly || element.index === undefined) return null;
  const byIndex = new Map(elements.map((item) => [item.index, item]));
  const inside = (item: PickableElement) => {
    let parent = item.parent;
    while (parent !== null && parent !== undefined) {
      if (parent === element.index) return true;
      parent = byIndex.get(parent)?.parent;
    }
    return false;
  };
  // an icon's label is not drawn: it is no text on the screen
  const shown = elements.filter(
    (item) =>
      item !== element && !!item.text && !item.labelOnly && inside(item),
  );
  return shown.length === 1 ? shown[0] : null;
}

/**
 * What the other screenshot's text of the same element says differently, for
 * the warning under the pieces (REQ-072-04, 05): its words that stand where
 * the marked text has unmarked words, at most three; else a value in a marked
 * place that is not of the marked kind; else nothing to warn about.
 */
export function otherDiffers(
  parts: TextPart[],
  text: string,
  otherText: string,
): { words: string[] } | { value: string } | null {
  const own = spaces(text).trim();
  let at = 0;
  const marked: Array<[number, number]> = [];
  for (const segment of placesIn(parts, text)) {
    if (segment.place) marked.push([at, at + segment.text.length]);
    at += segment.text.length;
  }
  const words = (value: string) =>
    [...value.matchAll(/(?:(?!&#(?:10|13);)\S)+/g)].map((match) => {
      const from = match.index ?? 0;
      return {
        text: match[0],
        marked: marked.some(
          ([start, end]) => from < end && start < from + match[0].length,
        ),
      };
    });
  const a = words(own);
  const b = words(spaces(otherText).trim());
  // the longest run of words both texts share; a row is tens of words
  const table = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i][j] =
        a[i].text === b[j].text
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
  const unmarked: string[] = [];
  const inPlaces: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].text === b[j].text) {
      i++;
      j++;
      continue;
    }
    // a run that differs: up to the next word both share
    const fromI = i;
    const fromJ = j;
    while (
      (i < a.length || j < b.length) &&
      !(i < a.length && j < b.length && a[i].text === b[j].text)
    ) {
      if (j >= b.length || (i < a.length && table[i + 1][j] >= table[i][j + 1]))
        i++;
      else j++;
    }
    const mine = a.slice(fromI, i);
    const theirs = b.slice(fromJ, j).map((word) => word.text);
    if (mine.some((word) => !word.marked) || (!mine.length && theirs.length))
      unmarked.push(...theirs);
    else inPlaces.push(...theirs);
  }
  if (unmarked.length) return { words: unmarked.slice(0, 3) };
  if (!fitsParts(parts, otherText) && inPlaces.length)
    return { value: inPlaces.join(" ") };
  return null;
}
