import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import { TEST_PROJECT, TEST_USER } from "~client/_test/test.data.helper";
import { ImageComparison } from "~client/types/imageComparison";
import {
  API_URL,
  inUkrainian,
  mockGetDevices,
  mockGetJiraTypes,
  mockGetProjects,
  mockGetUsers,
  mockSaveProject,
} from "utils/mocks";

const project = {
  ...TEST_PROJECT,
  jiraUrl: "https://jira.example.com",
  uiTreeSettings: JSON.stringify({
    excludeSystemBars: true,
    compensateMoves: false,
    detectLoading: true,
    elementRules: [{ id: "clock", selector: "id:clock", action: "ignore" }],
    a11yClasses: [
      {
        id: "tabs",
        name: "Tabs",
        when: { element: ["*tab_*"] },
        groupBy: "class",
      },
      {
        id: "maps",
        name: "Map controls",
        when: { className: ["*MapView"] },
        action: "ignore",
      },
    ],
  }),
};

const JIRA_TYPES = {
  issueTypes: [
    { name: "Bug", subtask: false },
    { name: "Defect", subtask: false },
    { name: "Sub-bug", subtask: true },
  ],
  linkTypes: ["Blocks", "Relates"],
};

const open = async (page: Page, overrides: object = {}) => {
  await mockGetProjects(page, [{ ...project, ...overrides }]);
  await page.goto(`/projects/${project.id}/settings`);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
};

const putRequest = (page: Page) =>
  page.waitForRequest(
    (request) =>
      request.url() === `${API_URL}/projects` && request.method() === "PUT",
  );

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [project]);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test("renders in Ukrainian", async ({ page, authUser }) => {
  await inUkrainian(page);
  await page.goto(`/projects/${project.id}/settings`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Налаштування",
  );

  await expect(page).toHaveScreenshot("project-settings-page-uk.png");
});

test("opens the settings page from the pencil and by its address", async ({
  projectListPage,
  page,
}) => {
  await projectListPage.editBtn.click();
  await expect(page).toHaveURL(`/projects/${project.id}/settings`);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.locator("#name")).toHaveValue(project.name);

  // the address can be shared and opened straight away
  await page.goto("/projects");
  await page.goto(`/projects/${project.id}/settings`);
  await expect(page.locator("#name")).toHaveValue(project.name);
});

test("scrolls inside the page, under a header and rail that stay", async ({
  projectListPage,
  page,
}) => {
  // the project list is too short to scroll: the tour library used to mark
  // the page area unscrollable there, and the settings then moved the window
  await page.setViewportSize({ width: 1280, height: 600 });
  await projectListPage.editBtn.click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.mouse.move(800, 400);
  await page.mouse.wheel(0, 1200);
  const main = page.locator("main");
  await expect
    .poll(() => main.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeInViewport();
});

test("lists the sections and highlights the one in view", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  const titles = [
    "General",
    "Review",
    "Image comparison",
    "Screen structure",
    "Accessibility",
    "Jira",
    "Danger zone",
  ];
  for (const title of titles) {
    await expect(
      page
        .getByRole("navigation", { name: "Settings sections" })
        .getByText(title, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByTestId("nav-general")).toHaveAttribute(
    "aria-current",
    "true",
  );

  await page.getByTestId("nav-jira").click();
  await expect(page.getByTestId("nav-jira")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByTestId("section-jira")).toBeInViewport();

  // scrolling by hand lights the section being read, the short last one too;
  // first the smooth scroll to Jira has to come to rest
  const scrollTop = () => page.locator("main").evaluate((el) => el.scrollTop);
  await expect
    .poll(async () => {
      const before = await scrollTop();
      await page.waitForTimeout(150);
      return (await scrollTop()) === before;
    })
    .toBe(true);
  const main = await page.locator("main").boundingBox();
  if (!main) throw new Error("no main");
  await page.mouse.move(main.x + main.width / 2, main.y + main.height / 2);
  await page.mouse.wheel(0, -10000);
  await expect(page.getByTestId("nav-general")).toHaveAttribute(
    "aria-current",
    "true",
  );
  const a11yTop = await page
    .getByTestId("section-a11y")
    .evaluate((el) => el.getBoundingClientRect().top);
  await page.mouse.wheel(0, a11yTop - 150);
  await expect(page.getByTestId("nav-a11y")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.mouse.wheel(0, 10000);
  await expect(page.getByTestId("nav-danger")).toHaveAttribute(
    "aria-current",
    "true",
  );

  // search keeps the matching section and marks the setting
  await page.getByTestId("settingsSearch").fill("navigation");
  await expect(page.getByTestId("section-mobile")).toBeVisible();
  await expect(page.getByTestId("section-general")).toBeHidden();
  await expect(
    page
      .locator(".v-hit")
      .filter({ hasText: "Leave out status and navigation bars" }),
  ).toHaveCount(1);
  await page.getByTestId("settingsSearch").fill("no such setting");
  await expect(page.getByText("Nothing matches")).toBeVisible();
});

test("saves every field the old dialog had", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSaveProject(page);
  await mockGetJiraTypes(page, project.id, JIRA_TYPES);
  await open(page);
  await page.locator("#name").fill("Mobile Shop");
  await page.locator("#branchName").fill("develop");
  await page.locator("#buildCount").fill("40");
  await page.locator("#maxBranchLifetime").fill("14");
  await page.getByLabel("Auto-approve in feature branches").uncheck();
  await page.getByTestId(`engine-${ImageComparison.odiff}`).click();
  await page.getByLabel("Send hidden changes to review").uncheck();
  await page.getByTestId("jiraIssueType-select").click();
  await page.getByRole("option", { name: "Defect" }).click();

  // the save bar names what changed
  await expect(page.getByTestId("saveBar")).toContainText(
    "General, Review, Image comparison, Screen structure, Jira",
  );
  const [request] = await Promise.all([
    putRequest(page),
    page.getByTestId("saveSettings").click(),
  ]);
  const body = request.postDataJSON();
  expect(body).toMatchObject({
    id: project.id,
    name: "Mobile Shop",
    mainBranchName: "develop",
    maxBuildAllowed: 40,
    maxBranchLifetime: 14,
    autoApproveFeature: false,
    imageComparison: ImageComparison.odiff,
    jiraIssueType: "Defect",
    jiraUrl: project.jiraUrl,
  });
  expect(JSON.parse(body.uiTreeSettings)).toMatchObject({
    excludeSystemBars: true,
    detectSemanticChanges: false,
  });
  // no shared token or email: Jira goes with each person's own (035)
  expect(body).not.toHaveProperty("jiraToken");
  expect(body).not.toHaveProperty("jiraEmail");
  await expect(page.getByTestId("saveBar")).toHaveAttribute(
    "data-state",
    "saved",
  );
});

test("shows only the chosen engine's settings", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  const engines = page.getByTestId("engineCards");
  await expect(engines.getByRole("radio")).toHaveCount(4);
  await expect(
    page.getByTestId(`engine-${ImageComparison.pixelmatch}`),
  ).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Allow diff dimensions")).toBeVisible();

  await page.getByTestId(`engine-${ImageComparison.odiff}`).click();
  await expect(
    page.getByTestId(`engine-${ImageComparison.odiff}`),
  ).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Fail if the size differs")).toBeVisible();
  await expect(page.getByLabel("Allow diff dimensions")).toHaveCount(0);
});

test("shows a dependent field only when its switch is on", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  const maxMove = page.getByLabel("Only moves up to, dp (empty for any)");
  await expect(maxMove).toHaveCount(0);
  await page.getByLabel("Compare moved elements at their new place").check();
  await expect(maxMove).toBeVisible();
});

test("names the UI tree section Screen structure", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  const section = page.getByTestId("section-mobile");
  await expect(
    section.getByRole("heading", { name: "Screen structure" }),
  ).toBeVisible();
  await expect(page.getByTestId("nav-mobile")).toHaveText("Screen structure");
  // where trees come from today, and no promise of the web yet (REQ-049-12)
  await expect(section).toContainText("Appium on Android and iOS");
  await expect(section).not.toContainText(/web/i);
  await page.getByTestId("settingsSearch").fill("mobile screens");
  await expect(section).toBeVisible();
  await expect(page.getByTestId("section-general")).toBeHidden();
});

test("explains the compare and ignore options with an animation", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  // pixelmatch: sizes and anti-aliasing; screen structure: moves; nothing else
  await expect(page.locator("[data-testid^=explain-]")).toHaveCount(3);
  const moves = page.getByTestId("explain-moves");
  await expect(moves).toHaveAccessibleName("What this option does");
  const switchOf = page.locator("input[name=compensateMoves]");
  const before = await switchOf.isChecked();

  await moves.click();
  const hint = page.getByTestId("explainer-moves");
  await expect(hint.getByRole("img")).toHaveCount(4);
  // the project has the option off: that outcome is marked as now
  await expect(hint.getByTestId("explainerResult-off")).toContainText(
    "now in this project",
  );
  await expect(hint).toContainText(
    "A banner came in on top and pushed the list down.",
  );
  // the "?" explains; it does not flip the option
  expect(await switchOf.isChecked()).toBe(before);
  await page.keyboard.press("Escape");
  await expect(hint).toBeHidden();

  await page.getByTestId(`engine-${ImageComparison.lookSame}`).click();
  await expect(page.getByTestId("explain-caret")).toBeVisible();
  await page.getByTestId("explain-caret").click();
  await expect(page.getByTestId("explainer-caret")).toContainText(
    "The text caret was in the field on the baseline",
  );
});

test("has no element rules section", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  // rules are added on the review screen, where the element is picked (019)
  await expect(page.getByTestId("section-rules")).toHaveCount(0);
  await expect(page.getByTestId("nav-rules")).toHaveCount(0);
  await expect(page.getByText("Element rules")).toHaveCount(0);
  await page.getByTestId("settingsSearch").fill("element rule");
  await expect(page.getByText("Nothing matches")).toBeVisible();
});

test("has no settings for variations in the review section", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  // a project saved with them on still has the columns (022)
  await open(page, { bulkApproveVariations: true, bulkApproveGroupBy: "os" });
  const review = page.getByTestId("section-review");
  await expect(
    review.getByLabel("Auto-approve in feature branches"),
  ).toBeVisible();
  await expect(review.getByText(/variations/i)).toHaveCount(0);
  await page.getByTestId("settingsSearch").fill("variation");
  await expect(page.getByText("Nothing matches")).toBeVisible();
});

test("keeps the project's element rules when saving", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSaveProject(page);
  await open(page);
  await page.getByLabel("Send hidden changes to review").uncheck();
  const [request] = await Promise.all([
    putRequest(page),
    page.getByTestId("saveSettings").click(),
  ]);
  expect(JSON.parse(request.postDataJSON().uiTreeSettings)).toMatchObject({
    detectSemanticChanges: false,
    elementRules: [{ id: "clock", selector: "id:clock", action: "ignore" }],
  });
});

test("has no reference device and no warning switches", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  // spec 020: they changed nothing a reviewer decides on
  const mobile = page.getByTestId("section-mobile");
  await expect(
    mobile.getByText("Leave out status and navigation bars"),
  ).toBeVisible();
  for (const label of [
    "Warn about loading states",
    "Warn about wrong screens",
    "Reference device",
  ]) {
    await expect(page.getByText(label)).toHaveCount(0);
  }
  for (const query of ["reference", "warn"]) {
    await page.getByTestId("settingsSearch").fill(query);
    await expect(page.getByText("Nothing matches")).toBeVisible();
  }
});

test("keeps settings it no longer shows when saving", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  const reference = {
    os: "Android 15",
    device: "Pixel 7 emulator",
    browser: "",
    viewport: "",
  };
  await mockSaveProject(page);
  await open(page, {
    uiTreeSettings: JSON.stringify({
      ...JSON.parse(project.uiTreeSettings),
      detectLoading: false,
      detectScreenMismatch: false,
      referenceDevice: reference,
    }),
  });
  await page.getByLabel("Send hidden changes to review").uncheck();
  await expect(page.getByTestId("saveBar")).toContainText("Screen structure");
  const [request] = await Promise.all([
    putRequest(page),
    page.getByTestId("saveSettings").click(),
  ]);
  expect(JSON.parse(request.postDataJSON().uiTreeSettings)).toMatchObject({
    detectSemanticChanges: false,
    detectLoading: false,
    detectScreenMismatch: false,
    referenceDevice: reference,
  });
  await expect(page.getByTestId("saveBar")).toHaveAttribute(
    "data-state",
    "saved",
  );
});

test("shows only the rules under Accessibility", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  // the project saved problem classes before grouping was fixed (021)
  await open(page);
  const section = page.getByTestId("a11yRules");
  await expect(section.getByRole("checkbox")).toHaveCount(7);
  // norms only for the tap area and contrast: two fields each
  await expect(section.getByRole("textbox")).toHaveCount(4);
  await expect(page.locator("#screenTitleSelectors")).toHaveCount(0);
  await expect(page.getByText("Screen title")).toHaveCount(0);
  await expect(page.getByText("Problem classes")).toHaveCount(0);
  await expect(section.getByText("a11y-")).toHaveCount(0);
  await page.getByTestId("settingsSearch").fill("class");
  await expect(page.getByTestId("section-a11y")).toBeHidden();
});

test("sets the project's touch target and turns a rule off", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSaveProject(page);
  await open(page);
  const android = page.locator("#norm-touchTargetAndroid");
  await expect(android).toHaveValue("48");
  await expect(page.getByTestId("reset-touchTargetAndroid")).toHaveCount(0);

  await android.fill("40");
  await expect(page.getByText("Default 48")).toBeVisible();
  await expect(page.getByTestId("reset-touchTargetAndroid")).toBeVisible();
  await page
    .getByTestId("a11yRule-redundant-role")
    .getByRole("checkbox")
    .uncheck();
  // a change here brings the save bar up and marks this section, and no
  // other, in the rail (REQ-026-17)
  await expect(page.getByTestId("saveBar")).toHaveAttribute(
    "data-state",
    "dirty",
  );
  await expect(
    page.getByTestId("nav-a11y").getByLabel("unsaved changes"),
  ).toBeVisible();
  await expect(
    page.getByTestId("nav-mobile").getByLabel("unsaved changes"),
  ).toHaveCount(0);
  // the rail names the sections only, no counts beside them (REQ-026-16)
  await expect(page.getByTestId("nav-a11y")).toHaveText("Accessibility");

  const [request] = await Promise.all([
    putRequest(page),
    page.getByTestId("saveSettings").click(),
  ]);
  expect(
    JSON.parse(request.postDataJSON().uiTreeSettings).a11yNorms,
  ).toMatchObject({
    touchTargetAndroid: 40,
    touchTargetIos: 44,
    disabledRules: ["redundant-role"],
  });

  await page.getByTestId("reset-touchTargetAndroid").click();
  await expect(android).toHaveValue("48");
});

test("does not save a norm out of range", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSaveProject(page);
  await open(page);
  await page.locator("#norm-touchTargetAndroid").fill("100");
  await expect(page.getByText("A whole number from 24 to 96")).toBeVisible();
  await page.locator("#norm-contrast").fill("8");
  await expect(page.getByText("From 1.5 to 7, one decimal")).toBeVisible();
  await page.locator("#norm-touchTargetIos").fill("40");

  const [request] = await Promise.all([
    putRequest(page),
    page.getByTestId("saveSettings").click(),
  ]);
  expect(
    JSON.parse(request.postDataJSON().uiTreeSettings).a11yNorms,
  ).toMatchObject({
    touchTargetAndroid: 48,
    touchTargetIos: 40,
    contrast: 4.5,
  });
});

const savedDevices = async (page: Page) => {
  const [request] = await Promise.all([
    putRequest(page),
    page.getByTestId("saveSettings").click(),
  ]);
  return JSON.parse(request.postDataJSON().uiTreeSettings).allowedDevices;
};

test("adds, edits and removes an allowed device", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSaveProject(page);
  await mockGetDevices(page, project.id, []);
  await open(page);
  const section = page.getByTestId("allowedDevices");
  await expect(section).toContainText(
    "No list: screens from any device come in.",
  );

  await page.getByTestId("newDevice-device").fill("Pixel 7");
  await page.getByTestId("newDevice-os").fill("Android 15");
  await page.getByTestId("addDevice").click();
  await page.getByTestId("newDevice-device").fill("iPhone 17");
  await page.getByTestId("newDevice-os").fill("26*");
  // a * anywhere but a trailing .* is not taken (REQ-029-15)
  await expect(section).toContainText(
    "* only at the end of the OS, as in 26.*",
  );
  await expect(page.getByTestId("addDevice")).toBeDisabled();
  await page.getByTestId("newDevice-os").fill("26.*");
  await page.getByTestId("addDevice").click();
  await expect(
    page.getByTestId("nav-devices").getByLabel("unsaved changes"),
  ).toBeVisible();
  expect(await savedDevices(page)).toEqual([
    { device: "Pixel 7", os: "Android 15" },
    { device: "iPhone 17", os: "26.*" },
  ]);

  await page.getByTestId("allowedDevice-0-os").fill("Android 16");
  await page.getByTestId("allowedDevice-1-remove").click();
  expect(await savedDevices(page)).toEqual([
    { device: "Pixel 7", os: "Android 16" },
  ]);
});

test("marks received devices outside the list and adds one in a click", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSaveProject(page);
  await mockGetDevices(page, project.id, [
    { device: "Pixel 7 emulator", os: "Android 15" },
    { device: "iPhone 17", os: "26.2" },
  ]);
  await open(page, {
    uiTreeSettings: JSON.stringify({
      allowedDevices: [{ device: "iPhone 17", os: "26.*" }],
    }),
  });
  const pixel = page.getByTestId(
    "receivedDevice-Pixel 7 emulator / Android 15",
  );
  const iphone = page.getByTestId("receivedDevice-iPhone 17 / 26.2");
  await expect(iphone).toContainText("allowed");
  await expect(iphone.getByRole("button", { name: "Add" })).toHaveCount(0);
  // the device as grey tags, and "allowed" as text beside them, not one more grey chip
  await expect(iphone.getByTestId("deviceTag")).toHaveText([
    "iPhone 17",
    "26.2",
  ]);
  await expect(
    iphone.locator(".MuiChip-root", { hasText: "allowed" }),
  ).toHaveCount(0);
  await expect(pixel).toContainText("not in the list");

  await pixel.getByRole("button", { name: "Add" }).click();
  await expect(pixel).toContainText("allowed");
  expect(await savedDevices(page)).toEqual([
    { device: "iPhone 17", os: "26.*" },
    { device: "Pixel 7 emulator", os: "Android 15" },
  ]);
});

test("keeps the screen title selectors the project saved", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSaveProject(page);
  await open(page, {
    uiTreeSettings: JSON.stringify({
      ...JSON.parse(project.uiTreeSettings),
      screenTitle: ["id:toolbar_title"],
    }),
  });
  await page.locator("#norm-touchTargetAndroid").fill("40");

  const [request] = await Promise.all([
    putRequest(page),
    page.getByTestId("saveSettings").click(),
  ]);
  // what is no longer on the page is kept as it was
  expect(JSON.parse(request.postDataJSON().uiTreeSettings)).toMatchObject({
    screenTitle: ["id:toolbar_title"],
    a11yClasses: [{ id: "tabs" }, { id: "maps" }],
  });
});

test("asks before leaving with unsaved changes", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  await page.locator("#name").fill("Changed");
  await page.getByRole("link", { name: "Projects" }).first().click();

  const ask = page.getByTestId("leaveSettings");
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Stay" }).click();
  await expect(page).toHaveURL(`/projects/${project.id}/settings`);
  await expect(page.locator("#name")).toHaveValue("Changed");

  // Discard puts everything back and lets one go freely
  await page.getByTestId("discardSettings").click();
  await expect(page.locator("#name")).toHaveValue(project.name);
  await page.getByRole("link", { name: "Projects" }).first().click();
  await expect(page).toHaveURL("/projects");
});

test("shows saved secrets as Saved and never their value", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSaveProject(page);
  await open(page, {
    imageComparison: ImageComparison.vlm,
    imageComparisonConfig: JSON.stringify({
      provider: "gemini",
      model: "gemini-2.5-flash",
      prompt: "Is the difference a real change a user would notice?",
      temperature: 0.2,
      useThinking: false,
    }),
    geminiApiKeySet: true,
  });
  await expect(page.getByTestId("apiKeySaved")).toContainText("Saved");
  await expect(page.locator("#apiKey")).toHaveCount(0);

  // Remove empties it on save
  await page
    .getByTestId("apiKeySaved")
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByText("Removed on save")).toBeVisible();

  const [request] = await Promise.all([
    putRequest(page),
    page.getByTestId("saveSettings").click(),
  ]);
  expect(JSON.parse(request.postDataJSON().imageComparisonConfig).apiKey).toBe(
    "",
  );
});

test("picks the Jira issue and link type from the person's Jira", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSaveProject(page);
  await mockGetJiraTypes(page, project.id, JIRA_TYPES);
  await open(page);
  // the address stays a field; the types are lists (REQ-049-07)
  await expect(page.locator("input#jiraUrl")).toHaveValue(project.jiraUrl);
  await page.getByTestId("jiraIssueType-select").click();
  // sub-tasks under a heading of their own (REQ-049-08)
  await expect(page.getByRole("listbox").locator("li")).toHaveText([
    "Automatic",
    "Issue types",
    "Bug",
    "Defect",
    "Sub-tasks",
    "Sub-bug",
  ]);
  await page.getByRole("option", { name: "Defect" }).click();
  await page.getByTestId("jiraLinkType-select").click();
  await page.getByRole("option", { name: "Blocks" }).click();

  const [request] = await Promise.all([
    putRequest(page),
    page.getByTestId("saveSettings").click(),
  ]);
  expect(request.postDataJSON()).toMatchObject({
    jiraIssueType: "Defect",
    jiraLinkType: "Blocks",
  });
});

test("reloads the Jira types for a new address before saving", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  const asked: string[] = [];
  await mockGetJiraTypes(page, project.id, (url) => {
    asked.push(url);
    return url.includes("other")
      ? {
          issueTypes: [{ name: "Task", subtask: false }],
          linkTypes: ["Relates"],
        }
      : JIRA_TYPES;
  });
  await open(page);
  await expect.poll(() => asked).toEqual([project.jiraUrl]);
  await page.locator("input#jiraUrl").fill("https://other.example.com");
  await page.locator("input#jiraUrl").blur();
  await expect
    .poll(() => asked)
    .toEqual([project.jiraUrl, "https://other.example.com"]);
  await page.getByTestId("jiraIssueType-select").click();
  await expect(page.getByRole("option")).toHaveText(["Automatic", "Task"]);
});

test("asks for a Jira token in the profile when the person has none", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockGetJiraTypes(page, project.id, { problem: "noToken" });
  await open(page, { jiraIssueType: "Defect" });
  await expect(page.getByTestId("jiraTypesNoToken")).toContainText(
    "Add your Jira token in your profile",
  );
  await expect(
    page
      .getByTestId("jiraTypesNoToken")
      .getByRole("link", { name: "Open profile" }),
  ).toHaveAttribute("href", "/profile");
  await expect(page.locator("input#jiraIssueType")).toHaveValue("Defect");
  await expect(page.locator("input#jiraIssueType")).toBeDisabled();
  await expect(page.locator("input#jiraLinkType")).toHaveValue("Automatic");
});

test("keeps the saved Jira types and offers a retry when Jira fails", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  let calls = 0;
  await mockGetJiraTypes(page, project.id, () =>
    ++calls === 1 ? { problem: "failed" } : JIRA_TYPES,
  );
  await open(page, { jiraIssueType: "Defect" });
  await expect(page.getByTestId("jiraTypesFailed")).toContainText(
    "Could not load the types from Jira.",
  );
  await expect(page.locator("input#jiraIssueType")).toHaveValue("Defect");
  await page.getByTestId("jiraTypesRetry").click();
  await expect(page.getByTestId("jiraTypesFailed")).toHaveCount(0);
  await expect(page.getByTestId("jiraIssueType-select")).toHaveText("Defect");
});

test("Jira settings have no shared token or email", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  await expect(page.locator("#jiraUrl")).toHaveValue(project.jiraUrl);
  await expect(page.locator("#jiraIssueType")).toBeVisible();
  await expect(page.locator("#jiraLinkType")).toBeVisible();
  await expect(page.locator("#jiraToken")).toHaveCount(0);
  await expect(page.locator("#jiraEmail")).toHaveCount(0);
  await expect(page.getByTestId("jiraTokenSaved")).toHaveCount(0);
});

test("warns when someone saved after the page was opened", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  const bodies: Array<Record<string, unknown>> = [];
  await page.route(`${API_URL}/projects`, (route, request) => {
    if (request.method() !== "PUT") return route.fallback();
    const body = request.postDataJSON();
    bodies.push(body);
    return body.force
      ? route.fulfill({ body: JSON.stringify(body) })
      : route.fulfill({
          status: 409,
          body: JSON.stringify({
            message:
              "Someone changed these settings after you opened the page.",
            fields: ["maxBuildAllowed"],
          }),
        });
  });
  await page.locator("#buildCount").fill("40");
  await page.getByTestId("saveSettings").click();

  const conflict = page.getByTestId("settingsConflict");
  await expect(conflict).toContainText("maxBuildAllowed");
  await conflict.getByTestId("saveOver").click();
  await expect(page.getByTestId("saveBar")).toHaveAttribute(
    "data-state",
    "saved",
  );
  expect(bodies.map((body) => body.force)).toEqual([false, true]);
});

test("deletes the project only after its exact name", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await page.route(`${API_URL}/projects/${project.id}`, (route) =>
    route.fulfill({ body: JSON.stringify(project) }),
  );
  await open(page);
  await page.getByTestId("deleteProject").click();
  const forever = page.getByTestId("deleteForever");
  await expect(forever).toBeDisabled();
  await page.getByTestId("deleteConfirmName").fill(project.name);
  await forever.click();
  await expect(page).toHaveURL("/projects");
});

test("lets an admin give and take access to the project", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  const anna = {
    ...TEST_USER,
    id: "anna",
    email: "anna@bank.test",
    firstName: "Anna",
    lastName: "Koval",
    role: "editor" as const,
  };
  const ivan = {
    ...TEST_USER,
    id: "ivan",
    email: "ivan@bank.test",
    firstName: "Ivan",
    lastName: "Lis",
    role: "guest" as const,
  };
  const member = (user: typeof anna | typeof ivan) => ({
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    createdAt: "2026-11-05T10:00:00.000Z",
  });
  let members = [member(anna)];
  await mockGetUsers(page, [TEST_USER, anna, ivan]);
  await page.route(`${API_URL}/projects/${project.id}/access`, (route) =>
    route.fulfill({ body: JSON.stringify(members) }),
  );
  await page.route(`${API_URL}/projects/${project.id}/access/*`, (route) => {
    const userId = route.request().url().split("/").pop();
    members =
      route.request().method() === "PUT"
        ? [...members, member(ivan)]
        : members.filter((one) => one.userId !== userId);
    return route.fulfill({ body: JSON.stringify(members) });
  });
  await open(page);

  const list = page.getByTestId("projectAccess");
  await expect(page.getByTestId("nav-access")).toBeVisible();
  await expect(list).toContainText("anna@bank.test");

  // admins are not offered: they reach every project; nor is who has access already
  await page.getByTestId("accessPick").click();
  await expect(page.getByRole("option")).toHaveText([/ivan@bank\.test/]);
  await page.getByRole("option", { name: /ivan@bank\.test/ }).click();
  const [given] = await Promise.all([
    page.waitForRequest(
      (request) =>
        request.method() === "PUT" && request.url().includes("/access/"),
    ),
    page.getByTestId("accessAdd").click(),
  ]);
  expect(given.url()).toBe(`${API_URL}/projects/${project.id}/access/ivan`);
  await expect(list).toContainText("ivan@bank.test");

  const [taken] = await Promise.all([
    page.waitForRequest((request) => request.method() === "DELETE"),
    page
      .getByRole("button", { name: "Take access away from Anna Koval" })
      .click(),
  ]);
  expect(taken.url()).toBe(`${API_URL}/projects/${project.id}/access/anna`);
  await expect(list).not.toContainText("anna@bank.test");
});

test.describe("as an editor", () => {
  test.use({ userRole: "editor" });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test("shows no access section", async ({ page, authUser }) => {
    await open(page);
    await expect(page.getByTestId("nav-access")).toHaveCount(0);
    await expect(page.getByTestId("projectAccess")).toHaveCount(0);
  });
});
