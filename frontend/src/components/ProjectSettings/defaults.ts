import { DEFAULT_PROJECT_EDIT_STATE } from "../../constants";
import { ProjectDto } from "../../types";
import {
  DEFAULT_UI_TREE_SETTINGS,
  UiTreeSettings,
  parseUiTreeSettings,
} from "../../types/insights";

// what a project gets when nobody changed it, as the API creates it
export const PROJECT_DEFAULTS = DEFAULT_PROJECT_EDIT_STATE;

export const UI_TREE_DEFAULTS: UiTreeSettings = DEFAULT_UI_TREE_SETTINGS;

export const DEFAULT_SCREEN_TITLE = ["id:Appbar#Title"];

// the fields of a project its settings page edits; the rest only the API sets
export const EDITABLE_FIELDS = [
  "name",
  "mainBranchName",
  "maxBuildAllowed",
  "maxBranchLifetime",
  "autoApproveFeature",
  "bulkApproveVariations",
  "bulkApproveGroupBy",
  "imageComparison",
  "imageComparisonConfig",
  "jiraUrl",
  "jiraEmail",
  "jiraToken",
  "jiraIssueType",
  "jiraLinkType",
  "uiTreeSettings",
] as const;

const parsed = (value: string | null | undefined) => {
  try {
    return JSON.stringify(JSON.parse(value ?? "null"));
  } catch {
    return value ?? "";
  }
};

/** A project as its settings read: JSON fields by content, empty Jira fields as unset. */
const comparable = (project: Partial<ProjectDto>) =>
  EDITABLE_FIELDS.map((field) => {
    const value = project[field];
    if (field === "uiTreeSettings") {
      return JSON.stringify(parseUiTreeSettings(value as string | null));
    }
    if (field === "imageComparisonConfig") return parsed(value as string);
    if (field === "jiraToken") return value === undefined ? null : value;
    if (field.startsWith("jira")) return ((value as string) ?? "").trim();
    return value;
  });

/** Whether the settings differ, ignoring how equal JSON happens to be written. */
export const settingsDiffer = (
  a: Partial<ProjectDto>,
  b: Partial<ProjectDto>,
) => JSON.stringify(comparable(a)) !== JSON.stringify(comparable(b));
