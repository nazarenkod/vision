import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import {
  InspectorNode,
  InspectorTree,
  PickableElement,
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

// Spec 060: the check's UI tree beside the screenshots, and on its own page.

const project = TEST_PROJECT;
const build = TEST_BUILD_FAILED;
const run = {
  ...TEST_UNRESOLVED,
  buildId: TEST_BUILD_FAILED.id,
  uiTreeName: "tree.json.gz",
};
const IMAGE = { width: 1280, height: 720 };

const node = (
  index: number,
  parent: number | null,
  name: string,
  extra: Partial<InspectorNode>,
): InspectorNode => ({
  index,
  parent,
  key: `k${index}`,
  className: `android.widget.${name}`,
  name,
  id: "",
  text: "",
  attributes: [["class", `android.widget.${name}`]],
  bounds: { x: 0, y: 0, ...IMAGE },
  ...extra,
});

const tree = (amount: string): InspectorTree => ({
  format: "appium-android",
  positioned: true,
  ...IMAGE,
  nodes: [
    node(0, null, "FrameLayout", {}),
    node(1, 0, "LinearLayout", {
      key: "id:card",
      id: "card",
      bounds: { x: 800, y: 40, width: 400, height: 200 },
    }),
    node(2, 1, "TextView", {
      key: "id:amount",
      id: "amount",
      text: amount,
      attributes: [
        ["class", "android.widget.TextView"],
        ["resource-id", "com.bank:id/amount"],
        ["text", amount],
      ],
      bounds: { x: 820, y: 80, width: 200, height: 60 },
    }),
    node(3, 0, "Button", {
      key: "id:btn_pay",
      id: "btn_pay",
      text: "Pay",
      bounds: { x: 800, y: 300, width: 400, height: 80 },
    }),
  ],
});

const pickable = (index: number, selector: string): PickableElement => ({
  index,
  parent: null,
  selector,
  element: selector,
  bounds: tree("").nodes[index].bounds as PickableElement["bounds"],
});

const structure: StructureInfo = {
  hasUiTree: true,
  hasBaselineUiTree: true,
  changes: [
    {
      kind: "text",
      key: "id:amount",
      element: 'TextView "1 200 ₴"',
      resourceId: "com.bank:id/amount",
      before: "1 000 ₴",
      after: "1 200 ₴",
      bounds: { x: 820, y: 80, width: 200, height: 60 },
    },
  ],
  regions: [],
  hints: [],
  invisible: [],
  rules: [],
  compareOnly: { active: false, keep: [], problems: [] },
  ignoredAreas: [],
  toleratedAreas: [],
  systemBars: [],
  moves: [],
  elements: [pickable(2, "id:amount"), pickable(3, "id:btn_pay")],
  baselineElements: [pickable(2, "id:amount"), pickable(3, "id:btn_pay")],
  areaSuggestions: [],
  settings: null as unknown as StructureInfo["settings"],
};

const mockApi = async (page: Page) => {
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
  await page.route(
    (url) => url.pathname === `/test-runs/${run.id}/ui-tree`,
    (route) => {
      const side = new URL(route.request().url()).searchParams.get("side");
      return route.fulfill({
        body: JSON.stringify(tree(side === "baseline" ? "1 000 ₴" : "1 200 ₴")),
      });
    },
  );
  await page.route(
    (url) => url.pathname === `/test-runs/${run.id}/ui-tree/locators`,
    (route) =>
      route.fulfill({
        body: JSON.stringify({
          vision: [{ kind: "id", value: "id:amount", matches: 1 }],
          test: [
            { kind: "id", value: "com.bank:id/amount", matches: 1 },
            {
              kind: "xpath",
              value:
                '//android.widget.TextView[@resource-id="com.bank:id/amount"]',
              matches: 1,
            },
          ],
        }),
      }),
  );
};

const canvasOf = (page: Page, side: "baseline" | "current") =>
  page
    .getByTestId("drawArea")
    .nth(side === "baseline" ? 0 : 1)
    .locator("canvas")
    .first();

const clickAt = async (
  page: Page,
  side: "baseline" | "current",
  x: number,
  y: number,
) => {
  const box = await canvasOf(page, side).boundingBox();
  if (!box) throw new Error("no screenshot");
  const scale = box.width / IMAGE.width;
  await page.mouse.click(box.x + x * scale, box.y + y * scale);
};

const chosenRow = (page: Page) =>
  page.locator('[data-testid="treeRow"][aria-selected="true"]');

test.describe("Elements tab (060)", () => {
  test.beforeEach(async ({ page }) => mockApi(page));

  test("lists Elements third, opens on Changes and picks from the screenshots", async ({
    page,
    openProjectPage,
  }) => {
    await openProjectPage(project.id, build.id, run.id);
    await unfoldPanel(page);
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveText(["Changes", "Accessibility", "Elements"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    await page.getByTestId("elementsTabButton").click();
    await expect(page.getByTestId("tree")).toBeVisible();
    // the changed amount is marked on its row
    await expect(
      page.locator('[data-testid="treeRow"][data-index="2"]'),
    ).toContainText("text");

    // the smallest element under the click is chosen
    await expect(canvasOf(page, "current")).toBeVisible();
    await clickAt(page, "current", 900, 100);
    await expect(chosenRow(page)).toHaveAttribute("data-index", "2");
    await expect(page.getByTestId("nodeAttributes")).toContainText(
      "baseline: 1 000 ₴",
    );
    await expect(page.getByTestId("testLocators")).toContainText(
      "com.bank:id/amount",
    );
    await page.screenshot({
      path: "test-results/elements-tab.png",
      fullPage: true,
    });

    // a click on the baseline turns the tab to its tree (REQ-060-20)
    await clickAt(page, "baseline", 1000, 340);
    await expect(page.getByTestId("treeBaseline")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(chosenRow(page)).toHaveAttribute("data-index", "3");
  });

  test("opens the inspector on the node and comes back to it", async ({
    page,
    openProjectPage,
  }) => {
    await openProjectPage(project.id, build.id, run.id);
    await unfoldPanel(page);
    await page.getByTestId("elementsTabButton").click();
    await page.locator('[data-testid="treeRow"][data-index="2"]').click();
    await page.getByTestId("treeFullScreen").click();

    await expect(page).toHaveURL(
      new RegExp(`/inspect/${run.id}\\?tree=current&node=2$`),
    );
    await expect(page.getByTestId("inspectorPage")).toBeVisible();
    await expect(chosenRow(page)).toHaveAttribute("data-index", "2");
    await page.screenshot({
      path: "test-results/inspector.png",
      fullPage: true,
    });

    await page.getByTestId("inspectBack").click();
    await expect(page).toHaveURL(/panel=elements&tree=current&node=2/);
    await expect(page.getByTestId("elementsTab")).toBeVisible();
    await expect(chosenRow(page)).toHaveAttribute("data-index", "2");
  });

  test("the inspector says when the linked element is not in the tree", async ({
    page,
    authUser,
  }) => {
    void authUser;
    await page.goto(`/inspect/${run.id}?tree=current&node=99`);
    await expect(page.getByTestId("treeNotFound")).toBeVisible();
  });
});
