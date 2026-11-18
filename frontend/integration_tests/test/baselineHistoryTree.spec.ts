import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_PROJECT,
  TEST_VARIATION_ONE,
} from "~client/_test/test.data.helper";
import { InspectorNode, InspectorTree, TestVariation } from "~client/types";
import {
  API_URL,
  mockGetProjects,
  mockGetTestVariationDetails,
  mockImage,
} from "utils/mocks";

// Spec 081: the UI trees of a baseline's two versions, side by side, only to look at.

const IMAGE = { width: 1280, height: 720 };

const node = (
  index: number,
  parent: number | null,
  key: string,
  name: string,
  extra: Partial<InspectorNode> = {},
): InspectorNode => ({
  index,
  parent,
  key,
  className: `android.widget.${name}`,
  name,
  id: "",
  text: "",
  attributes: [["class", `android.widget.${name}`]],
  bounds: { x: 0, y: 0, ...IMAGE },
  clickable: false,
  wrapper: false,
  ...extra,
});

const title = (text: string) =>
  node(1, 0, "id:title", "TextView", {
    id: "title",
    text,
    attributes: [
      ["class", "android.widget.TextView"],
      ["text", text],
    ],
    bounds: { x: 200, y: 200, width: 600, height: 100 },
  });

const tree = (nodes: InspectorNode[]): InspectorTree => ({
  format: "appium-android",
  positioned: true,
  ...IMAGE,
  nodes,
});

const TREES: Record<string, InspectorTree> = {
  b3: tree([
    node(0, null, "root", "FrameLayout"),
    title("Change your PIN"),
    node(2, 0, "id:pin", "Button", {
      id: "pin",
      text: "Change PIN",
      bounds: { x: 200, y: 400, width: 300, height: 90 },
    }),
  ]),
  b2: tree([node(0, null, "root", "FrameLayout"), title("Declined")]),
  b1: tree([node(0, null, "root", "FrameLayout"), title("Try again")]),
};

const [first, second] = TEST_VARIATION_ONE.baselines;
const variation: TestVariation = {
  ...TEST_VARIATION_ONE,
  baselines: [
    { ...first, id: "b3", uiTreeName: "b3.json.gz" },
    { ...second, id: "b2", uiTreeName: "b2.json.gz" },
    {
      ...second,
      id: "b1",
      createdAt: "2020-09-10T06:57:25.845Z",
      uiTreeName: "b1.json.gz",
    },
  ],
};

async function mockTrees(page: Page) {
  const asked: string[] = [];
  await page.route(
    (url) =>
      url.origin === API_URL &&
      /^\/test-variations\/[^/]+\/baselines\/[^/]+\/ui-tree$/.test(
        url.pathname,
      ),
    (route) => {
      const id = new URL(route.request().url()).pathname.split("/")[4];
      asked.push(id);
      return route.fulfill({ body: JSON.stringify(TREES[id] ?? null) });
    },
  );
  return asked;
}

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT]);
  await mockGetTestVariationDetails(page, variation);
  await mockImage(page, "baseline1.png");
  await mockImage(page, "baseline2.png");
});

const rowsIn = (page: Page, side: "selected" | "previous") =>
  page.getByTestId(`pairVersion-${side}`).getByTestId("treeRow");
const chosenIn = (page: Page, side: "selected" | "previous") =>
  page
    .getByTestId(`pairVersion-${side}`)
    .locator('[data-testid="treeRow"][aria-selected="true"]');

test("opens on screenshots and shows both trees on switching", async ({
  openTestVariationDetailsPage,
  page,
}) => {
  const asked = await mockTrees(page);
  await openTestVariationDetailsPage(variation.id);

  await expect(page.getByTestId("historyScreens")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("historyPicked")).toBeVisible();
  // the trees come only once asked for (REQ-081-05)
  expect(asked).toEqual([]);

  await page.getByTestId("historyTree").click();

  await expect(rowsIn(page, "selected")).toHaveCount(3);
  await expect(rowsIn(page, "previous")).toHaveCount(2);
  expect(asked.sort()).toEqual(["b2", "b3"]);
  await expect(page).toHaveURL(/view=tree/);
});

test("a click on the previous screenshot chooses the element in both trees", async ({
  openTestVariationDetailsPage,
  page,
}) => {
  await mockTrees(page);
  await openTestVariationDetailsPage(variation.id);
  await page.getByTestId("historyTree").click();
  await expect(rowsIn(page, "previous")).toHaveCount(2);

  const screen = page.getByTestId("pairScreen-previous");
  const box = await screen.boundingBox();
  if (!box) throw new Error("no screenshot");
  // the middle of the title: 500, 250 on a 1280 × 720 screenshot
  await screen.click({
    position: { x: (500 / 1280) * box.width, y: (250 / 720) * box.height },
  });

  await expect(chosenIn(page, "previous")).toHaveAttribute("data-index", "1");
  await expect(chosenIn(page, "selected")).toHaveAttribute("data-index", "1");
  const card = page.getByTestId("pairCard");
  await expect(card).toContainText("Change your PIN");
  await expect(card).toContainText("Declined");
  await expect(page).toHaveURL(/node=id%3Atitle/);
});

test("keeps the trees and the element when another version is picked", async ({
  openTestVariationDetailsPage,
  page,
}) => {
  await mockTrees(page);
  await openTestVariationDetailsPage(variation.id);
  await page.getByTestId("historyTree").click();
  await rowsIn(page, "selected").nth(1).click();
  await expect(page.getByTestId("pairCard")).toContainText("Change your PIN");

  await page
    .getByTestId("historyEntry")
    .nth(1)
    .getByRole("button")
    .first()
    .click();

  await expect(page.getByTestId("historyTree")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const card = page.getByTestId("pairCard");
  await expect(card).toContainText("Declined");
  await expect(card).toContainText("Try again");
  await expect(chosenIn(page, "previous")).toHaveAttribute("data-index", "1");
});

test("opens full screen on the element and comes back to it", async ({
  openTestVariationDetailsPage,
  page,
}) => {
  await mockTrees(page);
  await openTestVariationDetailsPage(variation.id);
  await page.getByTestId("historyTree").click();
  await rowsIn(page, "selected").nth(2).click();

  await page.getByTestId("historyFullScreen").click();

  await expect(page.getByTestId("baselineTreesPage")).toBeVisible();
  await expect(page).toHaveURL(/\/trees\?baseline=b3&node=id%3Apin/);
  await expect(chosenIn(page, "selected")).toHaveAttribute("data-index", "2");
  await expect(page.getByTestId("pairCardAbsent-previous")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page).toHaveURL(/baseline=b3&view=tree&node=id%3Apin/);
  await expect(chosenIn(page, "selected")).toHaveAttribute("data-index", "2");
});
