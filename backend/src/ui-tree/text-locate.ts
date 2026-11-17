import { PNG } from 'pngjs';
import { Rect } from './ui-tree.types';

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

// how far a pixel's brightness may differ from its row's before it counts as ink
const INK_THRESHOLD = 40;

/**
 * Black where a pixel stands out from the most common brightness of its own
 * pixel row, white elsewhere: grey small print and text on a coloured banner
 * come out as black on white, which recognition reads far better (on the
 * bank's history, the grey date line is not found at all without it).
 */
export function textMask(png: PNG, threshold = INK_THRESHOLD): PNG {
  const { width, height, data } = png;
  const out = new PNG({ width, height });
  const row = new Float64Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row[x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    const background = Float64Array.from(row).sort()[width >> 1];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const value = Math.abs(row[x] - background) > threshold ? 0 : 255;
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
const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/[.,:;*+\-−'"«»()]/g, '')
    .replace(/[oо]/g, 'о')
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
