import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_RUN_APPROVED,
  TEST_RUN_NEW,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import { TestRun } from "~client/types";
import { BuildOverview } from "~client/types/buildOverview";
import {
  API_URL,
  mockGetBuildDetails,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestRuns,
  mockImage,
  mockTestRun,
} from "utils/mocks";

const project = TEST_PROJECT;
const build = TEST_BUILD_FAILED;
const inBuild = (run: TestRun, over: Partial<TestRun> = {}): TestRun => ({
  ...run,
  buildId: build.id,
  ...over,
});
const pay = inBuild(TEST_UNRESOLVED, {
  id: "pay",
  name: "Checkout. Pay",
  device: "PIXEL_4_XL",
  os: "AOS 14",
});
const login = inBuild(TEST_UNRESOLVED, {
  id: "login",
  name: "Login. Error",
  device: "iPhone 15",
  os: "iOS 17",
});
const fresh = inBuild(TEST_RUN_NEW, {
  id: "fresh",
  name: "Onboarding. Step 3",
});
// decided already: its group has nothing left to review
const decided = inBuild(TEST_RUN_APPROVED, {
  id: "decided",
  name: "Cart. Empty",
});
const runs = [pay, login, fresh, decided];

const group = (
  fingerprint: string,
  kind: string,
  title: string,
  members: TestRun[],
) => ({
  id: `id-${fingerprint}`,
  kind,
  title,
  screens: members.map((run) => run.name),
  testRuns: members,
  changes: [],
  noise: null,
  fingerprint,
});
const groups = [
  group("moved", "component", "PbButton moved down", [pay, login]),
  group("done", "visual", "Image changed", [decided]),
  group("new", "new", "New screenshots", [fresh]),
];

const outcome = { total: 4, changed: 2, new: 1, rejected: 0, passed: 1 };
const overview: BuildOverview = {
  verdict: "waiting",
  counts: { ...outcome, waiting: 3, a11yNew: 2, bugs: 1 },
  progress: {
    decided: 1,
    needed: 4,
    people: [{ name: "Oleh Koval", approved: 1, rejected: 0 }],
  },
  devices: [
    {
      device: "PIXEL_4_XL",
      os: "AOS 14",
      browser: "browser",
      viewport: "viewport",
      a11yNew: 2,
      total: 1,
      changed: 1,
      new: 0,
      rejected: 0,
      passed: 0,
    },
    {
      device: "iPhone 15",
      os: "iOS 17",
      browser: "browser",
      viewport: "viewport",
      a11yNew: 0,
      total: 1,
      changed: 1,
      new: 0,
      rejected: 0,
      passed: 0,
    },
  ],
  features: [
    {
      name: "Checkout",
      total: 1,
      changed: 1,
      new: 0,
      rejected: 0,
      passed: 0,
      bugs: 1,
    },
    {
      name: "Login",
      total: 1,
      changed: 1,
      new: 0,
      rejected: 0,
      passed: 0,
      bugs: 0,
    },
  ],
  quietFeatures: { count: 2, screens: 2 },
  bugs: [
    {
      kind: "visual",
      jiraKey: "P24MOB-14231",
      jiraUrl: "https://jira.example/browse/P24MOB-14231",
      summary: "Pay button moved",
      testRunId: "pay",
      isNew: true,
    },
  ],
  previous: { number: 127, changed: 2, added: 1, gone: 0 },
  build: {
    id: build.id,
    number: 128,
    branchName: "release/7.4",
    ciBuildId: null,
    projectId: project.id,
    projectName: "Mobile Shop",
    createdAt: "2026-10-31T10:42:00Z",
    updatedAt: "2026-10-31T10:48:00Z",
  },
  asOf: "2026-10-31T11:05:00Z",
};

const mockOverview = async (page: Page) => {
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({ json: overview }),
  );
  await page.route(`${API_URL}/test-runs/groups?buildId=${build.id}`, (route) =>
    route.fulfill({ json: groups }),
  );
};

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, runs);
  for (const run of runs) await mockTestRun(page, run);
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
  await mockOverview(page);
});

test("opens a build on the Overview tab", async ({ openProjectPage, page }) => {
  const projectPage = await openProjectPage(project.id);
  await projectPage.buildList.getBuildLocator(build.number).click();

  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByTestId("overviewVerdict")).toContainText(
    "Waiting for review",
  );
  await expect(page.getByTestId("overviewVerdict")).toContainText(
    "3 of 4 need a decision",
  );
  await expect(page.getByTestId("overviewPrevious")).toHaveText(
    "Since #127: 2 changed, 1 new",
  );
  await expect(page.getByTestId("overviewProgress")).toContainText("1 / 4");
  await expect(page.getByTestId("overviewDevice")).toHaveCount(2);
  // features repeat the groups on the overview; they stay in the full report
  await expect(page.getByTestId("overviewFeatures")).toHaveCount(0);
  await expect(page.getByTestId("overviewBug")).toContainText("P24MOB-14231");
  expect(new URL(page.url()).searchParams.get("tab")).toBeNull();
});

test("lists the change groups in the order of the Changes tab, new last", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");

  // the group with nothing left to decide is not offered
  await expect(page.getByTestId("overviewGroup")).toHaveText([
    /PbButton moved down.*2/,
    /New screenshots.*1/,
  ]);
});

test("each number opens its tab or queue", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");

  await page.getByTestId("overviewTile-screens").click();
  await expect(page.getByRole("tab", { name: /All tests/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByTestId("overviewTile-rejected").click();
  await expect(page).toHaveURL(/tab=all&status=failed/);

  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByTestId("overviewTile-a11y").click();
  await expect(
    page.getByRole("tab", { name: /Accessibility/ }),
  ).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByTestId("overviewTile-waiting").click();
  await expect(page.getByTestId("queueName")).toHaveText("All waiting");
  await expect(page.getByTestId("queuePosition")).toHaveText("1 / 3");
});

test("shows the queue name and position instead of Step", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  await page
    .getByTestId("overviewDevice")
    .filter({ hasText: "iPhone 15" })
    .click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("queueName")).toHaveText("iPhone 15 iOS 17");
  await expect(page.getByTestId("queuePosition")).toHaveText("1 / 1");
  await expect(page.getByText(/^Step \d/)).toHaveCount(0);
  await expect(page).toHaveURL(/queue=device%3AiPhone/);
});

test("switches the queue from its menu", async ({ openProjectPage, page }) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  await page.getByTestId("reviewWaiting").click();
  await expect(page.getByTestId("queuePosition")).toHaveText("1 / 3");

  await page.getByTestId("queueName").click();
  await page.getByRole("menuitem", { name: /New screenshots/ }).click();

  await expect(page.getByTestId("queueName")).toHaveText("New screenshots");
  await expect(page.getByTestId("queuePosition")).toHaveText("1 / 1");
  await expect(page).toHaveURL(/testId=fresh/);
});

test("sums up a finished queue and offers the next one", async ({
  openProjectPage,
  page,
}) => {
  // a link to a queue whose screenshots someone decided meanwhile
  await page.goto(
    `/${project.id}?buildId=${build.id}&testId=decided&queue=group%3Adone`,
  );

  const done = page.getByTestId("queueDone");
  await expect(done).toContainText("Image changed · done");
  await expect(done).toContainText("1 approved · 0 rejected");
  await expect(page.getByTestId("queueNext")).toContainText(
    "Next: New screenshots · 1",
  );

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("queueName")).toHaveText("New screenshots");
  await expect(page).toHaveURL(/testId=fresh/);
  void openProjectPage;
});

test("Esc returns to where the review was opened, focus on the same row", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const row = page
    .getByTestId("overviewDevice")
    .filter({ hasText: "PIXEL_4_XL" });
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("queueName")).toHaveText("PIXEL_4_XL AOS 14");

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("buildOverview")).toBeVisible();
  await expect(row).toBeFocused();
  expect(new URL(page.url()).searchParams.get("queue")).toBeNull();
});

test("shows a placeholder for a screenshot that did not load", async ({
  openProjectPage,
  page,
}) => {
  await page.route("**/image.png", (route) => route.fulfill({ status: 404 }));
  await page.route("**/diff.png", (route) => route.fulfill({ status: 404 }));
  await openProjectPage(project.id, build.id, undefined, "overview");

  const group = page.getByTestId("overviewGroup").first();
  await expect(group.getByTestId("thumbMissing")).toHaveCount(2);
  await expect(group.getByRole("img", { name: "Checkout. Pay" })).toBeVisible();
});
