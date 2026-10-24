import { Rect, UiTree } from './ui-tree.types';
import { elementsUnderRegions } from './structure-diff';

export type NoiseHintKind = 'status-bar' | 'dynamic-text' | 'anti-aliasing';

export interface NoiseHint {
  kind: NoiseHintKind;
  message: string;
  // ignore area that would silence this noise, in screenshot pixels
  ignoreArea?: Rect;
}

// Status bar height: 24 dp on Android, ~50 pt on iPhones with a notch or island.
const STATUS_BAR = { android: 24, ios: 50 };
const TYPICAL_PHONE_WIDTH_DP = 411;
// Times, dates, money amounts, counters: text that changes on every run.
const DYNAMIC_TEXT = /\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\b|\d[\d\s.,]*\s?(₴|\$|€|uah|грн|usd|eur)|^\d+$/i;
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
export function findNoiseHints(input: {
  regions: Rect[];
  diffPercent: number | null;
  imageWidth: number;
  imageHeight: number;
  tree?: UiTree | null;
}): NoiseHint[] {
  const { regions, imageWidth, imageHeight, tree } = input;
  if (!regions.length) return [];
  const hints: NoiseHint[] = [];

  const ios = tree?.format === 'appium-ios';
  const pixelsPerDp = tree?.pixelsPerDp ?? Math.min(imageWidth, imageHeight) / TYPICAL_PHONE_WIDTH_DP;
  const band: Rect = {
    x: 0,
    y: 0,
    width: imageWidth,
    height: Math.round((ios ? STATUS_BAR.ios : STATUS_BAR.android) * pixelsPerDp),
  };
  if (imageHeight > imageWidth && regions.every((region) => inside(region, band))) {
    hints.push({
      kind: 'status-bar',
      message: 'Only the status bar changed (clock, battery or signal).',
      ignoreArea: band,
    });
  }

  if (tree) {
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
