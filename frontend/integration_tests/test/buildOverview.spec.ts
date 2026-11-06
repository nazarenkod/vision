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
  inUkrainian,
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
      checks: [
        {
          name: "Checkout. Pay",
          grouped: false,
          total: 1,
          changed: 1,
          new: 0,
          rejected: 0,
          passed: 0,
          bugs: 1,
        },
      ],
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
        checks: [
          {
            name: "Home. Banner",
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
  a11y: {
    checked: true,
    problems: [
      {
        testRunId: "pay",
        rule: "touch-target",
        element: "Pay",
        isNew: true,
        check: "Checkout. Pay",
        device: "PIXEL_4_XL",
        os: "AOS 14",
      },
      {
        testRunId: "login",
        rule: "missing-label",
        element: "btn_scan",
        isNew: false,
        check: "Login. Error",
        device: "iPhone 15",
        os: "iOS 17",
      },
    ],
    more: 0,
  },
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

// a row of the checks table: a feature or a check on its own, in their order
const tableRows = (page: Page) =>
  page.locator(
    '[data-testid="overviewFeature"], [data-testid="overviewCheck"]',
  );

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
  await expect(page.getByTestId("buildDevice")).toHaveCount(3);
  await expect(tableRows(page)).toHaveCount(4);
  // one table that names itself in its header; the devices are the header's
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
  await expect(page.getByTestId("overviewTable")).toBeVisible();
  // the groups repeated the features when screenshots came without UI trees
  await expect(page.getByTestId("overviewToDecide")).toHaveCount(0);
});

test("each number opens its tab or queue", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");

  await page.getByTestId("overviewTile-screens").click();
  await expect(page.getByRole("tab", { name: /All screens/ })).toHaveAttribute(
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
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/queue=all&testId=/);
});

test("opens the queue of a device from the build header", async ({
  openProjectPage,
  page,
}) => {
  const galaxy = inBuild(TEST_RUN_APPROVED, {
    id: "galaxy",
    name: "Home. Banner",
    device: "Galaxy S23",
    os: "Android 14",
    browser: "",
    viewport: "",
  });
  await mockGetTestRuns(page, build.id, [...runs, galaxy]);
  await mockTestRun(page, galaxy);
  await openProjectPage(project.id, build.id, undefined, "overview");
  await page
    .getByTestId("buildDevice")
    .filter({ hasText: "iPhone 15" })
    .click();

  // the device's waiting screens, as the devices table did (REQ-031-21)
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/queue=device%3AiPhone.*testId=login$/);
  await expect(page.getByTestId("screenName")).toHaveText("Login. Error");

  // a device with nothing waiting opens its screen on its own (REQ-048-06)
  await page.keyboard.press("Escape");
  await page
    .getByTestId("buildDevice")
    .filter({ hasText: "Galaxy S23" })
    .click();
  await expect(page).toHaveURL(/queue=run%3Agalaxy.*testId=galaxy$/);
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
  await expect(page).toHaveURL(/queue=group%3Anew.*testId=fresh$/);
  await expect(page.getByTestId("screenName")).toHaveText("Onboarding. Step 3");
  void openProjectPage;
});

test("Esc returns to where the review was opened, focus on the same row", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const row = page
    .getByTestId("overviewCheck")
    .filter({ hasText: "Login. Error" });
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/queue=check%3ALogin/);

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

  await page.getByRole("tab", { name: /All screens/ }).click();
  await expect(page.getByTestId("buildStatusBar")).toBeVisible();
  await expect(page.getByTestId("buildCounts")).toHaveCount(0);
});

test("shows every feature at once, those with changes first", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("overviewQuietFeatures")).toHaveCount(0);
  await expect(tableRows(page)).toHaveText([
    /Checkout/,
    /Login/,
    /Home/,
    /Search\. Results/,
  ]);
});

test("lets the tiles with nothing to see step back", async ({
  openProjectPage,
  page,
}) => {
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({
      json: {
        ...overview,
        counts: { ...overview.counts, rejected: 0, bugs: 0 },
      },
    }),
  );
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("overviewTile-rejected")).toHaveAttribute(
    "data-quiet",
    "true",
  );
  await expect(page.getByTestId("overviewTile-bugs")).toHaveAttribute(
    "data-quiet",
    "true",
  );
  await expect(page.getByTestId("overviewTile-waiting")).not.toHaveAttribute(
    "data-quiet",
    "true",
  );
  await expect(page.getByTestId("overviewTile-screens")).not.toHaveAttribute(
    "data-quiet",
    "true",
  );
});

test("lists the accessibility problems, new first, and opens one on its tab", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const rows = page.getByTestId("overviewA11yProblem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Touch target too small");
  await expect(rows.first()).toContainText("Checkout. Pay · Pay");
  await expect(rows.first()).toContainText("New");
  await expect(rows.last()).toContainText("Control has no label");
  await expect(rows.last()).toContainText("Known");

  await rows.last().click();
  await expect(page).toHaveURL(/tab=a11y.*testId=login$/);
});

test("counts the accessibility problems past twenty and opens the tab for them", async ({
  openProjectPage,
  page,
}) => {
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({
      json: { ...overview, a11y: { ...overview.a11y, more: 7 } },
    }),
  );
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("overviewA11yMore")).toHaveText(
    "+7 more on the Accessibility tab",
  );
  await page.getByTestId("overviewA11yMore").click();
  await expect(page).toHaveURL(/tab=a11y/);
});

test("says there are no accessibility problems in one line, and nothing without UI trees", async ({
  openProjectPage,
  page,
}) => {
  let a11y: BuildOverview["a11y"] = { checked: true, problems: [], more: 0 };
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({ json: { ...overview, a11y } }),
  );
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("overviewA11y")).toHaveText(
    "No accessibility problems",
  );

  a11y = { checked: false, problems: [], more: 0 };
  await page.reload();
  await expect(page.getByTestId("overviewTable")).toBeVisible();
  await expect(page.getByTestId("overviewA11y")).toHaveCount(0);
});

test("groups the checks of a feature under it with their results", async ({
  openProjectPage,
  page,
}) => {
  await inUkrainian(page);
  await openProjectPage(project.id, build.id, undefined, "overview");
  const checkout = page
    .getByTestId("overviewFeature")
    .filter({ hasText: "Checkout" });
  // the feature in bold with how many checks it holds (REQ-048-02)
  await expect(checkout.getByTestId("overviewFeatureCount")).toHaveText(
    "· 1 перевірка",
  );
  await expect(checkout.getByText("Checkout", { exact: true })).toHaveCSS(
    "font-weight",
    "600",
  );
  await expect(checkout.getByTestId("resultWords")).toHaveText("1 змінений");
  // its check right under it, with its own result and bugs
  const check = page.getByTestId("overviewFeatureCheck");
  await expect(check).toHaveCount(1);
  await expect(check.getByTestId("overviewCheckName")).toHaveText(
    "Checkout. Pay",
  );
  await expect(check.getByTestId("resultWords")).toHaveText("1 змінений");
  await expect(check.getByTestId("overviewNum")).toHaveText("1");
  const feature = await checkout.boundingBox();
  const under = await check.boundingBox();
  if (!feature || !under) throw new Error("not on screen");
  expect(Math.round(under.y)).toBe(Math.round(feature.y + feature.height));
});

test("opens a check in its feature's queue and a decided one on its own", async ({
  openProjectPage,
  page,
}) => {
  const banner = inBuild(TEST_RUN_APPROVED, {
    id: "banner",
    name: "Home. Banner",
    featureName: "Home",
  });
  await mockGetTestRuns(page, build.id, [...runs, banner]);
  await mockTestRun(page, banner);
  await openProjectPage(project.id, build.id, undefined, "overview");

  // a check in a feature: the feature's queue, from this check (REQ-048-05)
  await page.getByTestId("overviewFeatureCheck").click();
  await expect(page).toHaveURL(/queue=feature%3ACheckout.*testId=pay$/);
  await expect(page.getByTestId("screenName")).toHaveText("Checkout. Pay");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // a check on its own: its waiting screens
  await page.getByTestId("overviewCheck").filter({ hasText: "Login" }).click();
  await expect(page).toHaveURL(/queue=check%3ALogin.*testId=login$/);
  await expect(page.getByTestId("screenName")).toHaveText("Login. Error");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // the feature's name: the feature's queue
  await page
    .getByTestId("overviewFeature")
    .filter({ hasText: "Checkout" })
    .getByTestId("overviewFeatureName")
    .click();
  await expect(page).toHaveURL(/queue=feature%3ACheckout/);
  await expect(page.getByTestId("screenName")).toHaveText("Checkout. Pay");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // nothing waits in it: the check's screen on its own
  await page
    .getByTestId("overviewFeature")
    .filter({ hasText: "Home" })
    .getByTestId("overviewFeatureToggle")
    .click();
  await page
    .getByTestId("overviewFeatureCheck")
    .filter({ hasText: "Home. Banner" })
    .click();
  await expect(page).toHaveURL(/queue=run%3Abanner.*testId=banner$/);
});

test("opens a feature with changes and folds one without them", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const feature = (name: string) =>
    page.getByTestId("overviewFeature").filter({ hasText: name });
  const checks = page.getByTestId("overviewFeatureCheck");
  // Checkout has a change: open; Home has none: folded (REQ-048-04)
  await expect(feature("Checkout")).toHaveAttribute("data-open", "true");
  await expect(feature("Home")).not.toHaveAttribute("data-open", "true");
  await expect(checks).toHaveText([/Checkout\. Pay/]);

  await feature("Home").getByTestId("overviewFeatureToggle").click();
  await expect(feature("Home")).toHaveAttribute("data-open", "true");
  await expect(checks).toHaveText([/Checkout\. Pay/, /Home\. Banner/]);

  await feature("Checkout").getByTestId("overviewFeatureToggle").click();
  await expect(
    feature("Checkout").getByTestId("overviewFeatureToggle"),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(checks).toHaveText([/Home\. Banner/]);
});

test("has the columns Check, Result and Bugs only", async ({
  openProjectPage,
  page,
}) => {
  await inUkrainian(page);
  await openProjectPage(project.id, build.id, undefined, "overview");
  const table = page.getByTestId("overviewTable");
  const header = table.locator("> div").first();
  // what waits is in the result's words already (REQ-048-01)
  await expect(header.locator("> span")).toHaveText([
    "Перевірка",
    "Результат",
    "Баги",
  ]);
  await expect(table.getByText("Перегляд", { exact: true })).toHaveCount(0);
  await expect(table.getByText("Перевірки", { exact: true })).toHaveCount(0);
});

test("puts the count of All tests in a pill like the tabs beside it", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const tab = page.getByRole("tab", { name: /All screens/ });
  await expect(tab).toHaveText(new RegExp(`^All screens\\s*${runs.length}$`));
});

test("shows a device's screen size when the run sent no viewport", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const devices = page.getByTestId("buildDevice");
  // one grey tag per value, model first, the size last (spec 037)
  await expect(
    devices.filter({ hasText: "Galaxy S23" }).getByTestId("deviceTag"),
  ).toHaveText(["Galaxy S23", "Android 14", "1080×2340"]);
  await expect(
    devices.filter({ hasText: "PIXEL_4_XL" }).getByTestId("deviceTag"),
  ).toHaveText(["PIXEL_4_XL", "AOS 14", "browser", "viewport"]);
});

test("names the review button without a count", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("reviewWaiting")).toHaveText("Review");
});

test("explains a result bar and shows zeros as a faint 0", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const login = page.getByTestId("overviewCheck").filter({ hasText: "Login" });
  // Login has no bugs: a faint 0, so the column reads as numbers (039)
  await expect(login.getByTestId("overviewNum").last()).toHaveText("0");

  // the card rises into place: a pointer resting where it lands opens nothing
  await expect
    .poll(() =>
      page
        .getByTestId("overviewTable")
        .evaluate((el) =>
          el.getAnimations().every((a) => a.playState === "finished"),
        ),
    )
    .toBe(true);
  await login.getByTestId("resultBar").hover();
  await expect(page.getByRole("tooltip")).toHaveText("1 changed");
});

test("shows no Jira bugs card when the build has none", async ({
  openProjectPage,
  page,
}) => {
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({
      json: { ...overview, bugs: [], counts: { ...overview.counts, bugs: 0 } },
    }),
  );
  await openProjectPage(project.id, build.id, undefined, "overview");
  await expect(page.getByTestId("overviewTable")).toBeVisible();
  // the tile says 0 already (REQ-048-07)
  await expect(page.getByTestId("overviewValue-bugs")).toHaveText("0");
  await expect(page.getByTestId("overviewBugs")).toHaveCount(0);
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

test("keeps tile numbers neutral and colours only the marker", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, undefined, "overview");
  const colorOf = (testId: string) =>
    page
      .getByTestId(testId)
      .evaluate((element) => getComputedStyle(element).color);
  const text = await colorOf("overviewValue-screens");
  // every number that is not zero in the colour of the text
  for (const key of ["waiting", "a11y", "bugs"]) {
    expect(await colorOf(`overviewValue-${key}`)).toBe(text);
  }
  // what waits is marked by a dot in the changed colour
  await expect(
    page.getByTestId("overviewMarker-waiting").getByTestId("tileDot"),
  ).toHaveCSS("background-color", "rgb(247, 144, 9)");
  // accessibility and Jira by an icon next to the label
  await expect(
    page.getByTestId("overviewMarker-a11y").locator("svg"),
  ).toBeVisible();
  await expect(
    page.getByTestId("overviewMarker-bugs").locator("svg"),
  ).toBeVisible();
  // "2 new" over "Accessibility"
  await expect(page.getByTestId("overviewUnit-a11y")).toHaveText("new");
  await expect(page.getByTestId("overviewValue-a11y")).toHaveText(/^2\s*new$/);
  await expect(page.getByTestId("overviewTile-a11y")).toContainText(
    "Accessibility",
  );
  // a zero steps back whole, with nothing to mark (039)
  await expect(page.getByTestId("overviewTile-rejected")).toHaveAttribute(
    "data-quiet",
    "true",
  );
  await expect(page.getByTestId("overviewMarker-rejected")).toHaveCount(0);
});

test("shows the devices of the build in its header on every tab", async ({
  openProjectPage,
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openProjectPage(project.id, build.id, undefined, "overview");
  const devices = page.getByTestId("buildDevice");
  await expect(devices).toHaveCount(3);
  // a set of tags per device, model first (REQ-037-11)
  await expect(devices.first().getByTestId("deviceTag")).toHaveText([
    "PIXEL_4_XL",
    "AOS 14",
    "browser",
    "viewport",
  ]);
  // after the time, in the header; no devices card on the Overview (REQ-048-06)
  const period = await page.getByTestId("buildPeriod").boundingBox();
  const first = await devices.first().boundingBox();
  if (!period || !first) throw new Error("not on screen");
  expect(first.x).toBeGreaterThan(period.x + period.width);
  // on the line under the build's name
  const title = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(period.y).toBeGreaterThan((title?.y ?? 0) + (title?.height ?? 0) - 2);
  expect(
    Math.abs(first.y + first.height / 2 - (period.y + period.height / 2)),
  ).toBeLessThan(4);
  await expect(
    page.getByTestId("buildOverview").getByTestId("deviceTag"),
  ).toHaveCount(0);
  await expect(page.getByTestId("overviewDevices")).toHaveCount(0);

  for (const tab of [/Changes/, /All screens/, /Accessibility/]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByTestId("buildDevice")).toHaveCount(3);
  }
});

test("shows the features across the whole page with whole names", async ({
  openProjectPage,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await inUkrainian(page);
  const name = "Кредитна сила - Оплата частинами (Точки входу)";
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({
      json: {
        ...overview,
        features: [{ ...overview.features[0], name }, overview.features[1]],
      },
    }),
  );
  await openProjectPage(project.id, build.id, undefined, "overview");
  const features = page.getByTestId("overviewTable");
  const cell = page
    .getByTestId("overviewFeature")
    .filter({ hasText: name })
    .getByTestId("overviewFeatureName")
    .locator("> .MuiTypography-root");
  await expect(cell).toBeVisible();
  // the whole width of the overview, not half of it beside the bugs
  const card = await features.boundingBox();
  const tiles = await page.getByTestId("overviewTile-screens").boundingBox();
  const overviewBox = await page.getByTestId("buildOverview").boundingBox();
  if (!card || !tiles || !overviewBox) throw new Error("not on screen");
  expect(Math.round(card.x)).toBe(Math.round(tiles.x));
  expect(card.width).toBeGreaterThan(overviewBox.width - 60);
  // the name whole: no ellipsis, at most two lines
  expect(
    await cell.evaluate(
      (el) =>
        el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth,
    ),
  ).toBe(true);
  const lineHeight = await cell.evaluate((el) =>
    parseFloat(getComputedStyle(el).lineHeight),
  );
  const height = (await cell.boundingBox())?.height ?? Infinity;
  expect(height).toBeLessThanOrEqual(lineHeight * 2 + 1);
  // the Jira bugs come under the features
  const bugs = await page.getByTestId("overviewBugs").boundingBox();
  expect(bugs?.y ?? 0).toBeGreaterThan(card.y + card.height);
});

test("lists accessibility problems without the device", async ({
  openProjectPage,
  page,
}) => {
  await inUkrainian(page);
  await openProjectPage(project.id, build.id, undefined, "overview");
  const card = page.getByTestId("overviewA11y");
  const rows = page.getByTestId("overviewA11yProblem");
  await expect(rows).toHaveCount(2);
  // the rule, the screen · the element, New or Known; the device is in its card
  await expect(rows.first()).toContainText("Checkout. Pay · Pay");
  await expect(rows.first()).toContainText("Нова");
  await expect(rows.last()).toContainText("Відома");
  await expect(card.getByTestId("deviceTag")).toHaveCount(0);
  await expect(card).not.toContainText("PIXEL_4_XL");
  await expect(card.getByText("Пристрій", { exact: true })).toHaveCount(0);
});

test("shows a result of two parts whole at 1280 px in Ukrainian", async ({
  openProjectPage,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await inUkrainian(page);
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({
      json: {
        ...overview,
        features: [
          {
            ...overview.features[0],
            name: "Pixel 7",
            total: 2,
            changed: 1,
            new: 0,
            passed: 1,
          },
        ],
      },
    }),
  );
  await openProjectPage(project.id, build.id, undefined, "overview");
  const words = page
    .getByTestId("overviewFeature")
    .filter({ hasText: "Pixel 7" })
    .getByTestId("resultWords");
  await expect(words).toHaveText("1 змінений · 1 без змін");
  // nothing hidden behind an ellipsis
  expect(await words.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
});

test("names the result next to its bar", async ({ openProjectPage, page }) => {
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({
      json: {
        ...overview,
        features: [
          ...overview.features,
          {
            ...overview.features[0],
            name: "Payments",
            checks: [],
            total: 2,
            changed: 1,
            new: 1,
            passed: 0,
          },
        ],
      },
    }),
  );
  await openProjectPage(project.id, build.id, undefined, "overview");
  const feature = (name: string) => tableRows(page).filter({ hasText: name });
  await expect(feature("Login").getByTestId("resultWords")).toHaveText(
    "1 changed",
  );
  await expect(feature("Home").getByTestId("resultWords")).toHaveText(
    "1 passed",
  );
  await expect(feature("Payments").getByTestId("resultWords")).toHaveText(
    "1 changed · 1 new",
  );
  await expect(
    page
      .getByTestId("overviewFeature")
      .filter({ hasText: "Checkout" })
      .getByTestId("resultWords"),
  ).toHaveText("1 changed");
  await expect(
    page.getByTestId("overviewFeatureCheck").getByTestId("resultWords"),
  ).toHaveText("1 changed");
  // bars of one width, so the words line up whatever the counts
  const widths = await page
    .getByTestId("resultBar")
    .evaluateAll((bars) =>
      bars.map((bar) => bar.getBoundingClientRect().width),
    );
  expect(new Set(widths)).toEqual(new Set([48]));
});

test("shows a check without a feature as a plain row with its whole name", async ({
  openProjectPage,
  page,
}) => {
  await inUkrainian(page);
  const name =
    "Підписки - Оновлення підписки - доступно для клієнтів із активованою підпискою. e2e: Успішне оновлення підписки (без зміни тарифу) на всіх екранах застосунку";
  await page.route(`${API_URL}/builds/${build.id}/overview`, (route) =>
    route.fulfill({
      json: {
        ...overview,
        features: [overview.features[0], { ...overview.features[1], name }],
      },
    }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await openProjectPage(project.id, build.id, undefined, "overview");
  const table = page.getByTestId("overviewTable");
  // no "No feature" anywhere: a check is just a check (REQ-048-03, SC-048-01)
  await expect(table).not.toContainText("Без функціоналу");
  await expect(page.getByTestId("overviewNoFeature")).toHaveCount(0);
  const row = page.getByTestId("overviewCheck").filter({ hasText: "Підписки" });
  const cell = row.getByTestId("overviewCheckName");
  await expect(cell).toHaveText(name);
  // the whole name, wrapped rather than cut
  expect(
    await cell.evaluate(
      (el) =>
        el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth,
    ),
  ).toBe(true);
  await expect(row.getByTestId("overviewFeatureToggle")).toHaveCount(0);
});

for (const width of [1280, 1440]) {
  test(`shows the build overview tables without cut names at ${width} px in Ukrainian`, async ({
    openProjectPage,
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await inUkrainian(page);
    await openProjectPage(project.id, build.id, undefined, "overview");
    const features = page.getByTestId("overviewTable");
    await expect(tableRows(page)).toHaveCount(4);

    const cut = (locator) =>
      locator.evaluateAll(
        (elements) =>
          elements.filter((el) => el.scrollWidth > el.clientWidth).length,
      );
    // the names are whole, the result's words too
    expect(await cut(features.getByTestId("overviewCheckName"))).toBe(0);
    expect(await cut(features.getByTestId("resultWords"))).toBe(0);
    // the name column keeps room for its header
    const header = features.getByText("Перевірка", { exact: true });
    const result = features.getByText("Результат", { exact: true });
    const a = await header.boundingBox();
    const b = await result.boundingBox();
    expect(a.x + a.width).toBeLessThanOrEqual(b.x);
    // a Jira summary is shown whole
    expect(await cut(page.getByTestId("overviewBug").locator("p"))).toBe(0);

    // a device's tags are whole or folded into +N, never cut mid-word
    const tags = page.getByTestId("buildDevices").getByTestId("deviceTag");
    expect(
      await tags.evaluateAll(
        (elements) =>
          elements.filter(
            (el) =>
              el.querySelector(".MuiChip-label").scrollWidth >
              el.querySelector(".MuiChip-label").clientWidth,
          ).length,
      ),
    ).toBe(0);
  });
}
