import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import type { ReviewedElement } from "~client/types";
import {
  API_URL,
  mockGetBuildDetails,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestRuns,
  mockImage,
  mockTestRun,
} from "utils/mocks";
import type { StructureInfo } from "~client/types";

const screen = (id: string, name: string, only = true) => ({
  id,
  name,
  customTags: "",
  device: "Pixel 7",
  os: "Android 14",
  browser: "",
  viewport: "",
  imageName: "image.png",
  baselineName: "baseline.png",
  merge: false,
  only,
  current: { x: 0, y: 0, width: 400, height: 60 },
  baseline: { x: 0, y: 0, width: 400, height: 60 },
  width: 800,
  height: 1600,
  baselineWidth: 800,
  baselineHeight: 1600,
});

const ELEMENTS: ReviewedElement[] = [
  {
    key: "id:toolbar",
    name: "Toolbar",
    screens: 3,
    only: 2,
    items: [
      screen("r1", "Payments.List.all"),
      screen("r2", "Cards.List.main"),
      screen("r3", "Home.Main", false),
    ],
  },
  {
    key: "id:btn_pay",
    name: 'Button "Pay"',
    screens: 2,
    only: 2,
    items: [screen("r4", "Payments.Form"), screen("r5", "Transfers.Form")],
  },
];

const mockElements = (page: Page, elements = ELEMENTS) =>
  // the comparison asks with the build of its screen, the tab with the build on the page
  page.route(`${API_URL}/test-runs/elements?*`, (route) =>
    route.fulfill({ json: elements }),
  );

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT]);
  await mockGetBuilds(page, TEST_PROJECT.id, [TEST_BUILD_FAILED]);
  await mockGetBuildDetails(page, TEST_BUILD_FAILED);
  await mockGetTestRuns(page, TEST_BUILD_FAILED.id, [TEST_UNRESOLVED]);
  await mockImage(page, "baseline.png");
  await mockImage(page, "image.png");
  await page.route(
    `${API_URL}/test-runs/groups?buildId=${TEST_BUILD_FAILED.id}`,
    (route) => route.fulfill({ json: [] }),
  );
});

test("shows the elements changed on several screens, most first", async ({
  openProjectPage,
  page,
}) => {
  await mockElements(page);
  await openProjectPage(
    TEST_PROJECT.id,
    TEST_BUILD_FAILED.id,
    undefined,
    "changes",
  );

  await page.getByTestId("changesByElements").click();

  await expect(page).toHaveURL(/by=elements/);
  await expect(page.getByTestId("betaChip").first()).toBeVisible();
  await expect(page.getByTestId("reviewElement")).toHaveText([
    /Toolbar\s*3/,
    /Button "Pay"\s*2/,
  ]);
  await expect(page.getByTestId("reviewScreen")).toHaveCount(3);
  await expect(page.getByTestId("reviewBaseline")).toHaveCount(3);
  await expect(page.getByTestId("reviewCurrent")).toHaveCount(3);
  // the screen where something else changed is not taken by the decision
  await expect(page.getByTestId("reviewElsewhere")).toHaveCount(1);
  await expect(page.getByTestId("reviewApprove")).toContainText("Approve 2");
});

test("approves the ticked screens of an element with undo", async ({
  openProjectPage,
  page,
}) => {
  await mockElements(page);
  const approved: string[][] = [];
  await page.route(`${API_URL}/test-runs/approve?merge=false`, (route) => {
    approved.push(route.request().postDataJSON());
    return route.fulfill({ json: { decisionId: "d1" } });
  });
  await openProjectPage(
    TEST_PROJECT.id,
    `${TEST_BUILD_FAILED.id}&by=elements`,
    undefined,
    "changes",
  );

  await page
    .getByTestId("reviewScreen")
    .filter({ hasText: "Cards.List.main" })
    .getByRole("checkbox")
    .uncheck();
  await expect(page.getByTestId("reviewApprove")).toContainText("Approve 1");
  await page.getByTestId("reviewApprove").click();

  expect(approved).toEqual([["r1"]]);
  await expect(page.getByTestId("undoDecision")).toBeVisible();
});

test("opens another element from the list", async ({
  openProjectPage,
  page,
}) => {
  await mockElements(page);
  await openProjectPage(
    TEST_PROJECT.id,
    `${TEST_BUILD_FAILED.id}&by=elements`,
    undefined,
    "changes",
  );

  await page.getByTestId("reviewElement").nth(1).click();

  await expect(page).toHaveURL(/element=id%3Abtn_pay/);
  await expect(page.getByTestId("reviewScreen")).toHaveCount(2);
  await expect(page.getByTestId("reviewApprove")).toContainText("Approve 2");
});

test("says so when no element changed on more than one screen", async ({
  openProjectPage,
  page,
}) => {
  await mockElements(page, []);
  await openProjectPage(
    TEST_PROJECT.id,
    `${TEST_BUILD_FAILED.id}&by=elements`,
    undefined,
    "changes",
  );

  await expect(
    page.getByText("No element changed in more than one check"),
  ).toBeVisible();
});

test("offers the other screens of a changed element from the comparison", async ({
  openProjectPage,
  page,
}) => {
  await mockElements(page);
  await mockTestRun(page, TEST_UNRESOLVED);
  const area = { x: 0, y: 0, width: 400, height: 60 };
  const structure = {
    hasUiTree: true,
    hasBaselineUiTree: true,
    changes: [],
    regions: [
      {
        region: area,
        key: "id:toolbar",
        element: "Toolbar",
        resourceId: "toolbar",
      },
    ],
    hints: [],
    invisible: [],
    rules: [],
    ignoredAreas: [],
    toleratedAreas: [],
    systemBars: [],
    moves: [],
    settings: null,
  } as unknown as StructureInfo;
  await page.route(
    `${API_URL}/test-runs/${TEST_UNRESOLVED.id}/structure`,
    (route) => route.fulfill({ json: structure }),
  );
  await openProjectPage(
    TEST_PROJECT.id,
    TEST_BUILD_FAILED.id,
    TEST_UNRESOLVED.id,
  );

  const chip = page.getByRole("button", { name: /2 more checks/ });
  await expect(chip).toBeVisible();
  await chip.click();

  await expect(page).toHaveURL(
    /tab=changes.*by=elements.*element=id%3Atoolbar/,
  );
  await expect(page.getByTestId("reviewScreen")).toHaveCount(3);
});
