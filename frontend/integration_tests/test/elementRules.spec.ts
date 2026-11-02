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
let added: Array<Record<string, unknown>>;

test.beforeEach(async ({ page }) => {
  removed = [];
  added = [];
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
  await page.route(
    `${API_URL}/test-runs/${testRun.id}/element-rules`,
    (route) => {
      const body = route.request().postDataJSON();
      added.push(body);
      return route.fulfill({ body: JSON.stringify({ id: "again", ...body }) });
    },
  );
});

const withStructure = (page: Page, value: StructureInfo) =>
  page.route(`${API_URL}/test-runs/${testRun.id}/structure`, (route) =>
    route.fulfill({ body: JSON.stringify(value) }),
  );

// the pay button at the bottom; the run's drawn and test areas lie above it
const pay = { x: 40, y: 2200, width: 1000, height: 120 };
const compareOnly = (
  problems: NonNullable<StructureInfo["compareOnly"]>["problems"] = [],
): StructureInfo => ({
  ...structure,
  hasUiTree: true,
  hasBaselineUiTree: true,
  rules: [
    {
      id: "pay",
      selector: "id:btn_pay",
      action: "compare",
      scope: "screen",
      matches: 1,
      found: { current: [pay], baseline: [pay] },
    },
  ],
  compareOnly: {
    active: true,
    keep: [pay],
    problems,
    compared: [{ ruleId: "pay", element: 'Button "Pay"', bounds: pay }],
  },
  size: { width: 1080, height: 2400 },
});

const rule = (page: Page, selector: string) =>
  page.getByTestId("elementRule").filter({ hasText: selector });

test("lists the rules for this screen and for every screen", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  await expect(rule(page, "id:balance")).toContainText("±5%");
  await expect(rule(page, "id:balance")).toContainText("this screen");
  // a rule for every screen that found nothing here is folded away (REQ-030-23)
  await expect(page.getByTestId("elementRule")).toHaveCount(1);
  await page.getByTestId("outsideToggle").click();
  await expect(rule(page, "id:clock")).toContainText("all screens");
  await expect(rule(page, "id:clock")).toContainText("nothing found");
  // the selector and what it found are in the row's tooltip (REQ-019-02)
  await rule(page, "id:clock").hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "id:clock · 0 found here, 0 on the baseline",
  );
  // a rule that found nothing changes nothing in the summary; the run's saved and test areas count
  await expect(page.getByTestId("comparedSummary")).toHaveText(
    "Whole screen, with exceptions",
  );
});

test("shows the result once, at the top of the Changes tab", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  // the run has a diff, but nothing the panel can name in it
  await expect(page.getByTestId("verdictTitle")).toHaveText("Changed");
  await expect(page.getByTestId("verdictReason")).toHaveText(
    "No details about this change.",
  );
  await expect(
    page.getByText("Nothing changed against the baseline."),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Status and navigation bars are left out/),
  ).toHaveCount(0);
  const top = async (testId: string) =>
    (await page.getByTestId(testId).boundingBox())?.y ?? 0;
  expect(await top("comparisonVerdict")).toBeLessThan(
    await top("whatsCompared"),
  );
});

const changed: StructureInfo = {
  ...structure,
  size: { width: 1080, height: 2400 },
  regions: [
    ...[100, 130, 160, 190, 220, 250, 280].map((y) => ({
      region: { x: 0, y, width: 50, height: 20 },
      key: "a",
      element: 'Button "Next"',
      resourceId: null,
    })),
    {
      region: { x: 0, y: 900, width: 80, height: 40 },
      key: null,
      element: null,
      resourceId: null,
    },
    {
      region: { x: 1000, y: 900, width: 80, height: 40 },
      key: null,
      element: null,
      resourceId: null,
    },
  ],
  changes: [
    {
      kind: "text",
      key: "balance",
      element: 'TextView "Balance"',
      resourceId: "com.bank:id/balance",
      before: "1 200",
      after: "1 250",
      bounds: { x: 0, y: 400, width: 300, height: 40 },
    },
  ],
};

test("says the count once and lists the changes straight under it", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, changed);
  await openProjectPage(project.id, build.id, testRun.id);
  // each spot outside the elements counts, as before (REQ-036-16)
  await expect(page.getByTestId("verdictTitle")).toHaveText("4 changes");
  await expect(page.getByTestId("verdictReason")).toHaveCount(0);
  const list = page.getByTestId("whatChanged");
  await expect(list).not.toContainText("What changed");
  await expect(list).not.toContainText("4");
  const rows = list.getByTestId("changedArea");
  await expect(rows.getByTestId("changedAreaName")).toHaveText([
    "Next",
    "Balance",
    "2 spots outside elements",
  ]);
  await expect(rows.getByTestId("changedAreaWhat")).toHaveText([
    "Changed in 7 spots",
    "Text: “1 200” → “1 250”",
    "Not part of any element",
  ]);
  // headings read as sentences, not capitals (REQ-036-30)
  await expect(page.getByText("Comparison scope")).toHaveText(
    "Comparison scope",
    { useInnerText: true },
  );
});

test("opens a row into its spots, five at a time", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, changed);
  await openProjectPage(project.id, build.id, testRun.id);
  const next = page.getByTestId("changedArea").first();
  await next.getByTestId("changedAreaToggle").click();
  await expect(next.getByTestId("changedAreaToggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(next.getByTestId("changedPlace")).toHaveCount(5);
  await expect(next.getByTestId("changedPlace").first()).toHaveText(
    "50 × 20 px, top left",
  );
  await next.getByTestId("changedPlacesMore").click();
  await expect(next.getByTestId("changedPlace")).toHaveCount(7);
  await next.getByTestId("changedAreaToggle").click();
  await expect(next.getByTestId("changedPlace")).toHaveCount(0);
});

test("folds the comparison scope while there are changes to look at", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, changed);
  await openProjectPage(project.id, build.id, testRun.id);
  const toggle = page.getByTestId("comparedToggle");
  await expect(toggle).toContainText("Comparison scope");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("elementRule")).toHaveCount(0);
  await toggle.click();
  await expect(page.getByTestId("elementRule")).toHaveCount(1);
  await expect(page.getByTestId("toleratedGroup")).toHaveText(
    /^Allows changes/,
  );
  await expect(page.getByTestId("toleratedGroup")).not.toContainText("· 1");
});

test("keeps rows outside the compared elements folded", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, compareOnly());
  await openProjectPage(project.id, build.id, testRun.id);
  await expect(page.getByTestId("comparedSummary")).toHaveText(
    "Only the chosen elements",
  );
  await expect(page.getByTestId("comparedElement")).toContainText(
    'Button "Pay"',
  );
  // the run's drawn and test areas lie above the button: they change nothing
  // the group's name carries no count (REQ-036-33)
  await expect(page.getByTestId("outsideToggle")).toHaveText(
    "No effectoutside what is compared",
  );
  await expect(page.getByTestId("comparedArea")).toHaveCount(0);
  await expect(page.getByTestId("comparedTestArea")).toHaveCount(0);
});

test("explains why the folded rows do not count", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, compareOnly());
  await openProjectPage(project.id, build.id, testRun.id);
  await page.getByTestId("outsideToggle").click();
  await expect(page.getByTestId("outsideGroup")).toContainText(
    "They lie outside the chosen elements, so they change nothing.",
  );
  await expect(page.getByTestId("comparedArea")).toHaveAttribute(
    "data-effect",
    "outside",
  );
  await expect(page.getByTestId("comparedTestArea")).toContainText(
    "from the test",
  );
});

test("removes a gone element from what is compared, with Undo", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(
    page,
    compareOnly([
      {
        kind: "disappeared",
        ruleId: "pay",
        selector: "id:btn_pay",
        element: 'Button "Pay"',
      },
    ]),
  );
  await openProjectPage(project.id, build.id, testRun.id);
  await expect(page.getByTestId("verdictTitle")).toHaveText(
    "One of the chosen elements is gone",
  );
  await expect(page.getByTestId("comparedState")).toHaveText("gone");

  await page.getByTestId("removeFromCompared").click();
  await expect(
    page.getByText("Removed from what is compared; compared again"),
  ).toBeVisible();
  expect(removed).toEqual([{ scope: "screen", ruleId: "pay" }]);

  await page.getByTestId("undoRule").click();
  await expect
    .poll(() => added)
    .toEqual([{ scope: "screen", selector: "id:btn_pay", action: "compare" }]);
});

test("lights an area the test sent on the screenshot until clicked again", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  const area = page.getByTestId("comparedTestArea");
  // where it comes from, and nothing more
  await expect(area).toContainText("from the test");
  await expect(area).not.toContainText("test code");
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
  // it found nothing here, so it waits under "No effect"
  await page.getByTestId("outsideToggle").click();
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
