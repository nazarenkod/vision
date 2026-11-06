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
};
// only the person's own token reaches Jira (035)
test.use({ userJiraToken: true });
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
    "Проблема виявлена на PIXEL_4_XL (AOS 14) і потенційно відтворюється на всіх девайсах.",
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

async function mockApi(page: Page) {
  await mockGetProjects(page, [project]);
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

test.describe("without a personal Jira token", () => {
  test.use({ userJiraToken: false });

  test("disables Report bug without a personal Jira token, even with a shared one saved", async ({
    openProjectPage,
    page,
  }) => {
    // what an older API still sent about a shared token changes nothing
    await mockApi(page);
    await mockGetProjects(page, [{ ...project, jiraTokenSet: true } as never]);
    await openProjectPage(project.id, build.id, run.id);
    await expect(page.getByTestId("reportBug")).toBeDisabled();
  });
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
  await expect(dialog.getByLabel("Серйозність помилки")).toBeVisible();
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
  await page.getByLabel("Серйозність помилки").click();
  await page.getByRole("option", { name: "S4" }).click();
  await page.getByTestId("createBug").click();

  await expect(page.getByText("Filed MOB-77 · screen rejected")).toBeVisible();
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
  await page.getByLabel("Серйозність помилки").click();
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
  await expect(page.getByTestId("aiDrafted-actual")).toBeVisible();
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

async function withGemini(page: Page) {
  await page.addInitScript(() => {
    const user = JSON.parse(window.localStorage.getItem("user") ?? "{}");
    window.localStorage.setItem(
      "user",
      JSON.stringify({ ...user, geminiKeySet: true }),
    );
  });
  await page.route(`${API_URL}/ai/bug-draft`, (route) =>
    route.fulfill({
      body: JSON.stringify({
        essence: "кнопка «Pay» обрізана",
        steps: "1. Відкрити Checkout",
        actual: "Обрізана.",
        expected: "Видна.",
        cached: false,
      }),
    }),
  );
}

test("makes Create bug the only primary action", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  await withGemini(page);
  await openProjectPage(project.id, build.id, run.id);
  await page.getByTestId("reportBug").click();
  const dialog = page.getByTestId("reportBugDialog");
  const primary = dialog.locator(".MuiButton-contained");

  // enabled with nothing filled in: pressed, it shows what is missing
  await expect(primary).toHaveCount(1);
  await expect(primary).toHaveAttribute("data-testid", "createBug");
  await expect(page.getByTestId("createBug")).toBeEnabled();

  await page.getByTestId("bugNote").fill("кнопку оплати обрізано знизу");
  await page.getByTestId("fillWithAi").click();
  await expect(page.getByTestId("aiDraftedNote")).toBeVisible();
  const again = dialog.getByRole("button", { name: "Draft again" });
  await expect(again).toBeVisible();
  await expect(again).toHaveClass(/MuiButton-outlined/);
  await expect(primary).toHaveCount(1);
  // what Gemini receives is a tooltip on the info icon, not a block of text
  await expect(dialog.getByText(/Gemini gets your note/)).toHaveCount(0);
  await page.getByTestId("aiGetsInfo").hover();
  await expect(page.getByRole("tooltip")).toContainText("Gemini gets");
});

test("scrolls to the empty required field instead of filing", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  let filed = false;
  await page.route(`${API_URL}/test-runs/${run.id}/bug`, (route) => {
    filed = true;
    return route.fulfill({ body: "{}" });
  });
  await openProjectPage(project.id, build.id, run.id);
  await page.getByTestId("reportBug").click();
  const dialog = page.getByTestId("reportBugDialog");
  const severity = dialog.locator('[data-bug-field="jira:customfield_1"]');
  await expect(severity).toBeAttached();
  for (const [field, text] of [
    ["essence", "суть"],
    ["steps", "1. Крок"],
    ["actual", "Так."],
    ["expected", "Інакше."],
  ])
    await page.getByTestId(`bugField-${field}`).fill(text);
  await page.getByTestId("bugField-essence").scrollIntoViewIfNeeded();
  await expect(severity).not.toBeInViewport();

  await page.getByTestId("createBug").click();

  await expect(severity).toBeInViewport();
  await expect(severity.getByTestId("bugRequired")).toHaveText("Required");
  await expect(dialog.getByTestId("bugRequired")).toHaveCount(1);
  await expect(dialog.getByLabel("Серйозність помилки")).toBeFocused();
  await expect(dialog).toBeVisible();
  expect(filed).toBe(false);
});

test("labels the fields above them", async ({ openProjectPage, page }) => {
  await mockApi(page);
  await openProjectPage(project.id, build.id, run.id);
  await page.getByTestId("reportBug").click();
  const dialog = page.getByTestId("reportBugDialog");
  await expect(page.getByTestId("bugField-essence")).toBeVisible();
  // the dialog grows from the button: measure it once it has its size
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .every(
            (a) =>
              a.playState !== "running" ||
              a.effect?.getTiming().iterations === Infinity,
          ),
      ),
    )
    .toBe(true);

  // no floating labels: the focus outline never runs through a label
  await expect(dialog.locator(".MuiInputLabel-root")).toHaveCount(0);
  for (const [name, field] of [
    ["Summary", "essence"],
    ["Steps", "steps"],
    ["Actual result", "actual"],
  ]) {
    const input = dialog.getByLabel(name, { exact: true });
    await expect(input).toHaveAttribute("data-testid", `bugField-${field}`);
    await input.focus();
    const label = await dialog
      .locator(`label[for="bug-${field}"]`)
      .boundingBox();
    const box = await dialog
      .locator(`[data-bug-field="${field}"] .MuiOutlinedInput-root`)
      .boundingBox();
    if (!label || !box) throw new Error(`${name} is not drawn`);
    expect(label.y + label.height).toBeLessThanOrEqual(box.y);
  }
});

test("shows a Jira field by its Jira name", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  await openProjectPage(project.id, build.id, run.id);
  await page.getByTestId("reportBug").click();
  const dialog = page.getByTestId("reportBugDialog");
  const label = dialog.locator('label[for="bug-jira-customfield_1"]');

  // the interface is in English, the Jira field keeps Jira’s own name
  await expect(label).toContainText("Серйозність помилки");
  await expect(label).toContainText("Jira field");
  await expect(
    dialog.getByText("Actual result", { exact: true }),
  ).toBeVisible();
  // no count of missing fields in the footer, just what Vision adds
  await expect(dialog.getByText(/required fields? left/)).toHaveCount(0);
  await expect(page.getByTestId("bugAdds")).toHaveText(
    "Adds the screen, build and a link back · label “vision”",
  );
});
