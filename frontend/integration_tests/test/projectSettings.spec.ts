import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import { TEST_PROJECT } from "~client/_test/test.data.helper";
import { ImageComparison } from "~client/types/imageComparison";
import {
  API_URL,
  inUkrainian,
  mockGetDevices,
  mockGetProjects,
  mockSaveProject,
} from "utils/mocks";

const project = {
  ...TEST_PROJECT,
  jiraUrl: "https://jira.example.com",
  jiraTokenSet: true,
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
    "Mobile screenshots",
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
  await open(page);
  await page.locator("#name").fill("Mobile Shop");
  await page.locator("#branchName").fill("develop");
  await page.locator("#buildCount").fill("40");
  await page.locator("#maxBranchLifetime").fill("14");
  await page.getByLabel("Auto approve feature").uncheck();
  await page.getByTestId(`engine-${ImageComparison.odiff}`).click();
  await page.getByLabel("Send hidden changes to review").uncheck();
  await page.locator("#jiraIssueType").fill("Defect");

  // the save bar names what changed
  await expect(page.getByTestId("saveBar")).toContainText(
    "General, Review, Image comparison, Mobile screenshots, Jira",
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
  // the saved token stays as it is: not sent at all
  expect(body).not.toHaveProperty("jiraToken");
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
  await expect(page.getByLabel("Fail on layout diff")).toBeVisible();
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
  await expect(review.getByLabel("Auto approve feature")).toBeVisible();
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
  await expect(page.getByTestId("saveBar")).toContainText("Mobile screenshots");
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
  // the rail counts the rules on (REQ-026-16)
  await expect(page.getByTestId("nav-a11y")).toContainText("6 of 7 on");

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
    "No list: snapshots from any device come in.",
  );
  await expect(page.getByTestId("nav-devices")).toContainText("any device");

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
  await expect(page.getByTestId("nav-devices")).toContainText("2 allowed");
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
  await expect(page.getByTestId("jiraTokenSaved")).toContainText("Saved");
  await expect(page.locator("#jiraToken")).toHaveCount(0);
  await expect(page.getByTestId("apiKeySaved")).toContainText("Saved");
  await expect(page.locator("#apiKey")).toHaveCount(0);

  // Replace opens an empty field; Remove empties it on save
  await page
    .getByTestId("jiraTokenSaved")
    .getByRole("button", { name: "Replace" })
    .click();
  await expect(page.locator("#jiraToken")).toHaveValue("");
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
