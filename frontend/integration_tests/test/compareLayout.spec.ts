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
  // words only: nothing to drag, no bar to read as a slider (REQ-047-06)
  await expect(meter).toHaveText("1.24% changed·3.21% allowed");
  await expect(meter.getByRole("slider")).toHaveCount(0);
  await expect(meter.getByTestId("toleranceMark")).toHaveCount(0);
  await expect(meter.getByTestId("diffFill")).toHaveCount(0);

  await openProjectPage(project.id, build.id, strict.id);
  await expect(meter.getByTestId("diffChanged")).toHaveText("1.24% changed");
  await expect(meter.getByTestId("diffAllowed")).toHaveCount(0);
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

test("keeps a check on two devices in one toolbar row", async ({
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

  // the devices are the toolbar's first group, where they were before
  const toolbar = page.getByTestId("compareToolbar");
  const devices = toolbar.getByTestId("toolbarDevices");
  await expect(devices.getByTestId("deviceStrip")).toBeVisible();
  await expect(
    page.getByTestId("compareHeader").getByTestId("deviceStrip"),
  ).toHaveCount(0);
  await expect(devices.getByTestId("approveAllDevices")).toBeVisible();
  // the header names the screen and its trend: no position, no counts (REQ-047-05)
  await expect(page.getByTestId("stepProgress")).toHaveCount(0);
  await expect(page.getByTestId("stepCounts")).toHaveCount(0);

  const oneRow = async () => {
    await expect(toolbar.getByTestId("toolbarTools")).toBeVisible();
    const rows = new Set(
      await Promise.all(
        ["toolbarDevices", "toolbarMeter", "toolbarView", "toolbarTools"].map(
          (id) => middle(toolbar.getByTestId(id)).then(Math.round),
        ),
      ),
    );
    expect(rows.size).toBe(1);
  };
  // the devices by their model, Approve all by its icon and count
  await expect(devices.getByTestId("approveAllDevices")).toHaveText("2");
  await expect(devices.getByTestId("deviceTag")).toHaveText([
    "Galaxy S23",
    "Pixel 7",
  ]);
  await oneRow();
  // narrower still, Highlight diff goes by its icon too
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(
    toolbar.getByRole("checkbox", { name: "Підсвітити різницю" }),
  ).toBeVisible();
  await oneRow();
});

test("shows the trend of the check in the header", async ({
  openProjectPage,
  page,
}) => {
  await mockApi(page);
  const at = (day: number) =>
    new Date(Date.UTC(2026, 9, day, 12)).toISOString();
  await page.route(`${API_URL}/test-runs/${run.id}/trend`, (route) =>
    route.fulfill({
      body: JSON.stringify([
        {
          id: "a",
          buildNumber: 126,
          createdAt: at(29),
          status: "ok",
          diffPercent: 0,
        },
        {
          id: "b",
          buildNumber: 127,
          createdAt: at(30),
          status: "approved",
          diffPercent: 0.5,
        },
        {
          id: run.id,
          buildNumber: 128,
          createdAt: at(31),
          status: "unresolved",
          diffPercent: 1.24,
        },
      ]),
    }),
  );
  await openProjectPage(project.id, build.id, run.id);

  const header = page.getByTestId("compareHeader");
  const trend = header.getByTestId("checkTrend");
  await expect(trend).toHaveAttribute(
    "aria-label",
    "Trend of the check over the last 3 runs",
  );
  // right after the status, with nothing between them (REQ-047-05)
  const status = await header
    .getByText("unresolved", { exact: true })
    .boundingBox();
  const chart = await trend.boundingBox();
  if (!status || !chart) throw new Error("not on screen");
  expect(chart.x).toBeGreaterThan(status.x + status.width);
  expect(chart.x - (status.x + status.width)).toBeLessThanOrEqual(32);

  // oldest first, ending with the run on screen; height follows the share
  const bars = trend.getByTestId("trendBar");
  await expect(bars).toHaveCount(3);
  await expect(bars.last()).toHaveAttribute("data-current", "true");
  await expect(bars.first()).toHaveAttribute("data-status", "ok");
  const heights = await bars.evaluateAll((items) =>
    items.map((item) => (item.firstElementChild as HTMLElement).offsetHeight),
  );
  expect(heights[0]).toBe(3);
  expect(heights[0]).toBeLessThan(heights[1]);
  expect(heights[1]).toBeLessThan(heights[2]);

  await bars.last().hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "#128 · 1.24% · unresolved ·",
  );
});

test("shows neither the position nor the queue in the header", async ({
  openProjectPage,
  page,
}) => {
  // signs in; the page is opened at the queue's address below
  void openProjectPage;
  await page.setViewportSize({ width: 1280, height: 800 });
  await inUkrainian(page);
  const feature = "Кредитна сила - Оплата частинами (Точки входу)";
  const entry = { ...run, id: "entry", name: "Вхід", featureName: feature };
  // in the build between the two (screens go by name), not in the feature's queue
  const other = {
    ...run,
    id: "other",
    name: "Головна",
    featureName: "Профіль",
  };
  const banner = {
    ...run,
    id: "banner",
    name: "Точки входу. Банер",
    featureName: feature,
  };
  const runs = [entry, other, banner];
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, runs);
  await page.route(`${API_URL}/test-runs/groups?buildId=${build.id}`, (route) =>
    route.fulfill({ json: [] }),
  );
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
  await page.goto(
    `/${project.id}?buildId=${build.id}&testId=entry&queue=${encodeURIComponent(
      `feature:${feature}`,
    )}`,
  );

  const header = page.getByTestId("compareHeader");
  await expect(header.getByTestId("screenName")).toHaveText("Вхід");
  // no "1 з 2 у <черга> ▾": the queue is chosen on the Overview
  await expect(header).not.toContainText(feature);
  await expect(header).not.toContainText(/\d+ з \d+/);
  await expect(page.getByTestId("stepProgress")).toHaveCount(0);
  await expect(page.getByTestId("queueName")).toHaveCount(0);
  // one line whatever the queue's name (SC-047-02); the header's height is
  // the same for any name (REQ-048-08)
  const box = await header.boundingBox();
  const name = await header.getByTestId("screenName").boundingBox();
  if (!box || !name) throw new Error("not on screen");
  expect(name.y + name.height).toBeLessThanOrEqual(box.y + box.height);
  expect(name.height).toBeLessThan(40);

  // the queue still leads the arrows: past the screen outside the feature
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/testId=banner$/);
  await expect(page).toHaveURL(/queue=feature/);
  await expect(header.getByTestId("screenName")).toHaveText(
    "Точки входу. Банер",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/testId=entry$/);
});

test("shows the whole check name in up to two lines at one header height", async ({
  openProjectPage,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const heightFor = async (name: string) => {
    await mockApi(page);
    const named = { ...run, name };
    await mockGetTestRuns(page, build.id, [named]);
    await mockTestRun(page, named);
    await openProjectPage(project.id, build.id, run.id);
    const header = page.getByTestId("compareHeader");
    const title = header.getByTestId("screenName");
    await expect(title).toHaveText(name);
    // the whole name on hover (REQ-048-08)
    await expect(title).toHaveAttribute("title", name);
    const lineHeight = await title.evaluate((el) =>
      parseFloat(getComputedStyle(el).lineHeight),
    );
    const box = await title.boundingBox();
    if (!box) throw new Error("not on screen");
    // at most two lines, the rest behind an ellipsis
    expect(box.height).toBeLessThanOrEqual(lineHeight * 2 + 1);
    return { header: (await header.boundingBox())?.height, title: box };
  };
  const short = await heightFor("Вхід");
  const long = await heightFor(
    'Перехід по deeplink [part_instant_payments-earlypay] для внесення платежу, коли договір на простроченні ("withOverdue") і клієнт має кілька карток та активну підписку на всі сервіси застосунку',
  );
  // longer than a third of the header: the name is not cut to a stub
  expect(long.title.width).toBeGreaterThan(1280 / 3);
  // one height for any name, so the screens below never move (SC-048-03)
  expect(long.header).toBe(short.header);
});
