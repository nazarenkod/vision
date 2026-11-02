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
  featureName: "Checkout",
  a11yNewCount: 2,
  a11yTotalCount: 3,
});
const login = inBuild(TEST_UNRESOLVED, {
  id: "login",
  name: "Login. Error",
  device: "iPhone 15",
  os: "iOS 17",
  a11yNewCount: 0,
  a11yTotalCount: 1,
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
      screen: "1080×2400",
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
      screen: "1179×2556",
      a11yNew: 0,
      total: 1,
      changed: 1,
      new: 0,
      rejected: 0,
      passed: 0,
    },
    {
      device: "Galaxy S23",
      os: "Android 14",
      browser: "",
      viewport: "",
      screen: "1080×2340",
      a11yNew: 0,
      total: 1,
      changed: 0,
      new: 0,
      rejected: 0,
      passed: 1,
    },
  ],
  features: [
    {
      name: "Checkout",
      grouped: true,
      total: 1,
      changed: 1,
      new: 0,
      rejected: 0,
      passed: 0,
      bugs: 1,
    },
    {
      name: "Login. Error",
      grouped: false,
      total: 1,
      changed: 1,
      new: 0,
      rejected: 0,
      passed: 0,
      bugs: 0,
    },
  ],
  quietFeatures: {
    count: 2,
    screens: 2,
    features: [
      {
        name: "Home",
        grouped: true,
        total: 1,
        changed: 0,
        new: 0,
        rejected: 0,
        passed: 1,
        bugs: 0,
      },
      {
        name: "Search. Results",
        grouped: false,
        total: 1,
        changed: 0,
        new: 0,
        rejected: 0,
        passed: 1,
        bugs: 0,
      },
    ],
  },
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
  // the build's state is the header's; the tiles carry what is not said there
  await expect(page.getByTestId("overviewTile-waiting")).toContainText("3");
  // the tile says only what waits; the progress is on hover
  await expect(page.getByTestId("overviewCaption-waiting")).toHaveCount(0);
  await expect(page.getByTestId("overviewTile-waiting")).toHaveAttribute(
    "title",
    "1 of 4 decided\nOleh Koval: 1 approved · 0 rejected",
  );
  await expect(page.getByTestId("overviewDevice")).toHaveCount(3);
  await expect(page.getByTestId("overviewQuietFeatures")).toContainText(
    "+2 passed",
  );
  // the tables name themselves in their first column
  await expect(page.getByRole("heading", { name: "Features" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Devices" })).toHaveCount(0);
  await expect(page.getByTestId("overviewBug")).toContainText("P24MOB-14231");
  expect(new URL(page.url()).searchParams.get("tab")).toBeNull();
});

test("has no progress hint when nothing needed a decision", async ({
  openProjectPage,
  page,
}) => {
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({
      json: { ...overview, progress: { decided: 0, needed: 0, people: [] } },
    }),
  );
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("overviewTile-waiting")).toBeVisible();
  await expect(page.getByTestId("overviewTile-waiting")).not.toHaveAttribute(
    "title",
    /.+/,
  );
});

test("leaves change groups to the Changes tab", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("overviewFeatures")).toBeVisible();
  // the groups repeated the features when screenshots came without UI trees
  await expect(page.getByTestId("overviewToDecide")).toHaveCount(0);
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
  await expect(page.getByTestId("queueName")).toHaveText("All to review");
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
  await page.getByRole("menuitem", { name: /New screens/ }).click();

  await expect(page.getByTestId("queueName")).toHaveText("New screens");
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
    "Next: New screens · 1",
  );

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("queueName")).toHaveText("New screens");
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

test("keeps the counts out of the build header on every tab", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("overviewTile-screens")).toBeVisible();
  await expect(page.getByTestId("buildCounts")).toHaveCount(0);

  await page.getByRole("tab", { name: /All tests/ }).click();
  await expect(page.getByTestId("buildStatusBar")).toBeVisible();
  await expect(page.getByTestId("buildCounts")).toHaveCount(0);
});

test("opens the passed features in place of their folded row", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("overviewFeature")).toHaveCount(2);

  await page.getByTestId("overviewQuietFeatures").click();
  await expect(page.getByTestId("overviewQuietFeatures")).toHaveCount(0);
  await expect(page.getByTestId("overviewFeature")).toHaveText([
    /Checkout/,
    /Login/,
    /Home/,
    /Search\. Results/,
  ]);
});

test("counts the checks of a feature and opens a check on its own", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const rows = page.getByTestId("overviewFeature");
  // the check's full name: no feature is guessed from it
  await expect(rows).toHaveText([/^Checkout/, /^Login\. Error/]);
  await expect(rows.first().getByTestId("overviewChecks")).toHaveText("1");
  await expect(rows.last().getByTestId("overviewChecks")).toHaveCount(0);

  await rows.last().click();
  await expect(page.getByTestId("queueName")).toHaveText("Login. Error");
  await expect(page.getByTestId("queuePosition")).toHaveText("1 / 1");
  await expect(page).toHaveURL(/queue=check%3ALogin/);
});

test("puts the count of All tests in a pill like the tabs beside it", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const tab = page.getByRole("tab", { name: /All tests/ });
  await expect(tab).toHaveText(new RegExp(`^All tests\\s*${runs.length}$`));
});

test("shows a device's screen size when the run sent no viewport", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const devices = page.getByTestId("overviewDevice");
  await expect(devices.filter({ hasText: "Galaxy S23" })).toContainText(
    "Android 14 · 1080×2340",
  );
  await expect(devices.filter({ hasText: "PIXEL_4_XL" })).toContainText(
    "AOS 14 · browser · viewport",
  );
  await expect(
    page.getByTestId("overviewDevices").getByText("Accessibility"),
  ).toBeVisible();
});

test("names the review button without a count", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("reviewWaiting")).toHaveText("Review");
});

test("explains a result bar and leaves zeros out of the counts", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const login = page
    .getByTestId("overviewFeature")
    .filter({ hasText: "Login" });
  // Login has no bugs: a dash rather than a 0
  await expect(login.getByTestId("overviewNum").last()).toHaveText("—");

  await login.getByTestId("resultBar").hover();
  await expect(page.getByRole("tooltip")).toHaveText("1 changed");
});

test("says there are no Jira bugs in one line", async ({
  openProjectPage,
  page,
}) => {
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({
      json: { ...overview, bugs: [], counts: { ...overview.counts, bugs: 0 } },
    }),
  );
  await openProjectPage(project.id, build.id, undefined, "overview");
  const bugs = page.getByTestId("overviewBugs");
  await expect(bugs).toHaveText("No Jira bugs on this build");
});

test("lays out the Accessibility tab like the Overview", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "a11y");
  await expect(page.getByTestId("a11yTile-new")).toContainText("2");
  await expect(page.getByTestId("a11yTile-new")).toHaveAttribute(
    "title",
    /only issues this build introduced/,
  );
  await expect(page.getByTestId("a11yCaption-checked")).toHaveText(
    "of 4 screens",
  );

  const rows = page.getByTestId("a11yScreen");
  await expect(rows).toHaveCount(2);
  // the device as the Overview's devices table names it
  await expect(rows.first()).toContainText("PIXEL_4_XL");
  await expect(rows.first()).toContainText("AOS 14");
  await expect(rows.first()).not.toContainText("Device:");
  // Login has no new issues: a dash rather than a 0
  await expect(rows.last().getByTestId("overviewNum").first()).toHaveText("—");

  await rows.first().click();
  await expect(page).toHaveURL(/tab=a11y.*testId=pay$/);
});
