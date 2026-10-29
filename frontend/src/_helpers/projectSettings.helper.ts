import { Project, ProjectDto } from "../types";

/** The sections of the settings page, in order, with what each one holds. */
export const SETTINGS_SECTIONS = [
  {
    id: "general",
    title: "General",
    labels: [
      "Project name",
      "Main branch",
      "Number of builds to keep",
      "Max branch lifetime (days)",
    ],
  },
  {
    id: "review",
    title: "Review",
    labels: [
      "Auto approve feature",
      "Bulk approve/reject variations",
      "Group variations by",
    ],
  },
  {
    id: "comparison",
    title: "Image comparison",
    labels: [
      "pixelmatch",
      "looks-same",
      "odiff",
      "VLM",
      "Pixel diff threshold",
      "Ignore anti-aliasing",
      "Allow diff dimensions",
      "Strict",
      "Tolerance",
      "Antialiasing tolerance",
      "Ignore caret",
      "Fail on layout diff",
      "Output diff mask",
      "VLM provider",
      "Gemini API key",
      "Gemini model",
      "Ollama",
      "Model",
      "Prompt",
      "Temperature",
      "Use thinking",
    ],
  },
  {
    id: "mobile",
    title: "Mobile screenshots",
    labels: [
      "Leave out status and navigation bars",
      "Compare moved elements at their new place",
      "Only moves up to, dp",
      "Send hidden changes to review",
      "Warn about loading states",
      "Warn about wrong screens",
      "Reference device",
    ],
  },
  {
    id: "a11y",
    title: "Accessibility problems",
    labels: [
      "Screen title in the UI tree",
      "Same problem when",
      "Problem classes",
      "Touch target too small",
      "Low text contrast",
      "Control has no label",
      "Input has no label or hint",
      "Same label on several controls",
      "Label repeats the role",
      "Control hidden from VoiceOver",
    ],
  },
  {
    id: "jira",
    title: "Jira",
    labels: [
      "Jira URL",
      "Shared token",
      "Shared token's account email",
      "Issue type",
      "Link type",
    ],
  },
  { id: "danger", title: "Danger zone", labels: ["Delete project"] },
] as const;

export type SectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

/** Sections whose title or settings hold the text, and the settings that do (REQ-018-43). */
export function matchSettings(query: string): {
  sections: SectionId[];
  labels: string[];
} {
  const wanted = query.trim().toLowerCase();
  if (!wanted) {
    return { sections: SETTINGS_SECTIONS.map((s) => s.id), labels: [] };
  }
  const sections: SectionId[] = [];
  const labels: string[] = [];
  for (const section of SETTINGS_SECTIONS) {
    const hits = section.labels.filter((label) =>
      label.toLowerCase().includes(wanted),
    );
    if (hits.length || section.title.toLowerCase().includes(wanted)) {
      sections.push(section.id);
      labels.push(...hits);
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
  return SETTINGS_SECTIONS.filter((s) => changed.has(s.id)).map((s) => s.title);
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
