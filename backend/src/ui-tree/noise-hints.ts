import { Rect, UiTree } from './ui-tree.types';
import { elementsUnderRegions, StructuralChange } from './structure-diff';
import { onlyNumbersDiffer } from './number-change';
import { IOS_STATUS_BAR_PT } from './comparison-inputs';

export type NoiseHintKind = 'status-bar' | 'dynamic-text' | 'anti-aliasing' | 'numbers';

/** An element whose text changed only in its numbers (REQ-077-07). */
export interface NumberChange {
  key: string;
  element: string;
  // the element on the current tree, to pick it on the screenshot (REQ-077-09)
  index: number | null;
  before: string;
  after: string;
}

export interface NoiseHint {
  kind: NoiseHintKind;
  message: string;
  // ignore area that would silence this noise, in screenshot pixels
  ignoreArea?: Rect;
  // kind "numbers": the elements whose numbers changed
  numbers?: NumberChange[];
}

// Status bar height: 24 dp on Android; on iOS the same band the comparison leaves out,
// so a change the exclusion would hide is also the one called status-bar noise.
const STATUS_BAR = { android: 24, ios: IOS_STATUS_BAR_PT };
const TYPICAL_PHONE_WIDTH_DP = 411;
// Times, dates, money amounts, counters: text that changes on every run.
const DYNAMIC_TEXT =
  /\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\b|\d[\d\s.,]*\s?(₴|\$|€|uah|грн|usd|eur)|^\d+$/i;
// A change this small and this tidy is rendering noise rather than a design change.
const MAX_AA_PERCENT = 0.05;
const MAX_AA_REGION_PX = 16;

const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/**
 * Cheap, deterministic guesses that a diff is noise: the status bar clock,
 * text that holds a time or an amount, a few anti-aliased pixels. Each hint
 * carries the ignore area that would stop it from coming back.
 */
const touches = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Every change that counts is a text whose numbers alone changed (REQ-077-06): a counter,
 * a rate, an amount. Moves and resizes of those elements come with a longer number; a
 * changed area must lie on one of them. Null when anything else changed.
 */
export function numbersOnlyHint(changes: StructuralChange[], regions: Rect[], tree: UiTree | null): NoiseHint | null {
  const numeric = changes.filter(
    (change) =>
      (change.kind === 'text' || change.kind === 'label') && onlyNumbersDiffer(change.before ?? '', change.after ?? '')
  );
  if (!numeric.length) return null;
  const keys = new Set(numeric.map((change) => change.key));
  const rest = changes.filter((change) => !numeric.includes(change));
  if (!rest.every((change) => (change.kind === 'moved' || change.kind === 'resized') && keys.has(change.key))) {
    return null;
  }
  if (!regions.every((region) => numeric.some((change) => touches(region, change.bounds)))) return null;
  const indexOf = new Map((tree?.nodes ?? []).map((node) => [node.key, node.index]));
  const seen = new Set<string>();
  const numbers = numeric.flatMap((change) => {
    if (seen.has(change.key)) return [];
    seen.add(change.key);
    return [
      {
        key: change.key,
        element: change.element,
        index: indexOf.get(change.key) ?? null,
        before: change.before ?? '',
        after: change.after ?? '',
      },
    ];
  });
  return {
    kind: 'numbers',
    message: `Only numbers changed in ${numbers.length} element(s): counters, rates, amounts. Usually that is data, not a change to the app.`,
    numbers,
  };
}

export function findNoiseHints(input: {
  regions: Rect[];
  diffPercent: number | null;
  imageWidth: number;
  imageHeight: number;
  tree?: UiTree | null;
  // the tree's changes left after the rules: lets numbers alone be told (REQ-077-06)
  changes?: StructuralChange[];
}): NoiseHint[] {
  const { regions, imageWidth, imageHeight, tree } = input;
  // a number that changed in a label only shows no pixels, and is noise all the same
  const numbers = input.changes ? numbersOnlyHint(input.changes, regions, tree ?? null) : null;
  if (!regions.length) return numbers ? [numbers] : [];
  const hints: NoiseHint[] = [];

  const ios = tree?.format === 'appium-ios';
  const pixelsPerDp = tree?.pixelsPerDp ?? Math.min(imageWidth, imageHeight) / TYPICAL_PHONE_WIDTH_DP;
  const band: Rect = {
    x: 0,
    y: 0,
    width: imageWidth,
    height: Math.round((ios ? STATUS_BAR.ios : STATUS_BAR.android) * pixelsPerDp),
  };
  // a browser's screenshot has no status bar to blame (REQ-050-07)
  if (tree?.format !== 'web' && imageHeight > imageWidth && regions.every((region) => inside(region, band))) {
    hints.push({
      kind: 'status-bar',
      message: 'Only the status bar changed (clock, battery or signal).',
      ignoreArea: band,
    });
  }

  if (numbers) {
    // the same elements as a dynamic-text hint would name, said once
    hints.push(numbers);
  } else if (tree) {
    const elements = elementsUnderRegions(tree, regions);
    const nodes = elements.map((e) => (e.key ? tree.nodes.find((n) => n.key === e.key) : null));
    if (nodes.every((node) => node && DYNAMIC_TEXT.test((node.text || node.label).trim()))) {
      for (const node of new Set(nodes)) {
        hints.push({
          kind: 'dynamic-text',
          message: `"${(node.text || node.label).trim().slice(0, 30)}" looks like a time, date or amount that changes between runs.`,
          ignoreArea: node.bounds,
        });
      }
    }
  }

  const largest = regions[0];
  if (
    !hints.length &&
    (input.diffPercent ?? 100) <= MAX_AA_PERCENT &&
    largest.width <= MAX_AA_REGION_PX &&
    largest.height <= MAX_AA_REGION_PX
  ) {
    hints.push({ kind: 'anti-aliasing', message: 'A few pixels at edges changed: most likely rendering noise.' });
  }
  return hints;
}
