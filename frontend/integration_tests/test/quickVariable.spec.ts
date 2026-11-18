import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import {
  PickableElement,
  StructuralChange,
  StructureInfo,
} from "~client/types";
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

// Spec 078: what changed in a text, not compared from now on, in one click from its row.

const project = TEST_PROJECT;
const build = TEST_BUILD_FAILED;
const usd: PickableElement = {
  index: 7,
  parent: null,
  selector: "text:Курс долара США. Продаж 45 Гривень 30 копійок",
  element: 'View "Курс долара США. Продаж 45 Гривень 30 копійок"',
  bounds: { x: 800, y: 300, width: 400, height: 80 },
  text: "Курс долара США. Продаж 45 Гривень 30 копійок",
};
const promo: PickableElement = {
  index: 8,
  parent: null,
  selector: "text:Закинь на телефон",
  element: 'TextView "Закинь на телефон"',
  bounds: { x: 800, y: 420, width: 400, height: 60 },
  text: "Закинь на телефон",
};
const label: StructuralChange = {
  kind: "label",
  key: `View:${usd.text}`,
  element: usd.element,
  resourceId: "",
  before: "Курс долара США. Продаж 45 Гривень 35 копійок",
  after: usd.text,
  bounds: usd.bounds,
  index: usd.index,
};
const resized: StructuralChange = {
  kind: "resized",
  key: label.key,
  element: usd.element,
  resourceId: "",
  before: "130×52",
  after: "118×52",
  bounds: usd.bounds,
  index: usd.index,
};
const words: StructuralChange = {
  kind: "text",
  key: `TextView:${promo.text}`,
  element: promo.element,
  resourceId: "",
  before: "Купуй квитки",
  after: promo.text,
  bounds: promo.bounds,
  index: promo.index,
};
const structure: StructureInfo = {
  hasUiTree: true,
  hasBaselineUiTree: true,
  changes: [label, words, resized],
  regions: [],
  hints: [],
  invisible: [],
  rules: [],
  compareOnly: { active: false, keep: [], problems: [] },
  ignoredAreas: [],
  toleratedAreas: [],
  systemBars: [],
  moves: [],
  elements: [usd, promo],
  baselineElements: [usd, promo],
  areaSuggestions: [],
  settings: null as unknown as StructureInfo["settings"],
};

const openReview = async (
  page: Page,
  openProjectPage: (id: string, buildId: string, testId: string) => unknown,
) => {
  const added: Array<Record<string, unknown>> = [];
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
  await page.route(`${API_URL}/test-runs/${run.id}/element-rules`, (route) => {
    const body = route.request().postDataJSON();
    added.push(body);
    return route.fulfill({
      status: 201,
      body: JSON.stringify({ id: "new-1", ...body }),
    });
  });
  await openProjectPage(project.id, build.id, run.id);
  await unfoldPanel(page);
  return added;
};

test("saves a variable-text rule for what changed in a text in one click", async ({
  openProjectPage,
  page,
}) => {
  const added = await openReview(page, openProjectPage);
  await page.getByTestId("quickVariable").click();
  await expect.poll(() => added.length).toBe(1);
  expect(added[0]).toMatchObject({
    action: "variable",
    scope: "screen",
    parts: [
      { text: "Курс долара США. Продаж 45 Гривень " },
      { pattern: "\\d+", sample: "30" },
      { text: " копійок" },
    ],
  });
  // undo is offered, as for a rule saved from the pieces
  await expect(page.getByTestId("undoRule")).toBeVisible();
});

test("offers no one-click rule for a text that shares nothing with the baseline", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  await expect(
    page
      .getByTestId("changedAreaName")
      .filter({ hasText: "Закинь на телефон" }),
  ).toHaveCount(1);
  // the one action is on the rate's row, none on the text that changed whole
  await expect(page.getByTestId("quickVariable")).toHaveCount(1);
});

test("shows a text change and the resize it brought in one row", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  await expect(
    page.getByTestId("changedAreaName").filter({ hasText: "Курс долара США" }),
  ).toHaveCount(1);
  await expect(page.getByTestId("changedAreaMoreChange")).toHaveText(
    "Resized 130×52 → 118×52 dp",
  );
});

test.describe("for a guest", () => {
  test.use({ userRole: "guest" });

  test("offers no one-click rule to someone who cannot change rules", async ({
    openProjectPage,
    page,
  }) => {
    await openReview(page, openProjectPage);
    await expect(page.getByTestId("quickVariable")).toHaveCount(0);
  });
});
