import { expect, Locator, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import { StructureInfo, TestRun } from "~client/types";
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

// The comparison laid out as the approved mock-up (spec 046, REQ-046-01…07).
const project = { ...TEST_PROJECT, jiraUrl: "https://jira" };
test.use({ userJiraToken: true });
const build = TEST_BUILD_FAILED;
// a phone, as in the mock-up
const run: TestRun = {
  ...TEST_UNRESOLVED,
  device: "Pixel 4 XL",
  os: "Android 14",
  browser: null,
  viewport: null,
  customTags: null,
} as unknown as TestRun;
// no tolerance: only the changed share is said
const strict: TestRun = {
  ...run,
  id: "strict",
  name: "Strict",
  diffTollerancePercent: 0,
};
// the baseline is smaller than Current
const resized: TestRun = {
  ...run,
  id: "resized",
  name: "Resized",
  baselineName: "small.svg",
};

const nothing: StructureInfo = {
  hasUiTree: false,
  hasBaselineUiTree: false,
  changes: [],
  regions: [],
  hints: [],
  invisible: [],
  rules: [],
  ignoredAreas: [],
  toleratedAreas: [],
  systemBars: [],
  moves: [],
  settings: null,
} as unknown as StructureInfo;
const changed: StructureInfo = {
  ...nothing,
  regions: [
    {
      region: { x: 10, y: 20, width: 200, height: 60 },
      key: null,
      element: null,
      resourceId: null,
    },
  ],
};

const mockApi = async (page: Page, structure: StructureInfo = changed) => {
  const runs = [run, strict, resized];
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, runs);
  for (const item of runs) {
    await mockTestRun(page, item);
    await page.route(`${API_URL}/test-runs/${item.id}/structure`, (route) =>
      route.fulfill({ body: JSON.stringify(structure) }),
    );
    await page.route(`${API_URL}/test-runs/${item.id}/bugs`, (route) =>
      route.fulfill({ body: "[]" }),
    );
  }
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
  await page.route(
    (url) => url.origin === API_URL && url.pathname === "/images/small.svg",
    (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#ccc"/></svg>',
      }),
  );
};

const middle = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not on screen");
  return box.y + box.height / 2;
};

test("groups the comparison toolbar in one row", async ({
  openProjectPage,
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockApi(page);
  await openProjectPage(project.id, build.id, run.id);

  const toolbar = page.getByTestId("compareToolbar");
  const groups = [
    "toolbarDevices",
    "toolbarMeter",
    "toolbarView",
    "toolbarTools",
  ].map((id) => toolbar.getByTestId(id));
  await expect(groups[0].getByTestId("deviceTag").first()).toBeVisible();
  await expect(groups[1].getByTestId("diffMeter")).toBeVisible();
  await expect(
    groups[2].getByRole("button", { name: "Side by side" }),
  ).toBeVisible();
  await expect(
    groups[2].getByRole("button", { name: "Overlay" }),
  ).toBeVisible();
  await expect(groups[2].getByRole("button", { name: "Fade" })).toBeVisible();
  await expect(
    groups[2].getByRole("checkbox", { name: "Highlight diff" }),
  ).toBeChecked();
  await expect(groups[3].getByTestId("selectElements")).toBeVisible();
  await expect(groups[3].getByTestId("areasButton")).toBeVisible();

  // one row, a line between the device, the share and the view; the tools
  // stand apart on the right
  const rows = new Set(
    await Promise.all(
      groups.map(async (group) => Math.round(await middle(group))),
    ),
  );
  expect(rows.size).toBe(1);
  await expect(toolbar.locator(".MuiDivider-vertical")).toHaveCount(2);

  // nothing it replaced is left beside it
  await expect(page.getByTestId("diffMeter")).toHaveCount(1);
  await expect(page.getByTestId("selectElements")).toHaveCount(1);
  // the fade has its slider only in Fade
  await expect(page.getByTestId("overlayOpacity")).toHaveCount(0);
  await groups[2].getByRole("button", { name: "Fade" }).click();
  await expect(page.getByTestId("overlayOpacity")).toBeVisible();
  // and the screens are fitted to the area: one of their sides fills it
  const area = await page.getByTestId("drawArea").last().boundingBox();
  const canvas = await page
    .getByTestId("drawArea")
    .last()
    .locator("canvas")
    .first()
    .boundingBox();
  if (!area || !canvas) throw new Error("no screen");
  expect(
    Math.min(area.width - canvas.width, area.height - canvas.height),
  ).toBeLessThanOrEqual(6);
});

test("shows the changed share against the allowed one without a handle", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  await openProjectPage(project.id, build.id, run.id);

  const meter = page.getByTestId("diffMeter");
  await expect(meter.getByTestId("diffChanged")).toHaveText("1.24% changed");
  await expect(meter.getByTestId("diffAllowed")).toHaveText("3.21% allowed");
  await expect(meter.getByTestId("toleranceMark")).toBeVisible();
  // a tick, not something to drag
  await expect(meter.getByRole("slider")).toHaveCount(0);
  const mark = await meter.getByTestId("toleranceMark").boundingBox();
  expect(mark?.width).toBeLessThanOrEqual(2);

  await openProjectPage(project.id, build.id, strict.id);
  await expect(meter.getByTestId("diffChanged")).toHaveText("1.24% changed");
  await expect(meter.getByTestId("diffAllowed")).toHaveCount(0);
  await expect(meter.getByTestId("toleranceMark")).toHaveCount(0);
});

test("says the size differs next to Current", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  await openProjectPage(project.id, build.id, resized.id);

  const current = page.getByTestId("currentHeader");
  await expect(current.getByTestId("sizeDiffers")).toHaveText(
    "Size differs · 1280 × 720",
  );
  // the size it says is Current's, in place of the plain size
  await expect(current.getByTestId("image-size")).toHaveCount(0);
  await expect(
    page.getByTestId("baselineHeader").getByTestId("image-size"),
  ).toHaveText("640 × 360");

  // the same sizes say nothing
  await openProjectPage(project.id, build.id, run.id);
  await expect(page.getByTestId("sizeDiffers")).toHaveCount(0);
  await expect(current.getByTestId("image-size")).toHaveText("1280 × 720");
});

test("keeps the footer in one line with Auto-next", async ({
  openProjectPage,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockApi(page);

  const footer = page.getByTestId("compareFooter");
  const oneLine = async () => {
    await expect(page.getByTestId("approveButton")).toBeVisible();
    await expect(page.getByTestId("reportBug")).toBeVisible();
    const box = await footer.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(65);
    // every control on the same line, none of their labels wrapped
    const controls = [
      footer.getByTestId("zoomFit"),
      page.getByTestId("approveButton"),
      page.getByTestId("rejectButton"),
      footer.getByTestId("autoNext"),
      page.getByTestId("reportBug"),
    ];
    const rows = new Set(
      await Promise.all(
        controls.map(async (control) => Math.round(await middle(control))),
      ),
    );
    expect(rows.size).toBe(1);
    for (const control of controls) {
      expect((await control.boundingBox())?.height).toBeLessThanOrEqual(40);
    }
  };

  await openProjectPage(project.id, build.id, run.id);
  await expect(footer.getByTestId("autoNext")).toHaveText("Auto-next");
  await expect(
    footer.getByRole("checkbox", { name: "Auto-next" }),
  ).not.toBeChecked();
  await oneLine();

  await inUkrainian(page);
  await page.reload();
  await expect(footer.getByTestId("autoNext")).toHaveText("Автоперехід");
  await oneLine();
});

test("opens with the side panel folded when there is nothing in it", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page, nothing);
  await openProjectPage(project.id, build.id, run.id);

  await expect(page.getByTestId("panelFolded")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Changes" })).toHaveCount(0);

  // a button unfolds it, and folds it again
  await page.getByTestId("panelUnfold").click();
  await expect(page.getByRole("tab", { name: "Changes" })).toBeVisible();
  await page.getByTestId("panelFold").click();
  await expect(page.getByTestId("panelFolded")).toBeVisible();
});

test("opens with the side panel unfolded when the screen has changes", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page, changed);
  await openProjectPage(project.id, build.id, run.id);

  await expect(page.getByRole("tab", { name: "Changes" })).toBeVisible();
  await expect(page.getByTestId("panelFolded")).toHaveCount(0);
});

test("keeps the comparison toolbar in one row at 1280 px in Ukrainian", async ({
  openProjectPage,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await inUkrainian(page);
  await mockApi(page);
  await openProjectPage(project.id, build.id, run.id);

  const toolbar = page.getByTestId("compareToolbar");
  const groups = [
    "toolbarDevices",
    "toolbarMeter",
    "toolbarView",
    "toolbarTools",
  ].map((id) => toolbar.getByTestId(id));
  await expect(groups[0].getByTestId("deviceTag")).toHaveCount(2);
  await expect(groups[3].getByTestId("areasButton")).toBeVisible();
  const rows = new Set(
    await Promise.all(
      groups.map(async (group) => Math.round(await middle(group))),
    ),
  );
  expect(rows.size).toBe(1);
  // the tools as icons, still named for screen readers and on hover
  await expect(
    toolbar.getByRole("button", { name: /Обрати елементи/ }),
  ).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /Області/ })).toBeVisible();
  await expect(
    groups[2].getByRole("button", { name: "Прозорість" }),
  ).toBeVisible();
});

test("names the areas that came from the test next to Current", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  await openProjectPage(project.id, build.id, run.id);

  const pill = page.getByTestId("currentHeader").getByTestId("testAreasPill");
  await expect(pill).toHaveText("Areas from the test · 1");
  await pill.hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("names the devices of a check in the header and keeps the toolbar in one row", async ({
  openProjectPage,
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await inUkrainian(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("vision.theme", "dark"),
  );
  const galaxy = {
    ...run,
    id: "galaxy",
    name: "Курси валют",
    device: "Galaxy S23",
    os: "Android 14",
  } as TestRun;
  const pixel = {
    ...galaxy,
    id: "pixel",
    device: "Pixel 7",
    os: "Android 15",
  } as TestRun;
  const passed = Array.from({ length: 11 }, (_, index) => ({
    ...run,
    id: `ok-${index}`,
    name: `Екран ${index + 1}`,
    status: "ok",
  })) as unknown as TestRun[];
  const runs = [galaxy, pixel, ...passed];
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, runs);
  for (const item of runs) {
    await mockTestRun(page, item);
    await page.route(`${API_URL}/test-runs/${item.id}/structure`, (route) =>
      route.fulfill({ body: JSON.stringify(changed) }),
    );
    await page.route(`${API_URL}/test-runs/${item.id}/bugs`, (route) =>
      route.fulfill({ body: "[]" }),
    );
  }
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
  await openProjectPage(project.id, build.id, galaxy.id);

  // the devices sit in the header, beside the steps, not in the toolbar
  const header = page.getByTestId("compareHeader");
  await expect(header.getByTestId("deviceStrip")).toBeVisible();
  const toolbar = page.getByTestId("compareToolbar");
  await expect(toolbar.getByTestId("deviceStrip")).toHaveCount(0);
  // so the toolbar keeps one row
  const rows = new Set(
    await Promise.all(
      ["toolbarMeter", "toolbarView", "toolbarTools"].map((id) =>
        middle(toolbar.getByTestId(id)).then(Math.round),
      ),
    ),
  );
  expect(rows.size).toBe(1);
  // screens without changes are no decisions: nothing decided yet, one left
  await expect(page.getByTestId("stepCounts")).toHaveText(
    "вирішено 0 · лишилось 1",
  );
  await expect(
    page.getByTestId("stepDots").locator("[data-state=unchanged]"),
  ).toHaveCount(11);
  await page.screenshot({
    path: "/tmp/claude-0/-home-user-vision/76addf5c-4fa7-50d4-896d-3444407828b9/scratchpad/two-devices.png",
  });
});
