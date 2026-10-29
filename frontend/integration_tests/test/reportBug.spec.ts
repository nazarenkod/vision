import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import {
  API_URL,
  mockGetBuildDetails,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestRuns,
  mockImage,
  mockTestRun,
} from "utils/mocks";
import { StructureInfo } from "~client/types";

// A bug from the comparison (025), against a mocked API.
const project = {
  ...TEST_PROJECT,
  jiraUrl: "https://jira",
  jiraTokenSet: true,
};
const build = TEST_BUILD_FAILED;
const run = TEST_UNRESOLVED;
const area = { x: 10, y: 20, width: 200, height: 60 };

const structure: StructureInfo = {
  hasUiTree: false,
  hasBaselineUiTree: false,
  changes: [],
  regions: [{ region: area, key: null, element: null, resourceId: null }],
  hints: [],
  invisible: [],
  warnings: [],
  rules: [],
  ignoredAreas: [],
  toleratedAreas: [],
  systemBars: [],
  moves: [],
  settings: null as unknown as StructureInfo["settings"],
} as StructureInfo;

const preparation = {
  parent: {
    key: "MOB-1",
    summary: "Checkout redesign",
    projectKey: "MOB",
    assignee: "Anna",
  },
  issueTypes: [{ id: "10", name: "Помилка", subtask: true }],
  issueTypeId: "10",
  linkTypes: [],
  linkType: null,
  feature: "Checkout",
  prefix: "[Automation] [Checkout]",
  environment:
    "AOS 14 · PIXEL_4_XL, build #128. UI-проблеми відтворюються на всіх девайсах.",
  hasBaseline: true,
  inputs: [
    {
      id: "customfield_1",
      name: "Серйозність помилки",
      required: true,
      type: "option",
      role: "severity",
      options: [
        { id: "1", label: "S1" },
        { id: "4", label: "S4" },
      ],
    },
    {
      id: "customfield_2",
      name: "Замовник",
      required: true,
      type: "user",
      role: "customer",
      value: { accountId: "olena" },
      display: "Олена Коваль",
    },
  ],
  filled: [],
  missing: [],
};

async function mockApi(
  page: Page,
  options: { projectWithToken?: boolean } = {},
) {
  await mockGetProjects(page, [
    options.projectWithToken === false
      ? { ...project, jiraTokenSet: false }
      : project,
  ]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, [run]);
  await mockTestRun(page, run);
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
  await page.route(`${API_URL}/test-runs/${run.id}/structure`, (route) =>
    route.fulfill({ body: JSON.stringify(structure) }),
  );
  await page.route(`${API_URL}/test-runs/${run.id}/bugs`, (route) =>
    route.fulfill({ body: "[]" }),
  );
  await page.route(`${API_URL}/test-runs/${run.id}/bug/prepare`, (route) =>
    route.fulfill({ body: JSON.stringify(preparation) }),
  );
  await page.route(`${API_URL}/ai/status`, (route) =>
    route.fulfill({
      body: JSON.stringify({
        enabled: false,
        provider: "none",
        model: null,
        dailyLimit: 500,
        usedToday: 0,
      }),
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // the task is remembered for the screen, as after an earlier bug
    window.localStorage.setItem("vision.jira.parent.someProjectId", "MOB-1");
  });
});

test("shows Report bug next to the decisions when Jira is set up", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  await openProjectPage(project.id, build.id, run.id);
  await expect(page.getByTestId("reportBug")).toBeEnabled();
});

test("disables Report bug without a Jira token", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page, { projectWithToken: false });
  await openProjectPage(project.id, build.id, run.id);
  await expect(page.getByTestId("reportBug")).toBeDisabled();
});

test("opens the bug dialog with B", async ({ openProjectPage, page }) => {
  await mockApi(page);
  await openProjectPage(project.id, build.id, run.id);
  await expect(page.getByTestId("reportBug")).toBeEnabled();
  await page.keyboard.press("b");
  const dialog = page.getByTestId("reportBugDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("[Automation] [Checkout]");
  // the customer comes from the task without asking; severity is asked every time
  await expect(dialog.getByText("Замовник")).toHaveCount(0);
  await expect(page.getByTestId("bugMissing")).toContainText(
    "Серйозність помилки",
  );
});

test("opens with the changed area already marked", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  await openProjectPage(project.id, build.id, run.id);
  await page.getByRole("tab", { name: /Changes/ }).click();
  await page.getByTestId("reportBugFromArea").click();
  await expect(page.getByTestId("bugMark")).toHaveCount(1);
  await expect(page.getByTestId("bugMark")).toContainText(
    "200 × 60 px at 10, 20",
  );
});

test("rejects the checkpoint after filing when the box is ticked", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  let filed: Record<string, unknown> | undefined;
  await page.route(`${API_URL}/test-runs/${run.id}/bug`, (route) => {
    filed = route.request().postDataJSON();
    return route.fulfill({
      body: JSON.stringify({
        jiraKey: "MOB-77",
        jiraUrl: "https://jira/browse/MOB-77",
        summary: "s",
        warnings: [],
      }),
    });
  });
  let rejected: unknown;
  await page.route(`${API_URL}/test-runs/reject`, (route) => {
    rejected = route.request().postDataJSON();
    return route.fulfill({ body: JSON.stringify({ decisionId: "d1" }) });
  });
  await openProjectPage(project.id, build.id, run.id);
  await page.getByTestId("reportBug").click();

  await page.getByTestId("bugField-essence").fill("кнопка «Pay» обрізана");
  await page.getByTestId("bugField-steps").fill("1. Відкрити Checkout");
  await page.getByTestId("bugField-actual").fill("Обрізана.");
  await page.getByTestId("bugField-expected").fill("Видна.");
  await expect(page.getByTestId("createBug")).toBeDisabled();
  await page.getByLabel("Серйозність помилки *").click();
  await page.getByRole("option", { name: "S4" }).click();
  await page.getByTestId("createBug").click();

  await expect(
    page.getByText("Filed MOB-77 · checkpoint rejected"),
  ).toBeVisible();
  // the customer is not sent: the server copies it from the task
  expect(filed).toMatchObject({
    parentKey: "MOB-1",
    essence: "кнопка «Pay» обрізана",
  });
  expect(filed?.fieldValues).toEqual({ customfield_1: { id: "4" } });
  expect(rejected).toEqual([run.id]);
});

test("shows the new key with Open in Jira and Undo reject", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  await page.route(`${API_URL}/test-runs/${run.id}/bug`, (route) =>
    route.fulfill({
      body: JSON.stringify({
        jiraKey: "MOB-77",
        jiraUrl: "https://jira/browse/MOB-77",
        summary: "s",
        warnings: [],
      }),
    }),
  );
  await page.route(`${API_URL}/test-runs/reject`, (route) =>
    route.fulfill({ body: JSON.stringify({ decisionId: "d1" }) }),
  );
  await openProjectPage(project.id, build.id, run.id);
  await page.getByTestId("reportBug").click();
  for (const [field, text] of [
    ["essence", "суть"],
    ["steps", "1. Крок"],
    ["actual", "Так."],
    ["expected", "Інакше."],
  ])
    await page.getByTestId(`bugField-${field}`).fill(text);
  await page.getByLabel("Серйозність помилки *").click();
  await page.getByRole("option", { name: "S1" }).click();
  await page.getByTestId("createBug").click();

  await expect(page.getByTestId("openFiledBug")).toBeVisible();
  await expect(page.getByTestId("undoDecision")).toBeVisible();
});

test("offers Report bug after a reject", async ({ openProjectPage, page }) => {
  await mockApi(page);
  await page.route(`${API_URL}/test-runs/reject`, (route) =>
    route.fulfill({ body: JSON.stringify({ decisionId: "d1" }) }),
  );
  await openProjectPage(project.id, build.id, run.id);
  await page
    .locator("button")
    .filter({ hasText: /^Reject/ })
    .click();
  await page.getByTestId("reportBugAfterReject").click();
  await expect(page.getByTestId("reportBugDialog")).toBeVisible();
});

test("fills the texts with AI on the person’s own Gemini key and marks them", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => {
    const user = JSON.parse(window.localStorage.getItem("user") ?? "{}");
    window.localStorage.setItem(
      "user",
      JSON.stringify({ ...user, geminiKeySet: true }),
    );
  });
  let asked: Record<string, unknown> | undefined;
  await page.route(`${API_URL}/ai/bug-draft`, (route) => {
    asked = route.request().postDataJSON();
    return route.fulfill({
      body: JSON.stringify({
        essence: "кнопка «Pay» обрізана",
        steps: "1. Відкрити Checkout",
        actual: "Обрізана.",
        expected: "Видна.",
        cached: false,
      }),
    });
  });
  await openProjectPage(project.id, build.id, run.id);
  await page.getByTestId("reportBug").click();

  await expect(page.getByTestId("fillWithAi")).toBeDisabled();
  await page.getByTestId("bugNote").fill("кнопку оплати обрізано знизу");
  await page.getByTestId("fillWithAi").click();

  await expect(page.getByTestId("bugField-essence")).toHaveValue(
    "кнопка «Pay» обрізана",
  );
  // MUI draws a label twice (the label and the outline gap)
  await expect(page.getByTestId("aiDrafted-actual").first()).toBeVisible();
  expect(asked).toMatchObject({
    testRunId: run.id,
    note: "кнопку оплати обрізано знизу",
    attempt: 1,
  });

  await page.getByTestId("bugField-actual").fill("Моє.");
  await expect(page.getByTestId("aiDrafted-actual")).toHaveCount(0);
});

test("asks for a personal Gemini key instead of offering AI without one", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  await openProjectPage(project.id, build.id, run.id);
  await page.getByTestId("reportBug").click();
  await expect(page.getByTestId("needGeminiKey")).toBeVisible();
  await expect(page.getByTestId("fillWithAi")).toHaveCount(0);
});
