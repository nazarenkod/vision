import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import { MovedElement, StructureInfo } from "~client/types";
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

// Spec 079: which element moved and where, on both screenshots.

const project = TEST_PROJECT;
const build = TEST_BUILD_FAILED;
const form: MovedElement = {
  key: "path:0/1",
  element: "View",
  dxDp: 0,
  dyDp: 54,
  from: { x: 40, y: 290, width: 1320, height: 1530 },
  to: { x: 40, y: 479, width: 1320, height: 1530 },
  around: ["IBAN", "Scanner"],
};
const button: MovedElement = {
  key: "id/continue",
  element: 'Button "Continue" (id/continue)',
  dxDp: 0,
  dyDp: 20,
  from: { x: 40, y: 2600, width: 1320, height: 120 },
  to: { x: 40, y: 2675, width: 1320, height: 120 },
};
const structure = {
  hasUiTree: true,
  hasBaselineUiTree: true,
  changes: [],
  regions: [],
  hints: [],
  invisible: [],
  rules: [],
  compareOnly: { active: false, keep: [], problems: [] },
  ignoredAreas: [],
  toleratedAreas: [],
  systemBars: [],
  moves: [form, button],
  elements: [],
  baselineElements: [],
  areaSuggestions: [],
  settings: null,
} as unknown as StructureInfo;

const openReview = async (
  page: Page,
  openProjectPage: (id: string, buildId: string, testId: string) => unknown,
) => {
  const run = { ...TEST_UNRESOLVED, uiTreeName: "tree.json.gz" };
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, [run]);
  await mockTestRun(page, run);
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
  await page.route(`${API_URL}/test-runs/${run.id}/structure`, (route) =>
    route.fulfill({ body: JSON.stringify(structure) }),
  );
  await openProjectPage(project.id, build.id, run.id);
  await unfoldPanel(page);
};

const rows = (page: Page) => page.getByTestId("movedElement");

test("names the moved element by what is inside and says how far it moved below", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  await expect(page.getByTestId("movedElementName")).toHaveText([
    'View · ancestor of "IBAN", "Scanner"',
    'Button "Continue" (id/continue)',
  ]);
  await expect(page.getByTestId("movedElementBy").first()).toHaveText(
    "down 54 dp",
  );
  await expect(
    page.getByText("These moved without changing", { exact: false }),
  ).toHaveCount(0);
});

test("lights a moved element while the pointer is over its row", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  await rows(page).first().hover();
  await expect(rows(page).first()).toHaveAttribute("aria-pressed", "false");
  await page.mouse.move(0, 0);
  await expect(rows(page).first()).toHaveAttribute("aria-pressed", "false");
});

test("pins a moved element with a click and moves the pin to another row", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  await rows(page).first().click();
  await expect(rows(page).first()).toHaveAttribute("aria-pressed", "true");
  await rows(page).nth(1).click();
  await expect(rows(page).first()).toHaveAttribute("aria-pressed", "false");
  await expect(rows(page).nth(1)).toHaveAttribute("aria-pressed", "true");
});

test("unpins with a second click or Esc and keeps the review open", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  await rows(page).first().click();
  await rows(page).first().click();
  await expect(rows(page).first()).toHaveAttribute("aria-pressed", "false");

  await rows(page).first().click();
  await page.keyboard.press("Escape");
  await expect(rows(page).first()).toHaveAttribute("aria-pressed", "false");
  // the review is still open: Esc let go of the pin only
  await expect(rows(page).first()).toBeVisible();
});
