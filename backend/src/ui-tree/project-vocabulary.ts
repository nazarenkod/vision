import { screenTitle } from '../a11y/a11y-problems';
import { selectorForNode } from './ui-tree.service';
import { UiNode, UiTree } from './ui-tree.types';

export interface VocabularyElement {
  // what an element rule finds it by; null when only a class pattern can
  selector: string | null;
  // the element id a problem class's element pattern is matched against
  element: string;
  className: string;
  text: string;
  label: string;
  // indexes into screens
  screens: number[];
}

export interface TitleCandidate {
  selector: string;
  screens: number;
  examples: string[];
}

export interface ProjectVocabulary {
  trees: number;
  screens: string[];
  elements: VocabularyElement[];
  classes: Array<{ name: string; screens: number }>;
  titleCandidates: TitleCandidate[];
}

export const VOCABULARY_MAX_ELEMENTS = 3000;
const MAX_TITLE_CANDIDATES = 5;
const MAX_TITLE_EXAMPLES = 5;
// a title sits in the app bar: the top quarter of the screen
const TITLE_AREA_SHARE = 0.25;
// a title found on fewer screens than this names too little of the app to be worth suggesting
const MIN_TITLE_COVERAGE = 0.3;

const shortClass = (className: string) => className.split('.').pop().replace('XCUIElementType', '');

/** The element id a problem class matches: the node's key without the "#2" that tells repeats apart. */
const elementOf = (node: UiNode) => {
  const key = node.key.replace(/#\d+$/, '');
  return key.startsWith('id:') ? key.slice(3) : key;
};

const shortId = (resourceId: string) => resourceId.replace(/^.*:id\//, '');

/**
 * What the project's UI trees contain, for filling settings in instead of
 * typing them: the screens (named as accessibility problems name them), the
 * elements and classes with how many screens each is on, and the selectors
 * that would name screens best as their title.
 */
export function projectVocabulary(
  entries: Array<{ tree: UiTree; checkName: string }>,
  titleSelectors: string[]
): ProjectVocabulary {
  const screens: string[] = [];
  const screenIndex = new Map<string, number>();
  const elements = new Map<string, VocabularyElement & { seen: Set<number> }>();
  const classes = new Map<string, Set<number>>();
  const candidateCounts = new Map<string, number>();

  for (const { tree, checkName } of entries) {
    const name = screenTitle(tree, titleSelectors) ?? checkName;
    if (!screenIndex.has(name)) {
      screenIndex.set(name, screens.length);
      screens.push(name);
    }
    const screen = screenIndex.get(name);

    for (const node of tree.nodes) {
      if (node.key.startsWith('path:') || !node.visible) continue;
      const element = elementOf(node);
      const id = `${element}\n${node.className}`;
      if (!elements.has(id)) {
        elements.set(id, {
          selector: selectorForNode(node),
          element,
          className: node.className,
          text: node.text.trim(),
          label: node.label.trim(),
          screens: [],
          seen: new Set(),
        });
      }
      elements.get(id).seen.add(screen);
      const shortName = shortClass(node.className);
      if (shortName) {
        if (!classes.has(shortName)) classes.set(shortName, new Set());
        classes.get(shortName).add(screen);
      }
      const centre = node.bounds.y + node.bounds.height / 2;
      if (node.resourceId && centre < tree.height * TITLE_AREA_SHARE) {
        const selector = `id:${shortId(node.resourceId)}`;
        candidateCounts.set(selector, (candidateCounts.get(selector) ?? 0) + 1);
      }
    }
  }

  const titleCandidates = [...candidateCounts.keys()]
    .map((selector) => {
      const titles = entries.map(({ tree }) => screenTitle(tree, [selector])).filter(Boolean);
      const distinct = [...new Set(titles)];
      return { selector, screens: titles.length, distinct };
    })
    .filter(
      ({ screens: found, distinct }) =>
        found >= entries.length * MIN_TITLE_COVERAGE && (entries.length < 2 || distinct.length >= 2)
    )
    .sort(
      (a, b) =>
        b.screens * (b.distinct.length / b.screens) - a.screens * (a.distinct.length / a.screens) ||
        b.screens - a.screens ||
        a.selector.localeCompare(b.selector)
    )
    .slice(0, MAX_TITLE_CANDIDATES)
    .map(({ selector, screens: found, distinct }) => ({
      selector,
      screens: found,
      examples: distinct.slice(0, MAX_TITLE_EXAMPLES),
    }));

  return {
    trees: entries.length,
    screens,
    elements: [...elements.values()]
      .sort((a, b) => b.seen.size - a.seen.size || a.element.localeCompare(b.element))
      .slice(0, VOCABULARY_MAX_ELEMENTS)
      .map(({ seen, ...item }) => ({ ...item, screens: [...seen].sort((a, b) => a - b) })),
    classes: [...classes.entries()]
      .map(([name, seen]) => ({ name, screens: seen.size }))
      .sort((a, b) => b.screens - a.screens || a.name.localeCompare(b.name)),
    titleCandidates,
  };
}
