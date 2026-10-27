import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import { TEST_PROJECT } from "~client/_test/test.data.helper";
import type { Project } from "~client/types";
import type { ProjectVocabulary } from "~client/types/insights";
import { ProjectSettingsPage } from "pages";
import { API_URL, mockGetProjects, mockSaveProject } from "utils/mocks";

const project: Project = {
  ...TEST_PROJECT,
  bulkApproveVariations: false,
  bulkApproveGroupBy: "customTags",
  jiraUrl: "https://jira.example.com",
  jiraTokenSet: true,
};

const VOCABULARY: ProjectVocabulary = {
  trees: 3,
  screens: ["Payment", "Transfer", "Help"],
  elements: [
    {
      selector: "id:clock",
      element: "com.bank:id/clock",
      className: "android.widget.TextView",
      text: "12:30",
      label: "",
      screens: [0, 1, 2],
    },
    {
      selector: "id:btn_pay",
      element: "com.bank:id/btn_pay",
      className: "android.widget.Button",
      text: "Pay",
      label: "",
      screens: [0],
    },
  ],
  classes: [{ name: "TextView", screens: 3 }],
  titleCandidates: [
    {
      selector: "id:toolbar_title",
      screens: 2,
      examples: ["Payment", "Transfer"],
    },
  ],
};

const DEVICES = [
  { os: "15", device: "PIXEL_4_XL", browser: "", viewport: "", checks: 1499 },
  { os: "14", device: "Galaxy S23", browser: "", viewport: "", checks: 12 },
];

const mockSettingsApi = async (
  page: Page,
  vocabulary: ProjectVocabulary = VOCABULARY,
) => {
  await mockGetProjects(page, [project]);
  await mockSaveProject(page);
  await page.route(`${API_URL}/projects/${project.id}/vocabulary`, (route) =>
    route.fulfill({ body: JSON.stringify(vocabulary) }),
  );
  await page.route(`${API_URL}/projects/${project.id}/devices`, (route) =>
    route.fulfill({ body: JSON.stringify(DEVICES) }),
  );
};

const open = async (page: Page, tab = "") => {
  await page.goto(`/projects/${project.id}/settings${tab ? `/${tab}` : ""}`);
  const settings = new ProjectSettingsPage(page);
  await expect(settings.heading).toHaveText("Project settings");
  return settings;
};

const saveRequest = (page: Page) =>
  page.waitForRequest(
    (request) =>
      request.url() === `${API_URL}/projects` && request.method() === "PUT",
  );

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test.beforeEach(async ({ page, authUser }) => {
  await mockSettingsApi(page);
});

test("opens the settings page from the project list", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("link", { name: `Settings of ${project.name}` }).click();

  await expect(page).toHaveURL(`/projects/${project.id}/settings`);
  await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue(
    project.name,
  );
});

test("keeps the tab in the address", async ({ page }) => {
  const settings = await open(page);

  await settings.tab("mobile").click();
  await expect(page).toHaveURL(`/projects/${project.id}/settings/mobile`);
  await page.reload();
  await expect(
    page.getByText("Comparing screens by their UI tree"),
  ).toBeVisible();
});

test("names the variation axes for people", async ({ page }) => {
  await open(page);

  await page
    .getByRole("combobox", { name: "Group checks that differ only by" })
    .click();
  await expect(page.getByRole("option")).toHaveText([
    "Tags (language, theme…)",
    "OS version",
    "Device",
    "Screen size",
    "Browser",
  ]);
});

test("shows the move limit only with moves compared", async ({ page }) => {
  await open(page, "mobile");

  const limit = page.getByLabel("Only moves up to, dp");
  await expect(limit).toBeHidden();
  await page.getByLabel("Compare moved elements at their new place").check();
  await expect(limit).toBeVisible();
});

test("adds an element rule by searching the project's elements", async ({
  page,
}) => {
  const settings = await open(page, "mobile");

  await page.getByLabel("Element", { exact: true }).fill("12:3");
  await page.getByRole("option", { name: /id:clock/ }).click();
  await page.getByRole("button", { name: "Add rule" }).click();

  await expect(page.getByTestId("elementRule")).toContainText("id:clock");
  const [request] = await Promise.all([
    saveRequest(page),
    settings.saveBtn.click(),
  ]);
  expect(
    JSON.parse(request.postDataJSON().uiTreeSettings).elementRules,
  ).toEqual([
    expect.objectContaining({ selector: "id:clock", action: "ignore" }),
  ]);
});

test("marks the device with most checks as recommended", async ({ page }) => {
  await open(page, "mobile");

  await page.getByRole("combobox", { name: "Reference device" }).click();
  await expect(page.getByRole("option", { name: /PIXEL_4_XL/ })).toContainText(
    "Recommended",
  );
  await expect(
    page.getByRole("option", { name: /Galaxy S23/ }),
  ).not.toContainText("Recommended");
});

test("explains where suggestions come from when there are none", async ({
  page,
}) => {
  await mockSettingsApi(page, {
    trees: 0,
    screens: [],
    elements: [],
    classes: [],
    titleCandidates: [],
  });
  await open(page, "mobile");

  await expect(
    page.getByText(/Suggestions come from the project's UI trees/),
  ).toBeVisible();
  // typing a selector still works
  await page.getByLabel("Element", { exact: true }).fill("id:banner");
  await expect(page.getByRole("button", { name: "Add rule" })).toBeEnabled();
});

test("suggests the screen title found in the project's trees", async ({
  page,
}) => {
  const settings = await open(page, "accessibility");

  const candidate = page.getByTestId("titleCandidate");
  await expect(candidate).toContainText("id:toolbar_title");
  await expect(candidate).toContainText("names 2 of 3 screens");
  await candidate.getByRole("button", { name: "Use" }).click();

  const [request] = await Promise.all([
    saveRequest(page),
    settings.saveBtn.click(),
  ]);
  expect(JSON.parse(request.postDataJSON().uiTreeSettings).screenTitle[0]).toBe(
    "id:toolbar_title",
  );
});

test("saves every tab with one save", async ({ page }) => {
  const settings = await open(page);

  await page.getByLabel("Builds to keep").fill("50");
  await settings.tab("mobile").click();
  await page.getByLabel("Warn about loading states").uncheck();
  await settings.tab("jira").click();
  await page.getByLabel("Issue type").fill("Task");
  await expect(settings.unsaved).toBeVisible();

  const [request] = await Promise.all([
    saveRequest(page),
    settings.saveBtn.click(),
  ]);
  const body = request.postDataJSON();
  expect(body).toMatchObject({
    id: project.id,
    maxBuildAllowed: 50,
    jiraIssueType: "Task",
    // untouched settings go back as they were
    name: project.name,
    imageComparisonConfig: project.imageComparisonConfig,
  });
  expect(JSON.parse(body.uiTreeSettings)).toMatchObject({
    detectLoading: false,
    excludeSystemBars: true,
  });
  await expect(settings.notification.message).toHaveText(
    `${project.name} settings saved`,
  );
  await expect(settings.unsaved).toBeHidden();
});

test("warns before leaving with unsaved changes", async ({ page }) => {
  const settings = await open(page);

  await page.getByLabel("Builds to keep").fill("50");
  // other tabs of the page are not leaving it
  await settings.tab("comparison").click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("link", { name: "Projects" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Leave without saving?");
  await dialog.getByRole("button", { name: "Stay" }).click();
  await expect(page).toHaveURL(`/projects/${project.id}/settings/comparison`);

  await page.getByRole("link", { name: "Projects" }).first().click();
  await page.getByTestId("leaveWithoutSaving").click();
  await expect(page).toHaveURL("/projects");
});

test("does not save and marks the tab with an error", async ({ page }) => {
  const settings = await open(page, "jira");
  const saves: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT") saves.push(request.url());
  });

  await page.getByLabel("Jira URL").fill("jira");
  await settings.tab("general").click();
  await page.getByRole("textbox", { name: "Project name" }).fill("A");
  await settings.saveBtn.click();

  await expect(
    page.getByText(/Nothing was saved: 2 fields need fixing/),
  ).toBeVisible();
  await expect(page.getByText("Enter at least two characters.")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Project name" }),
  ).toBeFocused();
  await expect(settings.tab("jira")).toContainText("1");
  expect(saves).toEqual([]);
});

test("keeps a saved Jira token without showing it", async ({ page }) => {
  const settings = await open(page, "jira");

  const token = page.getByLabel("Shared token (optional)");
  await expect(token).toHaveValue("");
  await expect(token).toHaveAttribute(
    "placeholder",
    "Saved. Leave empty to keep it",
  );
  await page.getByLabel("Issue type").fill("Task");

  const [request] = await Promise.all([
    saveRequest(page),
    settings.saveBtn.click(),
  ]);
  // no token in the request: the server keeps the saved one
  expect(request.postDataJSON()).not.toHaveProperty("jiraToken");
});

test("shows the settings in Ukrainian", async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("vision.language", "uk"),
  );
  await page.goto(`/projects/${project.id}/settings/mobile`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Налаштування проєкту",
  );
  await expect(page.getByText("Попереджати про завантаження")).toBeVisible();
  await expect(page.getByText("Типово: увімкнено").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
});
