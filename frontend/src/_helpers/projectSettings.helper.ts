import { Project, ProjectDto } from "../types";
import { english, MessageKey, Text } from "../i18n";
import { DICTIONARIES } from "../i18n/dictionaries";

/**
 * The sections of the settings page, in order, with what each one holds: the
 * dictionary keys of the section title and of its settings' labels.
 */
export const SETTINGS_SECTIONS = [
  {
    id: "general",
    title: "section.general",
    labels: [
      "general.name",
      "general.mainBranch",
      "general.buildCount",
      "general.branchLifetime",
    ],
  },
  {
    id: "review",
    title: "section.review",
    labels: ["review.autoApprove", "review.bulkApprove", "review.groupBy"],
  },
  {
    id: "comparison",
    title: "section.comparison",
    labels: [
      // the engines' own names are the same in every language
      "pixelmatch",
      "looks-same",
      "odiff",
      "VLM",
      "comparison.threshold",
      "comparison.ignoreAntialiasing",
      "comparison.allowDiffDimensions",
      "comparison.strict",
      "comparison.tolerance",
      "comparison.antialiasingTolerance",
      "comparison.ignoreCaret",
      "comparison.failOnLayoutDiff",
      "comparison.outputDiffMask",
      "comparison.provider",
      "comparison.geminiKey",
      "comparison.geminiModel",
      "Ollama",
      "comparison.model",
      "comparison.prompt",
      "comparison.temperature",
      "comparison.useThinking",
    ],
  },
  {
    id: "mobile",
    title: "section.mobile",
    labels: [
      "mobile.systemBars",
      "mobile.moves",
      "mobile.maxMove",
      "mobile.hidden",
      "mobile.loading",
      "mobile.wrongScreen",
      "mobile.reference",
    ],
  },
  {
    id: "a11y",
    title: "section.a11y",
    labels: [
      "a11y.screenTitle",
      "a11y.sameProblem",
      "a11y.classes",
      "a11y.rule.touchTarget",
      "a11y.rule.lowContrast",
      "a11y.rule.missingLabel",
      "a11y.rule.inputWithoutLabel",
      "a11y.rule.duplicateLabel",
      "a11y.rule.redundantRole",
      "a11y.rule.notAccessible",
    ],
  },
  {
    id: "jira",
    title: "section.jira",
    labels: [
      "jira.url",
      "jira.token",
      "jira.email",
      "jira.issueType",
      "jira.linkType",
    ],
  },
  {
    id: "danger",
    title: "section.danger",
    labels: ["settings.deleteProject"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  title: MessageKey;
  labels: ReadonlyArray<MessageKey | string>;
}>;

export type SectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

// a label that is no key is a name every language shares
const textOf = (text: Text, key: string) =>
  key in DICTIONARIES.en ? text(key as MessageKey) : key;

/**
 * Sections whose title or settings hold the text, and the settings that do
 * (REQ-018-43), in the interface's language or in English (REQ-023-12).
 */
export function matchSettings(
  query: string,
  text: Text = english,
): {
  sections: SectionId[];
  labels: string[];
} {
  const wanted = query.trim().toLowerCase();
  if (!wanted) {
    return { sections: SETTINGS_SECTIONS.map((s) => s.id), labels: [] };
  }
  const holds = (key: string) =>
    [textOf(text, key), textOf(english, key)].some((label) =>
      label.toLowerCase().includes(wanted),
    );
  const sections: SectionId[] = [];
  const labels: string[] = [];
  for (const section of SETTINGS_SECTIONS) {
    const hits = (section.labels as ReadonlyArray<string>).filter(holds);
    if (hits.length || holds(section.title)) {
      sections.push(section.id);
      labels.push(...hits.map((key) => textOf(text, key)));
    }
  }
  return { sections, labels };
}

const parse = (json: string | null | undefined): Record<string, unknown> => {
  try {
    const value = json ? JSON.parse(json) : {};
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// where each part of the UI tree settings JSON is edited
const TREE_SECTION: Record<string, SectionId> = {
  excludeSystemBars: "mobile",
  compensateMoves: "mobile",
  maxMoveDp: "mobile",
  detectSemanticChanges: "mobile",
  detectLoading: "mobile",
  detectScreenMismatch: "mobile",
  referenceDevice: "mobile",
  screenTitle: "a11y",
  a11yDuplicates: "a11y",
  a11yClasses: "a11y",
};

const FIELD_SECTION: Partial<Record<keyof ProjectDto, SectionId>> = {
  name: "general",
  mainBranchName: "general",
  maxBuildAllowed: "general",
  maxBranchLifetime: "general",
  autoApproveFeature: "review",
  bulkApproveVariations: "review",
  bulkApproveGroupBy: "review",
  imageComparison: "comparison",
  imageComparisonConfig: "comparison",
  jiraUrl: "jira",
  jiraEmail: "jira",
  jiraIssueType: "jira",
  jiraLinkType: "jira",
};

/** Titles of the sections with unsaved changes, in page order (REQ-018-47). */
export function changedSections(
  saved: Project | ProjectDto,
  edited: ProjectDto,
  text: Text = english,
): string[] {
  const changed = new Set<SectionId>();
  for (const [field, section] of Object.entries(FIELD_SECTION)) {
    const key = field as keyof ProjectDto;
    if (!same(saved[key as keyof typeof saved], edited[key]))
      changed.add(section);
  }
  // a typed token, or an emptied one, is a change even though none is shown
  if (edited.jiraToken !== undefined) changed.add("jira");
  const before = parse(saved.uiTreeSettings);
  const after = parse(edited.uiTreeSettings);
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const section = TREE_SECTION[key];
    if (section && !same(before[key], after[key])) changed.add(section);
  }
  return SETTINGS_SECTIONS.filter((s) => changed.has(s.id)).map((s) =>
    text(s.title),
  );
}

/** The settings a save is checked against: what the page loaded (REQ-018-53). */
export function loadedSettings(project: Project): Record<string, unknown> {
  const fields = Object.keys(FIELD_SECTION).concat("uiTreeSettings");
  return Object.fromEntries(
    fields.map((field) => [field, project[field as keyof Project] ?? null]),
  );
}

/** Deleting a project needs its exact name typed (REQ-018-49). */
export const deleteConfirmed = (name: string, typed: string): boolean =>
  !!name && typed === name;
