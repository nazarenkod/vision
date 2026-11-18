import {
  changedSections,
  deleteConfirmed,
  loadedSettings,
  matchSettings,
  PlatformField,
  platformOf,
  platformShows,
  sectionIntro,
  withPlatform,
} from "./projectSettings.helper";
import { TEST_PROJECT } from "../_test/test.data.helper";
import { Project } from "../types";
import { DICTIONARIES } from "../i18n/dictionaries";
import { translate } from "../i18n/translate";
import { english } from "../i18n";
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
  it("finds the screen structure section by its former name", () => {
    expect(matchSettings("mobile screens").sections).toEqual(["mobile"]);
    expect(matchSettings("мобільні", ukrainian).sections).toEqual(["mobile"]);
    expect(matchSettings("структура", ukrainian).sections).toEqual(["mobile"]);
    // the former name is for finding only: no field of that name to mark
    expect(matchSettings("mobile screens").labels).toEqual(["Mobile screens"]);
  });

  it("finds settings by section or field name", () => {
    expect(matchSettings("navigation")).toEqual({
      sections: ["mobile"],
      labels: ["Leave out status and navigation bars"],
    });
    expect(matchSettings("JIRA").sections).toEqual(["jira"]);
    expect(matchSettings("tolerance").sections).toEqual(["comparison"]);
    expect(matchSettings("").sections).toHaveLength(9);
    // access is found by its words too; only an admin sees the section (042)
    expect(matchSettings("give access").sections).toEqual(["access"]);
    expect(matchSettings("OS version").sections).toEqual(["devices"]);
    // element rules live on the review screen only (REQ-019-01)
    expect(matchSettings("element rule").sections).toEqual([]);
    expect(matchSettings("nothing like this")).toEqual({
      sections: [],
      labels: [],
    });
  });

  it("finds nothing about grouping, problem classes or the screen title", () => {
    // what is one problem is fixed (REQ-021-01); the screen title is not set here (REQ-026-12)
    for (const query of ["same problem", "class", "клас", "screen title"]) {
      expect(matchSettings(query).sections).not.toContain("a11y");
      expect(matchSettings(query, ukrainian).sections).not.toContain("a11y");
    }
    expect(matchSettings("назва екрана", ukrainian).sections).not.toContain(
      "a11y",
    );
  });

  it("finds the accessibility norms by tap, touch, contrast and accessibility", () => {
    for (const query of ["тап", "контраст", "доступність"]) {
      expect(matchSettings(query, ukrainian).sections).toEqual(["a11y"]);
    }
    for (const query of ["touch", "contrast", "accessibility"]) {
      expect(matchSettings(query).sections).toEqual(["a11y"]);
    }
    expect(matchSettings("тап", ukrainian).labels).toEqual([
      "Мінімальна зона тапу",
    ]);
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

  it("finds only the moves switch, with no distance limit, in either language", () => {
    expect(matchSettings("move").labels).toEqual([
      "Compare moved elements at their new place",
    ]);
    expect(matchSettings("зсунуті", ukrainian).labels).toEqual([
      "Порівнювати зсунуті елементи на новому місці",
    ]);
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
      changedSections(
        project,
        { ...project, jiraIssueType: "Story" },
        ukrainian,
      ),
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
    ).toEqual(["General", "Screen structure"]);
    expect(
      changedSections(project, { ...project, jiraIssueType: "Story" }),
    ).toEqual(["Jira"]);
    // the accessibility norms are the Accessibility section's (REQ-026-17)
    expect(
      changedSections(project, {
        ...project,
        uiTreeSettings: JSON.stringify({
          ...tree,
          a11yNorms: { touchTargetAndroid: 40 },
        }),
      }),
    ).toEqual(["Accessibility"]);
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

const MOBILE_FIELDS: PlatformField[] = [
  "systemBars",
  "touchTargetAndroid",
  "touchTargetIos",
  "notAccessible",
  "devices",
];
const WEB_FIELDS: PlatformField[] = ["touchTargetWeb", "browsers"];

describe("project platform", () => {
  it("reads a project saved before platforms as mobile", () => {
    expect(platformOf(project.uiTreeSettings)).toBe("mobile");
    expect(platformOf(null)).toBe("mobile");
    expect(platformOf("not json")).toBe("mobile");
    expect(platformOf(JSON.stringify({ platform: "tv" }))).toBe("mobile");
    expect(platformOf(JSON.stringify({ platform: "web" }))).toBe("web");
  });

  it("hides system bars, Android and iOS norms and VoiceOver in a web project", () => {
    for (const field of MOBILE_FIELDS) {
      expect(platformShows("web", field)).toBe(false);
    }
    for (const field of WEB_FIELDS) {
      expect(platformShows("web", field)).toBe(true);
    }
  });

  it("hides the web norm in a mobile project", () => {
    for (const field of WEB_FIELDS) {
      expect(platformShows("mobile", field)).toBe(false);
    }
    for (const field of MOBILE_FIELDS) {
      expect(platformShows("mobile", field)).toBe(true);
    }
  });

  it("shows fields of both platforms for a mobile and web project", () => {
    for (const field of [...MOBILE_FIELDS, ...WEB_FIELDS]) {
      expect(platformShows("both", field)).toBe(true);
    }
    expect(matchSettings("navigation", english, "both").sections).toEqual([
      "mobile",
    ]);
    expect(matchSettings("window size", english, "both").sections).toEqual([
      "devices",
    ]);
    expect(matchSettings("OS version", english, "both").sections).toEqual([
      "devices",
    ]);
  });

  it("keeps hidden values when the platform changes", () => {
    const mobile = JSON.stringify({
      excludeSystemBars: false,
      a11yNorms: { touchTargetAndroid: 40, disabledRules: ["not-accessible"] },
      allowedDevices: [{ device: "Pixel 7", os: "Android 15" }],
    });
    const web = withPlatform(mobile, "web");
    expect(platformOf(web)).toBe("web");
    const back = withPlatform(web, "mobile");
    expect(JSON.parse(back)).toEqual({
      ...JSON.parse(mobile),
      platform: "mobile",
    });
    // the platform is a General setting, nothing else looks changed
    const saved = { ...project, uiTreeSettings: mobile } as Project;
    expect(changedSections(saved, { ...saved, uiTreeSettings: web })).toEqual([
      "General",
    ]);
  });

  it("does not find fields the platform hides", () => {
    const nothing = { sections: [], labels: [] };
    expect(matchSettings("navigation", english, "web")).toEqual(nothing);
    expect(matchSettings("VoiceOver", english, "web")).toEqual(nothing);
    expect(matchSettings("android", english, "web")).toEqual(nothing);
    expect(matchSettings("OS version", english, "web")).toEqual(nothing);
    expect(matchSettings("VoiceOver", ukrainian, "web")).toEqual(nothing);
    expect(matchSettings("window size", english, "mobile")).toEqual(nothing);
    expect(matchSettings("browser", english, "mobile")).toEqual(nothing);
    // shown, they are found
    expect(matchSettings("VoiceOver", english, "mobile").sections).toEqual([
      "a11y",
    ]);
    expect(matchSettings("window size", english, "web")).toEqual({
      sections: ["devices"],
      labels: ["Window size"],
    });
    expect(matchSettings("розмір вікна", ukrainian, "web").sections).toEqual([
      "devices",
    ]);
  });

  it("names Selenide and Playwright as tree sources for a web project", () => {
    for (const text of [english, ukrainian]) {
      const intro = sectionIntro("mobile", "web", text) ?? "";
      expect(intro).toContain("Selenide");
      expect(intro).toContain("Playwright");
      expect(intro).not.toContain("Appium");
    }
    expect(sectionIntro("mobile", "mobile")).toContain(
      "Appium on Android and iOS",
    );
    expect(sectionIntro("mobile", "mobile")).not.toMatch(/web/i);
  });

  it("names Appium and the web as tree sources for a mobile and web project", () => {
    expect(sectionIntro("mobile", "both")).toBe(
      "Applies to checks sent with a UI tree: from Appium (Android, iOS) and from the web (Selenide, Playwright).",
    );
    expect(sectionIntro("mobile", "both", ukrainian)).toBe(
      "Для перевірок, надісланих з UI-деревом: з Appium (Android, iOS) і з вебу (Selenide, Playwright).",
    );
  });
});
