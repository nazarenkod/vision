import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import { PickableElement, StructureInfo } from "~client/types";
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

// Spec 077: only numbers changed — said once, and checked instead of ignored.

const project = TEST_PROJECT;
const build = TEST_BUILD_FAILED;
const bell: PickableElement = {
  index: 5,
  parent: null,
  selector: "text:Сповіщення.Ви маєте 49 непрочитаних повідомлень",
  element: 'View "Сповіщення.Ви маєте 49 непрочитаних повідомлень"',
  bounds: { x: 800, y: 40, width: 400, height: 80 },
  text: "Сповіщення.Ви маєте 49 непрочитаних повідомлень",
};
const change = {
  kind: "label" as const,
  key: "View:Сповіщення.Ви маєте 49 непрочитаних повідомлень",
  element: bell.element,
  resourceId: "",
  before: "Сповіщення.Ви маєте 99 непрочитаних повідомлень",
  after: "Сповіщення.Ви маєте 49 непрочитаних повідомлень",
  bounds: bell.bounds,
};
const structure: StructureInfo = {
  hasUiTree: true,
  hasBaselineUiTree: true,
  changes: [change],
  regions: [],
  hints: [
    {
      kind: "numbers",
      message: "Only numbers changed in 1 element(s)",
      numbers: [
        {
          key: change.key,
          element: change.element,
          index: bell.index,
          before: change.before,
          after: change.after,
        },
      ],
    },
  ],
  invisible: [],
  rules: [],
  compareOnly: { active: false, keep: [], problems: [] },
  ignoredAreas: [],
  toleratedAreas: [],
  systemBars: [],
  moves: [],
  elements: [bell],
  baselineElements: [bell],
  areaSuggestions: [],
  settings: null as unknown as StructureInfo["settings"],
};

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

test("says only numbers changed and offers variable text, not Ignore", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  const hint = page.getByTestId("hintNumbers");
  await expect(hint).toContainText(
    "Only numbers changed in 1 element: counters, rates, amounts.",
  );
  await expect(hint.getByTestId("hintNumbersElement")).toHaveCount(1);
  await expect(hint.getByTestId("hintMarkNumbers")).toHaveText("Variable text");
  await expect(hint.getByTestId("hintIgnoreElement")).toHaveCount(0);
});

test("opens the element's variable text with the changed numbers marked", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  await page.getByTestId("hintMarkNumbers").click();
  const pieces = page.getByTestId("variablePiece");
  await expect(pieces.filter({ hasText: /^49$/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(pieces.filter({ hasText: /^Ви$/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  // nothing is saved until the rule is
  await expect(page.getByTestId("variableSave")).toBeEnabled();
});

test.describe("for a guest", () => {
  test.use({ userRole: "guest" });

  test("shows the hint with no variable text to someone who cannot change rules", async ({
    openProjectPage,
    page,
  }) => {
    await openReview(page, openProjectPage);
    await expect(page.getByTestId("hintNumbers")).toBeVisible();
    await expect(page.getByTestId("hintMarkNumbers")).toHaveCount(0);
  });
});
