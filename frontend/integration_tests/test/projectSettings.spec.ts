import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import { TEST_PROJECT } from "~client/_test/test.data.helper";
import { ImageComparison } from "~client/types/imageComparison";
import { API_URL, mockGetProjects, mockSaveProject } from "utils/mocks";

const project = {
  ...TEST_PROJECT,
  bulkApproveVariations: false,
  bulkApproveGroupBy: "customTags",
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
    "Accessibility problems",
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

  // search keeps the matching section and marks the setting
  await page.getByTestId("settingsSearch").fill("loading");
  await expect(page.getByTestId("section-mobile")).toBeVisible();
  await expect(page.getByTestId("section-general")).toBeHidden();
  await expect(
    page.locator(".v-hit").filter({ hasText: "Warn about loading states" }),
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
  await page.getByLabel("Bulk approve/reject variations").check();
  await page.getByTestId(`engine-${ImageComparison.odiff}`).click();
  await page.getByLabel("Warn about loading states").uncheck();
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
    bulkApproveVariations: true,
    bulkApproveGroupBy: "customTags",
    imageComparison: ImageComparison.odiff,
    jiraIssueType: "Defect",
    jiraUrl: project.jiraUrl,
  });
  expect(JSON.parse(body.uiTreeSettings)).toMatchObject({
    excludeSystemBars: true,
    detectLoading: false,
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

  // the grouping axis drives the test list too, so it is always there
  await expect(page.getByLabel("Group variations by")).toBeVisible();
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

test("keeps the project's element rules when saving", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSaveProject(page);
  await open(page);
  await page.getByLabel("Warn about loading states").uncheck();
  const [request] = await Promise.all([
    putRequest(page),
    page.getByTestId("saveSettings").click(),
  ]);
  expect(JSON.parse(request.postDataJSON().uiTreeSettings)).toMatchObject({
    detectLoading: false,
    elementRules: [{ id: "clock", selector: "id:clock", action: "ignore" }],
  });
});

test("numbers problem classes and moves one up", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await open(page);
  const classes = page.getByTestId("a11yProblemClass");
  await expect(classes).toHaveCount(2);
  await expect(classes.nth(0).getByTestId("a11yProblemClassNumber")).toHaveText(
    "1",
  );
  await expect(classes.nth(0)).toContainText("Tabs");
  await expect(classes.nth(1).getByTestId("a11yProblemClassNumber")).toHaveText(
    "2",
  );

  await classes.nth(1).getByRole("button", { name: "Up" }).click();
  await expect(classes.nth(0)).toContainText("Map controls");
  await expect(classes.nth(0).getByTestId("a11yProblemClassNumber")).toHaveText(
    "1",
  );
  // the long explanation waits behind a toggle
  await expect(page.getByTestId("howMatchingWorks")).not.toHaveAttribute(
    "open",
    "",
  );
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
