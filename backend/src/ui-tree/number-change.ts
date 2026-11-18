// The same pieces as marking a variable text (REQ-033-03), except that a "+" right after a
// number belongs to it: a counter with a ceiling ("99+") is still a number (REQ-077-03).
const PIECE = /&#(?:x[0-9a-f]+|\d+);|[+\-−]?\d+(?:[   .,:/-]\d+)*(?:\+(?!\d))?|\p{L}+|[^\s\p{L}\d]/giu;
const NUMBER = /^[+\-−]?\d/;
const LETTERS = /^\p{L}+$/u;
// how many last letters a word after a number may change by: копійок / копійки, item / items
const ENDING = 2;
const MIN_STEM = 3;

const piecesOf = (text: string) => Array.from(text.match(PIECE) ?? []);

/** The same word in another form: only its last letters differ. */
function sameWordOtherEnding(a: string, b: string): boolean {
  if (!LETTERS.test(a) || !LETTERS.test(b)) return false;
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let common = 0;
  while (common < x.length && common < y.length && x[common] === y[common]) common++;
  return common >= MIN_STEM && common >= Math.max(x.length, y.length) - ENDING;
}

/**
 * Whether two texts differ only in their numbers (REQ-077-03): the same pieces but
 * at least one number, and the word right after a changed number may change its ending.
 */
export function onlyNumbersDiffer(before: string, after: string): boolean {
  const a = piecesOf(before);
  const b = piecesOf(after);
  if (a.length !== b.length) return false;
  let changed = false;
  for (let i = 0; i < a.length; i++) {
    const numbers = [NUMBER.test(a[i]), NUMBER.test(b[i])];
    if (numbers[0] !== numbers[1]) return false;
    if (numbers[0]) {
      if (a[i] !== b[i]) changed = true;
      continue;
    }
    if (a[i] === b[i]) continue;
    const afterChangedNumber = i > 0 && NUMBER.test(a[i - 1]) && a[i - 1] !== b[i - 1];
    if (!afterChangedNumber || !sameWordOtherEnding(a[i], b[i])) return false;
  }
  return changed;
}
