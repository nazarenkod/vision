import {
  changedSections,
  deleteConfirmed,
  loadedSettings,
  matchSettings,
} from "./projectSettings.helper";
import { TEST_PROJECT } from "../_test/test.data.helper";
import { Project } from "../types";
import { DICTIONARIES } from "../i18n/dictionaries";
import { translate } from "../i18n/translate";
import type { Text } from "../i18n";

const ukrainian: Text = (key, params) =>
  translate(DICTIONARIES, "uk", key, params);

const project = {
  ...TEST_PROJECT,
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
    expect(matchSettings("").sections).toHaveLength(7);
    // element rules live on the review screen only (REQ-019-01)
    expect(matchSettings("element rule").sections).toEqual([]);
    expect(matchSettings("nothing like this")).toEqual({
      sections: [],
      labels: [],
    });
  });

  it("finds nothing about grouping or problem classes", () => {
    // what is one problem is fixed (REQ-021-01): only the screen title is set
    for (const query of ["same problem", "class", "touch target", "клас"]) {
      expect(matchSettings(query).sections).not.toContain("a11y");
      expect(matchSettings(query, ukrainian).sections).not.toContain("a11y");
    }
    expect(matchSettings("screen title")).toEqual({
      sections: ["a11y"],
      labels: ["Screen title in the UI tree"],
    });
  });

  // the bulk review of a screen's variations was removed (REQ-022-01)
  it("finds no settings for variations in either language", () => {
    for (const query of ["variation", "group", "bulk"]) {
      expect(matchSettings(query).sections).toEqual([]);
    }
    for (const query of ["варіац", "групувати"]) {
      expect(matchSettings(query, ukrainian).sections).toEqual([]);
    }
  });

  it("finds a setting by its Ukrainian or English name", () => {
    expect(matchSettings("завантаження", ukrainian)).toEqual({
      sections: ["mobile"],
      labels: ["Попереджати про завантаження"],
    });
    // the English name still finds it in a Ukrainian interface
    expect(matchSettings("loading", ukrainian).sections).toEqual(["mobile"]);
    expect(matchSettings("odiff", ukrainian).sections).toEqual(["comparison"]);
    expect(
      changedSections(project, { ...project, jiraToken: "" }, ukrainian),
    ).toEqual(["Jira"]);
    expect(
      changedSections(project, { ...project, maxBuildAllowed: 5 }, ukrainian),
    ).toEqual(["Загальне"]);
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
    ).toEqual(["General", "Mobile screenshots"]);
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
