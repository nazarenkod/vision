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
  unfoldPanel,
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
  await unfoldPanel(page);
  await expect(rule(page, "id:balance")).toContainText("±5%");
  // where a rule comes from is no chip on its row any more (REQ-074-08, 11)
  await expect(rule(page, "id:balance")).not.toContainText("this check");
  // a rule for every screen that found nothing here waits under "No effect" (REQ-030-23)
  await expect(
    page.getByTestId("outsideGroup").getByTestId("elementRule"),
  ).toHaveText(/id:clock/);
  await expect(rule(page, "id:clock")).toContainText("nothing found");
  // the selector and what it found are in the row's tooltip (REQ-019-02)
  await rule(page, "id:clock").hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "id:clock · 0 found here, 0 on the baseline",
  );
});

test("shows the map and every rule group open, without a summary or a toggle", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, changed);
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  // nothing to unfold and no sentence that repeats the rows (REQ-074-05)
  await expect(page.getByTestId("comparedToggle")).toHaveCount(0);
  await expect(page.getByTestId("comparedSummary")).toHaveCount(0);
  await expect(page.getByText("Comparison scope")).toHaveCount(0);
  await expect(page.getByTestId("toleratedGroup")).toHaveText(
    /^Allows changes/,
  );
  await expect(page.getByTestId("elementRule")).toHaveCount(2);
  // the map stands left of the groups, in a quiet frame (REQ-074-06)
  const map = await page.getByTestId("comparedMap").boundingBox();
  const zones = await page.getByTestId("ignoredGroup").boundingBox();
  expect((map?.x ?? 0) + (map?.width ?? 0)).toBeLessThanOrEqual(zones?.x ?? 0);
  // ignore zones under where they were set, no chip on each (REQ-074-07, 08)
  const groups = page.getByTestId("ignoredGroup");
  await expect(groups).toHaveText(/^Ignore zones/);
  await expect(groups.getByTestId("ignoreZones")).toHaveText([
    /^Sent from the test/,
    /^Added by hand/,
  ]);
  await expect(page.getByTestId("comparedTestArea")).not.toContainText(
    "from the test",
  );
  await expect(page.getByTestId("comparedArea")).not.toContainText("drawn");
});

test("shows the result once, at the top of the Changes tab", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
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

test("lists changes under a plain Changes heading, each marked by how it was seen", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, changed);
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  // the count is on the tab; no heading repeats it (REQ-074-01, 02)
  await expect(page.getByTestId("comparisonVerdict")).toHaveCount(0);
  const list = page.getByTestId("whatChanged");
  await expect(list.getByTestId("changesTitle")).toHaveText("Changes");
  const rows = list.getByTestId("changedArea");
  await expect(rows.getByTestId("changedAreaName")).toHaveText([
    "Next",
    "Balance",
    "2 spots outside elements",
  ]);
  // a square says how the change was seen (REQ-074-03)
  await expect(rows.getByTestId("changeMark")).toHaveCount(3);
  expect(
    await rows
      .getByTestId("changeMark")
      .evaluateAll((marks) => marks.map((mark) => mark.dataset.mark)),
  ).toEqual(["visible", "visible", "loose"]);
  // a changed text in one line: the old word crossed out before the new (REQ-074-04)
  await expect(rows.getByTestId("changedAreaWhat")).toHaveText([
    "Changed in 7 spots",
    "1 200 250",
    "Not part of any element",
  ]);
  const balance = rows.nth(1);
  await expect(balance.getByTestId("changedBefore")).toHaveText("200");
  await expect(balance.getByTestId("changedAfter")).toHaveText("250");
  // the changes come before the rules
  const top = async (testId: string) =>
    (await page.getByTestId(testId).boundingBox())?.y ?? 0;
  expect(await top("whatChanged")).toBeLessThan(await top("whatsCompared"));
});

test("sets each change apart on its own tile", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, changed);
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  const rows = page.getByTestId("changedArea");
  // a tile of its own, a gap to the next, the name in bold (REQ-069-12)
  const first = await rows.nth(0).boundingBox();
  const second = await rows.nth(1).boundingBox();
  const bottom = (first?.y ?? 0) + (first?.height ?? 0);
  expect((second?.y ?? 0) - bottom).toBeGreaterThanOrEqual(6);
  const style = await rows
    .nth(1)
    .evaluate((row) => getComputedStyle(row).backgroundColor);
  expect(style).not.toBe("rgba(0, 0, 0, 0)");
  const weight = await rows
    .nth(1)
    .getByTestId("changedAreaName")
    .evaluate((name) => getComputedStyle(name).fontWeight);
  expect(Number(weight)).toBeGreaterThanOrEqual(600);
});

test("opens a row into its spots, five at a time", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, changed);
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  const next = page.getByTestId("changedArea").first();
  await next.getByTestId("changedAreaToggle").click();
  await expect(next.getByTestId("changedAreaToggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(next.getByTestId("changedPlace")).toHaveCount(5);
  await expect(next.getByTestId("changedPlace").first()).toHaveText(
    "area 50 × 20 px",
  );
  await next.getByTestId("changedPlacesMore").click();
  await expect(next.getByTestId("changedPlace")).toHaveCount(7);
  await next.getByTestId("changedAreaToggle").click();
  await expect(next.getByTestId("changedPlace")).toHaveCount(0);
});

test("names a changed place by the text in it, as it was and is", async ({
  openProjectPage,
  page,
}) => {
  const card = 'View "Card"';
  const cardBox = { x: 0, y: 1800, width: 1080, height: 400 };
  const balance = { x: 40, y: 1900, width: 400, height: 60 };
  await withStructure(page, {
    ...changed,
    regions: [
      {
        region: { x: 50, y: 1910, width: 120, height: 40 },
        key: "card",
        element: card,
        resourceId: null,
      },
    ],
    changes: [],
    elements: [
      { selector: "id:card", element: card, bounds: cardBox },
      {
        selector: "id:balance",
        element: 'TextView "9 870,00 ₴"',
        bounds: balance,
        text: "9 870,00 ₴",
      },
    ],
    baselineElements: [
      {
        selector: "id:balance",
        element: 'TextView "12 450,00 ₴"',
        bounds: balance,
        text: "12 450,00 ₴",
      },
    ],
  });
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  // one place whose text changed says so instead of "Changed in 1 spot" (REQ-038-04)
  await expect(page.getByTestId("changedBefore")).toHaveText("12 450,00");
  await expect(page.getByTestId("changedAfter")).toHaveText("9 870,00");
  await expect(page.getByTestId("changedAreaName")).toHaveText("Card");
});

test("shows a change the pixels miss once, as before and after", async ({
  openProjectPage,
  page,
}) => {
  const label = {
    kind: "label" as const,
    key: "top-up",
    element: 'Button "Зі своєї картки *8352 +3.00 UAH 11 серпн"',
    resourceId: "com.bank:id/activity_list_item",
    before: "Зі своєї картки *8353 +5.00 UAH 11 серпня, 11:25",
    after: "Зі своєї картки *8352 +3.00 UAH 11 серпня, 11:25",
    bounds: { x: 0, y: 1200, width: 1080, height: 120 },
  };
  const disabled = {
    kind: "state" as const,
    key: "pay",
    element: 'Button "Pay"',
    resourceId: "com.bank:id/pay",
    before: "enabled",
    after: "disabled",
    bounds: { x: 0, y: 1400, width: 1080, height: 120 },
  };
  await withStructure(page, {
    ...structure,
    size: { width: 1080, height: 2400 },
    // a change the pixels show too, so the rows need telling apart
    regions: [
      {
        region: { x: 0, y: 100, width: 50, height: 20 },
        key: "next",
        element: 'Button "Next"',
        resourceId: null,
      },
    ],
    changes: [label, disabled],
    invisible: [label, disabled],
  });
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  // no strip: the changes are the rows, each marked by how it was seen (REQ-069-01, REQ-074-03)
  await expect(page.getByTestId("invisibleStrip")).toHaveCount(0);
  const rows = page.getByTestId("changedArea");
  await expect(rows).toHaveCount(3);
  expect(
    await rows
      .getByTestId("changeMark")
      .evaluateAll((marks) => marks.map((mark) => mark.dataset.mark)),
  ).toEqual(["visible", "invisible", "invisible"]);
  const first = rows.nth(1);
  await expect(first.getByTestId("changedBefore")).toHaveText("*8353 +5.00");
  await expect(first.getByTestId("changedAfter")).toHaveText("*8352 +3.00");
  // a change that is not a text keeps its own line, and the mark (REQ-069-06)
  await expect(rows.nth(2).getByTestId("changedAreaWhat")).toHaveText(
    "State: enabled → disabled",
  );
});

test("marks every row the pixels miss, without a strip", async ({
  openProjectPage,
  page,
}) => {
  const label = {
    kind: "label" as const,
    key: "top-up",
    element: 'Button "Top up"',
    resourceId: "com.bank:id/activity_list_item",
    before: "From card *8353 +5.00",
    after: "From card *8352 +3.00",
    bounds: { x: 0, y: 1200, width: 1080, height: 120 },
  };
  await withStructure(page, {
    ...structure,
    size: { width: 1080, height: 2400 },
    changes: [label],
    invisible: [label],
  });
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  // the square says it on the row itself (REQ-074-03)
  await expect(page.getByTestId("invisibleStrip")).toHaveCount(0);
  await expect(page.getByTestId("changedArea")).toHaveCount(1);
  await expect(page.getByTestId("changeMark")).toHaveAttribute(
    "data-mark",
    "invisible",
  );
});

test("leaves the strip out when the pixels show every change", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, changed);
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  await expect(page.getByTestId("whatChanged")).toBeVisible();
  await expect(page.getByTestId("invisibleStrip")).toHaveCount(0);
  await expect(page.locator('[data-mark="invisible"]')).toHaveCount(0);
});

test("lists rows outside the compared elements muted, under No effect", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, compareOnly());
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  await expect(page.getByTestId("comparedSummary")).toHaveCount(0);
  await expect(page.getByTestId("comparedElement")).toContainText(
    'Button "Pay"',
  );
  // the run's drawn and test areas lie above the button: they change nothing
  await expect(page.getByTestId("outsideGroup")).toHaveText(/^No effect/);
  await expect(page.getByTestId("comparedArea")).toHaveAttribute(
    "data-effect",
    "outside",
  );
  await expect(page.getByTestId("comparedTestArea")).toBeVisible();
});

test("explains why the rows under No effect do not count", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, compareOnly());
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  // one hover away, not a sentence in the panel
  await page.getByTestId("outsideGroup").getByText("No effect").hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "They lie outside the chosen elements, so they change nothing.",
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
  await unfoldPanel(page);
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
  await unfoldPanel(page);
  const area = page.getByTestId("comparedTestArea");
  // its group says where it comes from (REQ-074-08)
  await expect(
    page.getByTestId("ignoreZones").filter({ has: area }),
  ).toHaveText(/^Sent from the test/);
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
  await unfoldPanel(page);
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
  await unfoldPanel(page);
  await rule(page, "id:balance").hover();
  await rule(page, "id:balance")
    .getByRole("button", { name: "Remove rule" })
    .click();
  await expect(page.getByText("Rule removed; compared again")).toBeVisible();
  expect(removed).toEqual([{ scope: "screen", ruleId: "balance" }]);
  await expect(
    page.getByRole("dialog", { name: "Remove a rule for every check?" }),
  ).toHaveCount(0);
});

test("asks before removing a rule for every screen", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  // it found nothing here, so it waits under "No effect"
  const remove = rule(page, "id:clock").getByRole("button", {
    name: "Remove rule",
  });
  await rule(page, "id:clock").hover();
  const confirm = page.getByRole("dialog", {
    name: "Remove a rule for every check?",
  });

  await remove.click();
  await expect(confirm).toContainText("id:clock");
  await expect(confirm).toContainText("every check of the project");
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
  await unfoldPanel(page);
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
  await unfoldPanel(page);
  await expect.poll(width).toBe(540);

  // a double click on the edge gives the usual width back
  await page.getByTestId("panelResize").dblclick();
  await expect.poll(width).toBe(420);
});

// a rule saved before Vision stopped running back-references and look-around finds nothing,
// and its row says why (051, REQ-051-12)
test("says why a rule with a pattern Vision no longer runs finds nothing", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(page, {
    ...structure,
    rules: [
      ...structure.rules,
      {
        id: "old",
        selector: "text:/(Pay)\\1/",
        action: "ignore",
        scope: "screen",
        matches: 0,
        problem: "pattern",
      },
    ],
  });
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  await expect(rule(page, "text:/(Pay)\\1/")).toContainText(
    "back-reference, look-around or another part Vision does not run",
  );
  // the other rules read as before
  await expect(rule(page, "id:clock")).toContainText("nothing found");
  await expect(rule(page, "id:balance")).toContainText("±5%");
});

// a variable text: "Зі своєї картки *1051 +1.05 UAH" whose number may change (spec 033, 073)
const row = { x: 0, y: 1200, width: 1080, height: 120 };
const variableText = (
  now: string,
  ok: boolean,
  baseline = "Зі своєї картки *1051 +1.05 UAH",
): StructureInfo => ({
  ...structure,
  hasUiTree: true,
  hasBaselineUiTree: true,
  size: { width: 1080, height: 2400 },
  rules: [
    {
      id: "card",
      selector: "id:card_row",
      action: "variable",
      scope: "screen",
      matches: 1,
      found: { current: [row], baseline: [row] },
      parts: [
        { text: "Зі своєї картки *" },
        { pattern: "\\d{4}", sample: "1051" },
        { text: " +1.05 UAH" },
      ],
      check: {
        items: [
          {
            text: now,
            ok,
            reason: ok ? undefined : "pattern",
            bounds: row,
            element: `TextView «${now}»`,
          },
        ],
        gone: false,
        overridden: false,
      },
    },
  ],
  elements: [
    {
      selector: "id:card_row",
      element: `TextView «${now}»`,
      bounds: row,
      text: now,
    },
  ],
  baselineElements: [
    {
      selector: "id:card_row",
      element: `TextView «${baseline}»`,
      bounds: row,
      text: baseline,
    },
  ],
  variableProblems: ok
    ? []
    : [
        {
          ruleId: "card",
          kind: "failed",
          element: `TextView «${now}»`,
          text: now,
          reason: "pattern",
          bounds: row,
        },
      ],
});

test("a variable text that holds shows a tick, one that broke turns red without the help box", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(
    page,
    variableText("Зі своєї картки *2122 +1.05 UAH", true),
  );
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  const text = page.getByTestId("variableRule");
  // what it was, crossed out, before what it is (REQ-074-10)
  await expect(text.getByTestId("variableWas")).toHaveText("1051");
  await expect(text.getByTestId("variableNow")).toHaveText(
    "Зі своєї картки *1051 2122 +1.05 UAH",
  );
  // a tick instead of words, and no chip saying where the rule comes from (REQ-074-11)
  await expect(text.getByTestId("variableHolds")).toBeVisible();
  await expect(text).not.toContainText("fits");
  await expect(text).not.toContainText("this check");

  await withStructure(
    page,
    variableText("Зі своєї картки *XXXX +1.05 UAH", false),
  );
  await page.reload();
  await unfoldPanel(page);
  // one short line on top, the row red with what was expected (REQ-074-12, 13)
  await expect(page.getByTestId("verdictTitle")).toHaveText(
    "The variable text changed shape",
  );
  await expect(page.getByTestId("verdictReason")).toHaveCount(0);
  await expect(text).toHaveAttribute("data-state", "failed");
  await expect(text.getByTestId("variableHolds")).toHaveCount(0);
  await expect(text.getByTestId("variableExpected")).toHaveText(
    "expected “Зі своєї картки *1051 +1.05 UAH”",
  );
  // no help box under it (REQ-074-14)
  await expect(page.getByTestId("variableProblem")).toHaveCount(0);
  await expect(page.getByText(/If it is a bug/)).toHaveCount(0);
  // the bug button comes forward (REQ-074-21)
  await expect(page.getByTestId("reportBug")).toHaveAttribute(
    "data-stands-out",
    "true",
  );
});

test("the menu of a variable text edits, shows and removes its rule", async ({
  openProjectPage,
  page,
}) => {
  await withStructure(
    page,
    variableText("Зі своєї картки *2122 +1.05 UAH", true),
  );
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  const menu = page.getByTestId("variableMenu");
  await menu.click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Change rule",
    "Show on screenshot",
    "Remove rule",
  ]);
  // the element opens with its rule, as a click on it does (REQ-074-15)
  await page.getByTestId("variableEdit").click();
  await expect(page.getByTestId("elementPopover")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("elementPopover")).toHaveCount(0);

  await menu.click();
  await page.getByTestId("variableRemove").click();
  await expect(page.getByText("Rule removed; compared again")).toBeVisible();
  expect(removed).toEqual([{ scope: "screen", ruleId: "card" }]);
});

test("shows one card instead of the list when most of the screen changed", async ({
  openProjectPage,
  page,
}) => {
  await mockTestRun(page, { ...testRun, diffPercent: 47.4 });
  await mockGetTestRuns(page, build.id, [{ ...testRun, diffPercent: 47.4 }]);
  await withStructure(page, changed);
  await openProjectPage(project.id, build.id, testRun.id);
  await unfoldPanel(page);
  // one number, not a long list (REQ-074-30)
  const card = page.getByTestId("mostOfScreen");
  await expect(card).toContainText("47 %");
  await expect(card).toContainText("Most of the screen changed");
  await expect(card).toContainText("4 changes");
  await expect(page.getByTestId("whatChanged")).toHaveCount(0);
  await expect(page.getByTestId("reportBug")).toHaveAttribute(
    "data-stands-out",
    "true",
  );
  // the list is one click away (REQ-074-31)
  await card.getByTestId("showAllChanges").click();
  await expect(page.getByTestId("mostOfScreen")).toHaveCount(0);
  await expect(page.getByTestId("changedArea")).toHaveCount(3);
});
