import { expect, Request } from "@playwright/test";
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

const project = TEST_PROJECT;
const build = TEST_BUILD_FAILED;
const run = { ...TEST_UNRESOLVED, hasUiTree: true };

const bounds = { x: 0, y: 2200, width: 100, height: 100 };
const tab = (index: number) => ({
  id: `touch-target|id:com.bank:id/tab_${index}`,
  rule: "touch-target",
  severity: "warning",
  title: "Touch target too small",
  message: `Tab ${index + 1} is 38 × 38 dp, minimum is 48 × 48 dp.`,
  nodeKey: `id:com.bank:id/tab_${index}`,
  resourceId: `com.bank:id/tab_${index}`,
  className: "android.widget.ImageButton",
  label: `Tab ${index + 1}`,
  bounds,
  status: "new",
  group: "touch-target|tab",
});
const icon = {
  ...tab(0),
  id: "missing-label|id:com.bank:id/icon",
  rule: "missing-label",
  severity: "error",
  title: "Missing label",
  message: "Clickable image has no label.",
  resourceId: "com.bank:id/icon",
  group: "missing-label|icon",
  knownBug: { jiraKey: "MOB-7", jiraUrl: null, screenName: "Payments" },
};
const report = {
  format: "appium-android",
  pixelsPerDp: 2.6,
  pixelsPerDpEstimated: false,
  baselineChecked: true,
  summary: { new: 2, existing: 0, reported: 0, ignored: 0, fixed: 0, total: 3 },
  violations: [tab(0), tab(1), icon],
  ignored: [],
  fixed: [],
  resolved: [],
};

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, [run]);
  await mockTestRun(page, run);
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
  await page.route(`${API_URL}/test-runs/${run.id}/a11y`, (route) =>
    route.fulfill({ body: JSON.stringify(report) }),
  );
});

const posted = (request: Request) => JSON.parse(request.postData() ?? "{}");

// Two tabs of one tab bar too small is one fix, so it is one card and one bug,
// not two bugs a developer closes as duplicates of each other.
test("shows one problem for the same issue on elements of one component", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, run.id);
  const problems = page.getByTestId("a11yProblem");

  await expect(problems).toHaveCount(2);
  await expect(problems.first()).toContainText(
    "The same issue on 2 elements of tab",
  );
  await expect(problems.first()).toContainText("Tab 2 is 38 × 38 dp");

  const ignore = page.waitForRequest(
    `${API_URL}/test-runs/${run.id}/a11y/ignore`,
  );
  await problems
    .first()
    .getByRole("button", { name: "False positive" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Mark as false positive" })
    .click();
  expect(posted(await ignore).violationIds).toEqual([tab(0).id, tab(1).id]);
});

// The same problem filed from another screen is linked, not filed again.
test("offers the bug filed for the same problem on another screen", async ({
  openProjectPage,
  page,
}) => {
  await page.route(`${API_URL}/test-runs/${run.id}/a11y/link`, (route) =>
    route.fulfill({ status: 201, body: "{}" }),
  );
  await openProjectPage(project.id, build.id, run.id);
  const known = page.getByTestId("a11yProblem").nth(1);

  await expect(known).toContainText(
    "Filed already as MOB-7 on screen “Payments”",
  );
  const link = page.waitForRequest(`${API_URL}/test-runs/${run.id}/a11y/link`);
  await known.getByRole("button", { name: "Link to MOB-7" }).click();
  expect(posted(await link)).toMatchObject({
    violationIds: [icon.id],
    jiraKey: "MOB-7",
  });
});
