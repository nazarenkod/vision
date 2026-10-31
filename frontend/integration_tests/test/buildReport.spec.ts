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
import { BuildOverview, PublicReport } from "~client/types/buildOverview";
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

const fullReport = (): PublicReport => ({
  state: "ok",
  createdBy: "Anna Petrenko",
  overview,
  changes: [
    {
      testRunId: "pay",
      name: "Checkout. Pay",
      device: "PIXEL_4_XL",
      os: "AOS 14",
      status: "unresolved",
      diffPercent: 4.87,
      imageName: "image.png",
      baselineName: "baseline.png",
      diffName: "diff.png",
    },
  ],
  moreChanges: 0,
  a11y: [
    {
      testRunId: "pay",
      name: "Checkout. Pay",
      device: "PIXEL_4_XL",
      newCount: 2,
    },
  ],
});

test("previews the report as settings change", async ({
  openProjectPage,
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route(`${API_URL}/builds/${build.id}/report`, (route) =>
    route.fulfill({ json: fullReport() }),
  );
  await page.route(`${API_URL}/builds/${build.id}/report-links`, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          json: {
            id: "l1",
            token: "tok-123",
            sections: ["sum", "chg", "bugs"],
            language: "en",
            createdBy: "Anna Petrenko",
            createdById: "1",
            createdAt: "2026-10-31T11:05:00Z",
            expiresAt: "2026-11-30T11:05:00Z",
          },
        })
      : route.fulfill({ json: [] }),
  );
  await openProjectPage(project.id, build.id, undefined, "overview");
  await page.getByTestId("openReport").click();

  const sections = page.getByTestId(/^reportSection-/);
  await expect(sections).toHaveCount(3);
  await page.getByTestId("segment-full").click();
  await expect(sections).toHaveCount(6);
  await page.getByTestId("reportOption-dev").click();
  await expect(sections).toHaveCount(5);

  await page.getByTestId("segment-uk").click();
  await expect(page.getByTestId("reportDocument")).toContainText("Звіт збірки");
  // the interface keeps its language
  await expect(page.getByRole("button", { name: /Slack text/ })).toBeVisible();

  await page.getByTestId("copySlackText").click();
  const slack = await page.evaluate(() => navigator.clipboard.readText());
  expect(slack).toContain(
    "*Mobile Shop · #128 · release/7.4* — Чекає на перегляд",
  );

  await page.getByTestId("copyReportLink").click();
  await expect(page.getByTestId("reportLink")).toHaveCount(1);
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/r\/tok-123$/);
});

test("prints the report on A4 pages with the chosen sections and language", async ({
  openProjectPage,
  page,
}) => {
  await page.route(`${API_URL}/builds/${build.id}/report`, (route) =>
    route.fulfill({ json: fullReport() }),
  );
  await page.addInitScript(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed += 1;
    };
  });
  // signs in, then opens what the PDF button opens
  await openProjectPage(project.id);
  await page.goto(`/report/${build.id}?sections=sum,dev&lang=uk`);

  await expect(page.getByTestId("reportDocument")).toContainText("Звіт збірки");
  await expect(page.getByTestId(/^reportSection-/)).toHaveCount(2);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { printed: number }).printed),
    )
    .toBe(1);
  // the sheet alone: no header or navigation on paper
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
