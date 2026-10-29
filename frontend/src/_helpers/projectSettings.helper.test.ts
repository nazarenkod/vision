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
    expect(matchSettings("navigation")).toEqual({
      sections: ["mobile"],
      labels: ["Leave out status and navigation bars"],
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

  it("finds a setting by its Ukrainian or English name", () => {
    expect(matchSettings("панель навігації", ukrainian)).toEqual({
      sections: ["mobile"],
      labels: ["Не враховувати рядок стану й панель навігації"],
    });
    // the English name still finds it in a Ukrainian interface
    expect(matchSettings("navigation", ukrainian).sections).toEqual(["mobile"]);
    expect(matchSettings("odiff", ukrainian).sections).toEqual(["comparison"]);
    expect(
      changedSections(project, { ...project, jiraToken: "" }, ukrainian),
    ).toEqual(["Jira"]);
    expect(
      changedSections(project, { ...project, maxBuildAllowed: 5 }, ukrainian),
    ).toEqual(["Загальне"]);
  });

  it("finds no reference device and no warning switches", () => {
    const nothing = { sections: [], labels: [] };
    for (const query of ["reference", "warn", "loading", "wrong screen"]) {
      expect(matchSettings(query)).toEqual(nothing);
    }
    for (const query of ["еталонний", "попереджати", "завантаження"]) {
      expect(matchSettings(query, ukrainian)).toEqual(nothing);
    }
    // what an older page saved for them is no unsaved change of any section
    const tree = JSON.parse(project.uiTreeSettings as string);
    expect(
      changedSections(project, {
        ...project,
        uiTreeSettings: JSON.stringify({
          ...tree,
          detectLoading: false,
          detectScreenMismatch: false,
          referenceDevice: { os: "Android 15", device: "Pixel 7" },
        }),
      }),
    ).toEqual([]);
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
