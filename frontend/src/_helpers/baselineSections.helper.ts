import { TestVariation } from "../types";

/**
 * The checks of one feature on the baselines page (067), or, with no feature,
 * the checks that belong to none: those are plain cards, not a group.
 * `count` is the whole section's, also on a page that shows only part of it.
 */
export type BaselineSection = {
  feature: string | null;
  count: number;
  checks: TestVariation[][];
};

const featureOf = (variation: TestVariation) =>
  variation.featureName?.trim() || null;

/**
 * The feature of a check card: the one of its device whose baseline changed
 * last. A device without a feature has no say (REQ-067-07).
 */
export function featureOfCheck(devices: TestVariation[]): string | null {
  const named = devices.filter((device) => featureOf(device));
  if (!named.length) return null;
  const latest = named.reduce((a, b) =>
    (b.updatedAt ?? "") > (a.updatedAt ?? "") ? b : a,
  );
  return featureOf(latest);
}

// "Конверти" and "конверти" stay two features: the test names them (067)
const byName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base" }) ||
  (a < b ? -1 : a > b ? 1 : 0);

/**
 * Features by name, ignoring case, then the checks without a feature
 * (REQ-067-04, 05, 13). With no feature anywhere, one plain section: the
 * page as it was (REQ-067-06).
 */
export function baselineSections(checks: TestVariation[][]): BaselineSection[] {
  const byFeature = new Map<string, TestVariation[][]>();
  const plain: TestVariation[][] = [];
  checks.forEach((check) => {
    const feature = featureOfCheck(check);
    if (!feature) plain.push(check);
    else byFeature.set(feature, [...(byFeature.get(feature) ?? []), check]);
  });
  const sections: BaselineSection[] = [...byFeature.keys()]
    .sort(byName)
    .map((feature) => {
      const inFeature = byFeature.get(feature) ?? [];
      return { feature, count: inFeature.length, checks: inFeature };
    });
  if (plain.length) {
    sections.push({ feature: null, count: plain.length, checks: plain });
  }
  return sections;
}

/**
 * One page of cards, counted as without sections; a section the page cuts
 * shows again on the next one, with its whole count (REQ-067-08).
 */
export function pageOfSections(
  sections: BaselineSection[],
  page: number,
  size: number,
): BaselineSection[] {
  const from = (page - 1) * size;
  const to = from + size;
  const shown: BaselineSection[] = [];
  let start = 0;
  sections.forEach((section) => {
    const end = start + section.checks.length;
    const checks = section.checks.slice(
      Math.max(0, from - start),
      Math.max(0, to - start),
    );
    if (checks.length) shown.push({ ...section, checks });
    start = end;
  });
  return shown;
}

/**
 * Search on the baselines page: the check's name as before, or its feature's
 * name, ignoring case (REQ-067-11).
 */
export function matchesBaselineQuery(
  variation: TestVariation,
  query: string,
): boolean {
  if (variation.name.includes(query)) return true;
  const feature = featureOf(variation);
  return !!query && !!feature?.toLowerCase().includes(query.toLowerCase());
}
