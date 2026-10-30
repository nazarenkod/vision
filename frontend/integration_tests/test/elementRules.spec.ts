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

test("lights an area the test sent on the screenshot until clicked again", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  // a heading and nothing more
  await expect(page.getByTestId("comparedTestAreas")).toContainText(
    "Sent by the test",
  );
  await expect(page.getByTestId("comparedTestAreas")).not.toContainText(
    "test code",
  );
  const area = page.getByTestId("comparedTestArea");
  await area.click();
  await expect(area).toHaveAttribute("aria-pressed", "true");
  // it shows where the area is; it opens nothing and starts no selecting
  await expect(page.getByTestId("areasMenu")).toHaveCount(0);
  await expect(page.getByTestId("selectElements")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  // the Areas menu lights the same one
  await page.getByTestId("areasButton").click();
  const inMenu = page.getByTestId("areaRow").filter({ hasText: "600 × 700" });
  await expect(inMenu).toHaveAttribute("aria-pressed", "true");
  // a second click there puts the light out, in both places
  await inMenu.click();
  await expect(inMenu).toHaveAttribute("aria-pressed", "false");
  await expect(area).toHaveAttribute("aria-pressed", "false");
});

test("opens an area of the summary in the Areas menu", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  // a drawn area opens in the Areas menu, chosen there, ready to delete or move
  await page.getByTestId("comparedArea").click();
  await expect(page.getByTestId("areasMenu")).toBeVisible();
  await expect(page.getByTestId("areaDelete")).toBeEnabled();
  await expect(page.getByTestId("selectElements")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
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

test("widens the side panel by its edge and remembers the width", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  const panel = page.locator("aside").last();
  const width = async () => (await panel.boundingBox())?.width ?? 0;
  await expect.poll(width).toBe(420);

  // the edge moves left, the panel grows by as much
  const edge = await page.getByTestId("panelResize").boundingBox();
  if (!edge) throw new Error("no edge");
  const y = edge.y + edge.height / 2;
  await page.mouse.move(edge.x + edge.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(edge.x + edge.width / 2 - 120, y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(width).toBe(540);

  // this browser keeps it
  await page.reload();
  await expect.poll(width).toBe(540);

  // a double click on the edge gives the usual width back
  await page.getByTestId("panelResize").dblclick();
  await expect.poll(width).toBe(420);
});
