import { PNG } from 'pngjs';
import { Rect } from './ui-tree.types';
import { normalize } from './variable-text';

/**
 * Finding on a screenshot where the marked places of a variable text are drawn
 * (spec 071). The element's text is known from the UI tree; recognition only
 * says where its words stand, so a misread letter here and there does not matter.
 */

/** A word recognition found, with its bounds in the picture it was found in. */
export interface RecognisedWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

// how far a pixel's brightness may differ from its background before it counts as ink
const INK_THRESHOLD = 40;
// rows above and below whose pixels decide a row's background: a stroke of text is thinner
const BAND = 15;

/**
 * Black where a pixel stands out from the background around it, white
 * elsewhere, with long straight lines taken out: grey small print and text on
 * a coloured banner come out as black on white, which recognition reads far
 * better (the grey date line of the bank's history is not found without it).
 * The background of a row is the commonest brightness in a band of rows round
 * it, so a row crossing a word's strokes keeps white as its background; the
 * frame of a button is no text, and recognition reads none inside one.
 */
export function textMask(png: PNG, threshold = INK_THRESHOLD): PNG {
  const { width, height, data } = png;
  const out = new PNG({ width, height });
  const lum = new Float64Array(width * height);
  const bins = Array.from({ length: height }, () => new Uint32Array(32));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      lum[y * width + x] = value;
      bins[y][Math.min(31, Math.floor(value / 8))]++;
    }
  }
  const ink = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const band = new Uint32Array(32);
    for (let k = Math.max(0, y - BAND); k <= Math.min(height - 1, y + BAND); k++) {
      for (let b = 0; b < 32; b++) band[b] += bins[k][b];
    }
    let common = 0;
    for (let b = 1; b < 32; b++) if (band[b] > band[common]) common = b;
    const background = common * 8 + 4;
    for (let x = 0; x < width; x++) ink[y * width + x] = Math.abs(lum[y * width + x] - background) > threshold ? 1 : 0;
  }
  // a run of ink across half the width or most of the height is a frame or a rule, not a letter
  const line = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0, run = 0; x <= width; x++) {
      if (x < width && ink[y * width + x]) run++;
      else {
        if (run > width / 2) for (let k = x - run; k < x; k++) line[y * width + k] = 1;
        run = 0;
      }
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0, run = 0; y <= height; y++) {
      if (y < height && ink[y * width + x]) run++;
      else {
        if (run > height * 0.6) for (let k = y - run; k < y; k++) line[k * width + x] = 1;
        run = 0;
      }
    }
  }
  for (let i = 0; i < width * height; i++) {
    const value = ink[i] && !line[i] ? 0 : 255;
    out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = value;
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

/** A black and white mask made smaller by a factor of at most 1: a pixel is black when most of its block was. */
export function shrinkMask(mask: PNG, scale: number): PNG {
  if (scale >= 1) return mask;
  const width = Math.max(1, Math.round(mask.width * scale));
  const height = Math.max(1, Math.round(mask.height * scale));
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    const fromY = Math.floor(y / scale);
    const toY = Math.min(mask.height, Math.max(fromY + 1, Math.floor((y + 1) / scale)));
    for (let x = 0; x < width; x++) {
      const fromX = Math.floor(x / scale);
      const toX = Math.min(mask.width, Math.max(fromX + 1, Math.floor((x + 1) / scale)));
      let sum = 0;
      for (let yy = fromY; yy < toY; yy++)
        for (let xx = fromX; xx < toX; xx++) sum += mask.data[(yy * mask.width + xx) * 4];
      const value = sum / ((toY - fromY) * (toX - fromX)) < 160 ? 0 : 255;
      const i = (y * width + x) * 4;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = value;
      out.data[i + 3] = 255;
    }
  }
  return out;
}

/** The part of a picture inside a rectangle, clamped to the picture. */
export function cropPng(png: PNG, rect: Rect): PNG {
  const x0 = Math.max(0, Math.round(rect.x));
  const y0 = Math.max(0, Math.round(rect.y));
  const x1 = Math.min(png.width, Math.round(rect.x + rect.width));
  const y1 = Math.min(png.height, Math.round(rect.y + rect.height));
  const out = new PNG({ width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) });
  for (let y = y0; y < y1; y++) {
    png.data.copy(out.data, (y - y0) * out.width * 4, (y * png.width + x0) * 4, (y * png.width + x1) * 4);
  }
  return out;
}

// letters recognition mixes up, made one; signs around a word are not what tells two words apart
// Latin letters that look like Cyrillic ones: recognition reads "Історія" as "IcTopis"
const LOOKALIKE: Record<string, string> = {
  a: 'а',
  b: 'в',
  c: 'с',
  e: 'е',
  h: 'н',
  k: 'к',
  m: 'м',
  o: 'о',
  p: 'р',
  t: 'т',
  x: 'х',
  y: 'у',
};
const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/[.,:;*+\-−'"«»()]/g, '')
    .replace(/[abcehkmoptxy]/g, (letter) => LOOKALIKE[letter])
    .replace(/[il1|іI]/g, '1');

function distance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

/** How alike a word of the text and a recognised word are, 0 to 1. */
export function likeness(token: string, word: string): number {
  const a = fold(token);
  const b = fold(word);
  if (!a && !b) return token.trim() === word.trim() ? 1 : 0;
  return 1 - distance(a, b) / Math.max(a.length, b.length, 1);
}

const MIN_LIKENESS = 0.6;
// how many recognised words a word of the text may skip: an icon or an emoji reads as noise
const LOOK_AHEAD = 4;

const sameLine = (a: RecognisedWord['bbox'], b: RecognisedWord['bbox']) => a.y0 < b.y1 && b.y0 < a.y1;

/**
 * The area of each place among the recognised words (REQ-071-02): the words of
 * the text are matched to the recognised ones in order, and a place is the
 * union of the words it lies in, on one line of text. Null and the first value
 * not found when a place cannot be told.
 */
export function placeAreas(
  text: string,
  places: Array<{ value: string; start: number; end: number }>,
  words: RecognisedWord[]
): { areas: Rect[] } | { missing: string } {
  const tokens = [...text.matchAll(/\S+/g)].map((match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
  const found: Array<RecognisedWord | null> = [];
  let next = 0;
  for (const token of tokens) {
    let best = -1;
    let bestLikeness = 0;
    for (let j = next; j < Math.min(words.length, next + LOOK_AHEAD); j++) {
      const value = likeness(token.text, words[j].text);
      if (value > bestLikeness) {
        bestLikeness = value;
        best = j;
      }
    }
    if (bestLikeness >= MIN_LIKENESS) {
      found.push(words[best]);
      next = best + 1;
    } else {
      found.push(null);
    }
  }
  const areas: Rect[] = [];
  for (const place of places) {
    const inPlace = tokens.flatMap((token, i) => (token.start < place.end && place.start < token.end ? [i] : []));
    const boxes = inPlace.map((i) => found[i]?.bbox);
    if (!boxes.length || boxes.some((box) => !box) || boxes.some((box) => !sameLine(box, boxes[0]))) {
      return { missing: place.value };
    }
    const x0 = Math.min(...boxes.map((box) => box.x0));
    const y0 = Math.min(...boxes.map((box) => box.y0));
    const x1 = Math.max(...boxes.map((box) => box.x1));
    const y1 = Math.max(...boxes.map((box) => box.y1));
    areas.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }
  return { areas };
}

type Place = { value: string; start: number; end: number };

const wordsOf = (text: string) =>
  [...text.matchAll(/\S+/g)].map((match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));

/**
 * Where the marked places of one text stand in another text of the same element,
 * whose fixed words differ (REQ-072-02): the words of both are lined up (the
 * longest run they share), and a place is the words of the other text between
 * the same shared words around it, word for word when there are as many on
 * both sides. Null when a place cannot be told.
 */
export function alignPlaces(
  text: string,
  places: Place[],
  otherText: string
): { text: string; places: Place[] } | null {
  const a = wordsOf(text);
  const other = normalize(otherText);
  const b = wordsOf(other);
  // longest common run of words; a row is tens of words
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i].text === b[j].text ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const twin = new Array<number>(a.length).fill(-1);
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i].text === b[j].text) twin[i++] = j++;
    else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  const result: Place[] = [];
  for (const place of places) {
    const inPlace = a.flatMap((word, i) => (word.start < place.end && place.start < word.end ? [i] : []));
    if (!inPlace.length) return null;
    const first = inPlace[0];
    const last = inPlace[inPlace.length - 1];
    let before = first - 1;
    while (before >= 0 && twin[before] < 0) before--;
    let after = last + 1;
    while (after < a.length && twin[after] < 0) after++;
    const fromA = before + 1;
    const toA = after - 1;
    const fromB = before >= 0 ? twin[before] + 1 : 0;
    const toB = after < a.length ? twin[after] - 1 : b.length - 1;
    let range: [number, number] | null = null;
    if (toA - fromA === toB - fromB) range = [fromB + first - fromA, fromB + last - fromA];
    else if (fromA === first && toA === last && toB >= fromB) range = [fromB, toB];
    if (!range) return null;
    const start = b[range[0]].start;
    const end = b[range[1]].end;
    result.push({ value: other.slice(start, end), start, end });
  }
  return { text: other, places: result };
}
