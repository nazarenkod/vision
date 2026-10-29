import {
  changedSections,
  deleteConfirmed,
  loadedSettings,
  matchSettings,
  ruleSelectorError,
} from "./projectSettings.helper";
import { TEST_PROJECT } from "../_test/test.data.helper";
import { Project } from "../types";

const project = {
  ...TEST_PROJECT,
  bulkApproveVariations: false,
  bulkApproveGroupBy: "customTags",
  jiraUrl: null,
  uiTreeSettings: JSON.stringify({
    excludeSystemBars: true,
    elementRules: [],
    screenTitle: ["id:Appbar#Title"],
  }),
} as Project;

describe("project settings", () => {
  it("finds settings by section or field name", () => {
    expect(matchSettings("loading")).toEqual({
      sections: ["mobile"],
      labels: ["Warn about loading states"],
    });
    expect(matchSettings("JIRA").sections).toEqual(["jira"]);
    expect(matchSettings("tolerance").sections).toEqual(["comparison"]);
    expect(matchSettings("").sections).toHaveLength(8);
    expect(matchSettings("nothing like this")).toEqual({
      sections: [],
      labels: [],
    });
  });

  it("names the sections with unsaved changes", () => {
    expect(changedSections(project, { ...project })).toEqual([]);
    const tree = JSON.parse(project.uiTreeSettings as string);
    expect(
      changedSections(project, {
        ...project,
        maxBuildAllowed: 5,
        uiTreeSettings: JSON.stringify({
          ...tree,
          excludeSystemBars: false,
          elementRules: [{ id: "1", selector: "id:clock", action: "ignore" }],
        }),
      }),
    ).toEqual(["General", "Mobile screenshots", "Element rules"]);
    // a token typed in counts though none is ever shown
    expect(changedSections(project, { ...project, jiraToken: "" })).toEqual([
      "Jira",
    ]);
    // only the order of keys changed: nothing to save
    expect(
      changedSections(project, {
        ...project,
        uiTreeSettings: JSON.stringify({
          screenTitle: ["id:Appbar#Title"],
          elementRules: [],
          excludeSystemBars: true,
        }),
      }),
    ).toEqual([]);
  });

  it("refuses an element rule without id:, class: or text:", () => {
    expect(ruleSelectorError("id:clock")).toBeNull();
    expect(ruleSelectorError("class:MapView")).toBeNull();
    expect(ruleSelectorError("text:/\\d+:\\d+/")).toBeNull();
    expect(ruleSelectorError("")).toBeNull();
    expect(ruleSelectorError("clock")).toMatch(
      /Start with id:, class: or text:/,
    );
    expect(ruleSelectorError("id:")).toMatch(/Start with/);
  });

  it("deletes only after the exact project name", () => {
    expect(deleteConfirmed("Mobile Shop", "Mobile Shop")).toBe(true);
    expect(deleteConfirmed("Mobile Shop", "mobile shop")).toBe(false);
    expect(deleteConfirmed("Mobile Shop", "Mobile Shop ")).toBe(false);
    expect(deleteConfirmed("", "")).toBe(false);
  });

  it("sends back the settings as the page loaded them", () => {
    const loaded = loadedSettings(project);
    expect(loaded.name).toBe(project.name);
    expect(loaded.uiTreeSettings).toBe(project.uiTreeSettings);
    expect(loaded).not.toHaveProperty("builds");
    expect(loaded).not.toHaveProperty("jiraToken");
  });
});
