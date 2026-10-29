import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import { StructureInfo } from "~client/types";
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
const testRun = TEST_UNRESOLVED;

const structure: StructureInfo = {
  hasUiTree: false,
  hasBaselineUiTree: false,
  changes: [],
  regions: [],
  hints: [],
  invisible: [],
  rules: [
    {
      id: "balance",
      selector: "id:balance",
      action: "tolerate",
      maxDiffPercent: 5,
      scope: "screen",
      matches: 1,
    },
    // a rule for every screen that finds nothing here is still listed
    {
      id: "clock",
      selector: "id:clock",
      action: "ignore",
      scope: "project",
      matches: 0,
    },
  ],
  ignoredAreas: [],
  toleratedAreas: [],
  systemBars: [],
  moves: [],
  settings: null as unknown as StructureInfo["settings"],
};

let removed: Array<{ scope: string; ruleId: string }>;

test.beforeEach(async ({ page }) => {
  removed = [];
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, [testRun]);
  await mockTestRun(page, testRun);
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
  await page.route(`${API_URL}/test-runs/${testRun.id}/structure`, (route) =>
    route.fulfill({ body: JSON.stringify(structure) }),
  );
  await page.route(
    `${API_URL}/test-runs/${testRun.id}/element-rules/remove`,
    (route) => {
      removed.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, body: "" });
    },
  );
});

const rule = (page: Page, selector: string) =>
  page.getByTestId("elementRule").filter({ hasText: selector });

test("lists the rules for this screen and for every screen", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  await expect(page.getByTestId("elementRule")).toHaveCount(2);
  await expect(rule(page, "id:balance")).toContainText("±5%");
  await expect(rule(page, "id:balance")).not.toContainText("all screens");
  await expect(rule(page, "id:clock")).toContainText("all screens");
  // the selector and what it found are in the row's tooltip (REQ-019-02)
  await rule(page, "id:clock").hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "id:clock · 0 found here, 0 on the baseline",
  );
  // a rule that found nothing changes nothing in the summary; the run's saved and test areas count
  await expect(page.getByTestId("comparedSummary")).toHaveText(
    "Whole screen · without 2 areas",
  );
});

test("opens an area of the summary in the Areas menu", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  const areas = page.getByTestId("comparedArea");
  await expect(areas).toHaveCount(2);
  await expect(areas.last()).toContainText("Sent by the test");
  await areas.first().click();
  await expect(page.getByTestId("areasMenu")).toBeVisible();
  // the drawn area is chosen there, ready to delete or move
  await expect(page.getByTestId("areaDelete")).toBeEnabled();
});

test("removes a rule for this screen at once", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  await rule(page, "id:balance").hover();
  await rule(page, "id:balance")
    .getByRole("button", { name: "Remove rule" })
    .click();
  await expect(page.getByText("Rule removed; compared again")).toBeVisible();
  expect(removed).toEqual([{ scope: "screen", ruleId: "balance" }]);
  await expect(
    page.getByRole("dialog", { name: "Remove a rule for every screen?" }),
  ).toHaveCount(0);
});

test("asks before removing a rule for every screen", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  const remove = rule(page, "id:clock").getByRole("button", {
    name: "Remove rule",
  });
  await rule(page, "id:clock").hover();
  const confirm = page.getByRole("dialog", {
    name: "Remove a rule for every screen?",
  });

  await remove.click();
  await expect(confirm).toContainText("id:clock");
  await expect(confirm).toContainText("every screen of the project");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);
  expect(removed).toEqual([]);

  await remove.click();
  await confirm.getByRole("button", { name: "Remove rule" }).click();
  await expect(page.getByText("Rule removed; compared again")).toBeVisible();
  expect(removed).toEqual([{ scope: "project", ruleId: "clock" }]);
});
