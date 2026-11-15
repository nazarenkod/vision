import { Project, ProjectDto, ProjectPlatform } from "../types";
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
      "general.platform",
    ],
  },
  {
    id: "review",
    title: "section.review",
    labels: ["review.autoApprove"],
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
      // the section was "Mobile screens" before 049: the old name still finds it (REQ-049-11)
      "section.mobileFormer",
      "mobile.systemBars",
      "mobile.moves",
      "mobile.maxMove",
      "mobile.hidden",
    ],
  },
  {
    id: "devices",
    title: "section.devices",
    labels: [
      "devices.device",
      "devices.os",
      "devices.received",
      "browsers.browser",
      "browsers.version",
      "browsers.viewport",
      "browsers.received",
    ],
  },
  {
    id: "a11y",
    title: "section.a11y",
    labels: [
      "a11y.norm.touchTarget",
      "a11y.norm.android",
      "a11y.norm.ios",
      "a11y.norm.web",
      "a11y.norm.contrast",
      "a11y.rule.touchTarget",
      "a11y.rule.lowContrast",
      "a11y.rule.missingLabel",
      "a11y.rule.inputWithoutLabel",
      "a11y.rule.duplicateLabel",
      "a11y.rule.notAccessible",
      "a11y.rule.redundantRole",
    ],
  },
  {
    id: "jira",
    title: "section.jira",
    labels: ["jira.url", "jira.issueType", "jira.linkType"],
  },
  {
    id: "access",
    title: "section.access",
    labels: ["access.pick", "access.add"],
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

/** The platforms, in the order the select offers them; missing is mobile (REQ-050-41). */
export const PLATFORMS: ReadonlyArray<[ProjectPlatform, MessageKey]> = [
  ["mobile", "general.platform.mobile"],
  ["web", "general.platform.web"],
  ["both", "general.platform.both"],
];

/** The settings only one platform has; the rest every project shows (REQ-050-43, 44, 50). */
export type PlatformField =
  | "systemBars"
  | "touchTargetAndroid"
  | "touchTargetIos"
  | "touchTargetWeb"
  | "notAccessible"
  | "devices"
  | "browsers";

const FIELD_PLATFORM: Record<PlatformField, "mobile" | "web"> = {
  systemBars: "mobile",
  touchTargetAndroid: "mobile",
  touchTargetIos: "mobile",
  notAccessible: "mobile",
  devices: "mobile",
  touchTargetWeb: "web",
  browsers: "web",
};

/** Whether the settings page shows the field for a project of this platform. */
export const platformShows = (
  platform: ProjectPlatform,
  field: PlatformField,
): boolean => platform === "both" || FIELD_PLATFORM[field] === platform;

// the labels of fields one platform has, so search finds only what is shown (REQ-050-48)
const LABEL_FIELD: Partial<Record<string, PlatformField>> = {
  "mobile.systemBars": "systemBars",
  "a11y.norm.android": "touchTargetAndroid",
  "a11y.norm.ios": "touchTargetIos",
  "a11y.norm.web": "touchTargetWeb",
  "a11y.rule.notAccessible": "notAccessible",
  "devices.device": "devices",
  "devices.os": "devices",
  "devices.received": "devices",
  "browsers.browser": "browsers",
  "browsers.version": "browsers",
  "browsers.viewport": "browsers",
  "browsers.received": "browsers",
};

const labelShown = (key: string, platform: ProjectPlatform) => {
  const field = LABEL_FIELD[key];
  return !field || platformShows(platform, field);
};

/** The sections with only the labels of the fields the platform shows. */
export const settingsSections = (platform: ProjectPlatform = "mobile") =>
  SETTINGS_SECTIONS.map((section) => ({
    ...section,
    labels: (section.labels as ReadonlyArray<string>).filter((key) =>
      labelShown(key, platform),
    ),
  }));

const parse = (json: string | null | undefined): Record<string, unknown> => {
  try {
    const value = json ? JSON.parse(json) : {};
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
};

/** The project's platform from its UI tree settings JSON: mobile when it has none (REQ-050-41). */
export function platformOf(
  uiTreeSettings: string | null | undefined,
): ProjectPlatform {
  const value = parse(uiTreeSettings).platform;
  return PLATFORMS.some(([platform]) => platform === value)
    ? (value as ProjectPlatform)
    : "mobile";
}

/**
 * The settings JSON with another platform and nothing else changed: what the
 * platform hides is kept for when it is shown again (REQ-050-46).
 */
export const withPlatform = (
  uiTreeSettings: string | null | undefined,
  platform: ProjectPlatform,
): string => JSON.stringify({ ...parse(uiTreeSettings), platform });

const INTRO: Partial<
  Record<SectionId, MessageKey | Record<ProjectPlatform, MessageKey>>
> = {
  comparison: "section.comparisonIntro",
  // where UI trees come from, by platform (REQ-049-12, REQ-050-30, 49)
  mobile: {
    mobile: "section.mobileIntro",
    web: "section.mobileIntroWeb",
    both: "section.mobileIntroBoth",
  },
  devices: {
    mobile: "section.devicesIntro",
    web: "section.devicesIntroWeb",
    both: "section.devicesIntroBoth",
  },
  a11y: "section.a11yIntro",
  jira: "section.jiraIntro",
  access: "section.accessIntro",
};

/** The line under a section's title for a project of this platform, if it has one. */
export function sectionIntro(
  id: SectionId,
  platform: ProjectPlatform = "mobile",
  text: Text = english,
): string | undefined {
  const intro = INTRO[id];
  if (!intro) return undefined;
  return text(typeof intro === "string" ? intro : intro[platform]);
}

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
  platform: ProjectPlatform = "mobile",
): {
  sections: SectionId[];
  labels: string[];
} {
  const wanted = query.trim().toLowerCase();
  const sections: SectionId[] = [];
  if (!wanted) {
    return { sections: SETTINGS_SECTIONS.map((s) => s.id), labels: [] };
  }
  const holds = (key: string) =>
    [textOf(text, key), textOf(english, key)].some((label) =>
      label.toLowerCase().includes(wanted),
    );
  const labels: string[] = [];
  for (const section of settingsSections(platform)) {
    const hits = section.labels.filter(holds);
    if (hits.length || holds(section.title)) {
      sections.push(section.id);
      labels.push(...hits.map((key) => textOf(text, key)));
    }
  }
  return { sections, labels };
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// where each part of the UI tree settings JSON is edited
const TREE_SECTION: Record<string, SectionId> = {
  excludeSystemBars: "mobile",
  compensateMoves: "mobile",
  maxMoveDp: "mobile",
  detectSemanticChanges: "mobile",
  screenTitle: "a11y",
  a11yNorms: "a11y",
  allowedDevices: "devices",
  allowedBrowsers: "devices",
  platform: "general",
};

const FIELD_SECTION: Partial<Record<keyof ProjectDto, SectionId>> = {
  name: "general",
  mainBranchName: "general",
  maxBuildAllowed: "general",
  maxBranchLifetime: "general",
  autoApproveFeature: "review",
  imageComparison: "comparison",
  imageComparisonConfig: "comparison",
  jiraUrl: "jira",
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
