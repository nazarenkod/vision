import { MessageKey } from "../../i18n";
import { ProjectDto } from "../../types";
import { ImageComparison } from "../../types/imageComparison";
import { parseUiTreeSettings } from "../../types/insights";
import { CONDITION_FIELDS, isSelector, patternError } from "./patterns";

export type SettingsTab =
  "general" | "comparison" | "mobile" | "accessibility" | "jira";

export const SETTINGS_TABS: SettingsTab[] = [
  "general",
  "comparison",
  "mobile",
  "accessibility",
  "jira",
];

export interface FieldError {
  // the id of the input to put the cursor in
  field: string;
  tab: SettingsTab;
  message: MessageKey;
  params?: Record<string, string | number>;
}

const between = (value: unknown, min: number, max = Infinity) =>
  typeof value === "number" &&
  !Number.isNaN(value) &&
  value >= min &&
  value <= max;

const parseConfig = (value: string): Record<string, unknown> => {
  try {
    return JSON.parse(value) ?? {};
  } catch {
    return {};
  }
};

/**
 * What is wrong with a project's settings, in the order of the tabs: the page
 * saves nothing while this is not empty and puts the cursor on the first.
 */
export function validateProject(project: ProjectDto): FieldError[] {
  const errors: FieldError[] = [];
  const add = (
    field: string,
    tab: SettingsTab,
    message: MessageKey,
    params?: FieldError["params"],
  ) => errors.push({ field, tab, message, params });

  if ((project.name ?? "").trim().length < 2) {
    add("name", "general", "validation.twoCharacters");
  }
  if ((project.mainBranchName ?? "").trim().length < 2) {
    add("branchName", "general", "validation.twoCharacters");
  }
  if (
    !Number.isInteger(project.maxBuildAllowed) ||
    project.maxBuildAllowed < 1
  ) {
    add("buildCount", "general", "validation.wholeNumberFrom", { min: 1 });
  }
  if (
    !Number.isInteger(project.maxBranchLifetime) ||
    project.maxBranchLifetime < 1
  ) {
    add("maxBranchLifetime", "general", "validation.wholeNumberFrom", {
      min: 1,
    });
  }

  const config = parseConfig(project.imageComparisonConfig);
  switch (project.imageComparison) {
    case ImageComparison.pixelmatch:
    case ImageComparison.odiff:
      if (!between(config.threshold, 0, 1)) {
        add("threshold", "comparison", "validation.between", {
          min: 0,
          max: 1,
        });
      }
      break;
    case ImageComparison.lookSame:
      if (config.tolerance !== undefined && !between(config.tolerance, 0)) {
        add("tolerance", "comparison", "validation.atLeast", { min: 0 });
      }
      if (
        config.antialiasingTolerance !== undefined &&
        !between(config.antialiasingTolerance, 0)
      ) {
        add("antialiasingTolerance", "comparison", "validation.atLeast", {
          min: 0,
        });
      }
      break;
    case ImageComparison.vlm:
      if (!`${config.model ?? ""}`.trim()) {
        add("model", "comparison", "validation.required");
      }
      if (config.provider === "gemini" && !`${config.apiKey ?? ""}`.trim()) {
        add("apiKey", "comparison", "validation.required");
      }
      if (!`${config.prompt ?? ""}`.trim()) {
        add("prompt", "comparison", "validation.required");
      }
      if (!between(config.temperature, 0, 1)) {
        add("temperature", "comparison", "validation.between", {
          min: 0,
          max: 1,
        });
      }
      break;
  }

  const settings = parseUiTreeSettings(project.uiTreeSettings);
  if (settings.maxMoveDp !== null && !between(settings.maxMoveDp, 0)) {
    add("maxMoveDp", "mobile", "validation.atLeast", { min: 0 });
  }
  for (const rule of settings.elementRules) {
    if (!isSelector(rule.selector)) {
      add(`rule-${rule.id}`, "mobile", "validation.selector");
    } else if (
      rule.action === "tolerate" &&
      !between(rule.maxDiffPercent, 0, 100)
    ) {
      add(`rule-${rule.id}`, "mobile", "validation.between", {
        min: 0,
        max: 100,
      });
    }
  }

  for (const selector of settings.screenTitle ?? []) {
    // a bare value is an id, as the server reads it
    const pattern = /^text:(\/.+\/[a-z]*)$/s.exec(selector.trim())?.[1];
    const error = pattern ? patternError(pattern) : null;
    if (error) {
      add("screenTitleSelectors", "accessibility", "validation.pattern", {
        error,
      });
    }
  }
  for (const item of settings.a11yClasses ?? []) {
    const broken = CONDITION_FIELDS.flatMap((field) => item.when?.[field] ?? [])
      .map(patternError)
      .find(Boolean);
    if (broken) {
      add(`class-${item.id}`, "accessibility", "validation.pattern", {
        error: broken,
      });
    }
  }

  const url = (project.jiraUrl ?? "").trim();
  if (url && !/^https?:\/\/[^\s/]+/.test(url)) {
    add("jiraUrl", "jira", "validation.url");
  }
  return errors;
}
