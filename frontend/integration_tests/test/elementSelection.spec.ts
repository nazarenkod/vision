import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import { PickableElement, ScreenRule, StructureInfo } from "~client/types";
import {
  API_URL,
  mockGetBuildDetails,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestRuns,
  mockImage,
  mockTestRun,
} from "utils/mocks";

// Spec 024: elements are picked on the screenshots and acted on next to them.

const project = TEST_PROJECT;
const build = TEST_BUILD_FAILED;
const IMAGE = { width: 1280, height: 720 };
// clear of the run's saved and test areas, which sit on the left
const card: PickableElement = {
  index: 1,
  parent: null,
  selector: "id:card",
  element: "Balance card",
  bounds: { x: 800, y: 40, width: 400, height: 200 },
};
const amount: PickableElement = {
  index: 2,
  parent: 1,
  selector: "id:amount",
  element: "Balance amount",
  bounds: { x: 820, y: 80, width: 200, height: 60 },
};
const pay: PickableElement = {
  index: 3,
  parent: null,
  selector: "id:btn_pay",
  element: "Pay",
  bounds: { x: 800, y: 300, width: 400, height: 80 },
};
const clock: PickableElement = {
  index: 4,
  parent: null,
  selector: "id:clock",
  element: "Clock",
  bounds: { x: 800, y: 420, width: 120, height: 40 },
};
const elements = [card, amount, pay, clock];

const baseStructure: StructureInfo = {
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
  moves: [],
  elements,
  baselineElements: elements,
  areaSuggestions: [],
  settings: null as unknown as StructureInfo["settings"],
};

const ruleOn = (
  element: PickableElement,
  action: ScreenRule["action"],
  extra: Partial<ScreenRule> = {},
): ScreenRule => ({
  id: `rule-${element.index}`,
  selector: element.selector,
  action,
  scope: "screen",
  matches: 1,
  found: { current: [element.bounds], baseline: [element.bounds] },
  ...extra,
});

interface Calls {
  added: Array<Record<string, unknown>>;
  removed: Array<Record<string, unknown>>;
  structureLoads: number;
}

const openReview = async (
  page: Page,
  openProjectPage: (id: string, buildId: string, testId: string) => unknown,
  structure: StructureInfo = baseStructure,
  run = { ...TEST_UNRESOLVED, uiTreeName: "tree.json.gz" },
): Promise<Calls> => {
  const calls: Calls = { added: [], removed: [], structureLoads: 0 };
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, [run]);
  await mockTestRun(page, run);
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
  await page.route(`${API_URL}/test-runs/${run.id}/structure`, (route) => {
    calls.structureLoads++;
    return route.fulfill({ body: JSON.stringify(structure) });
  });
  await page.route(`${API_URL}/test-runs/${run.id}/element-rules`, (route) => {
    const body = route.request().postDataJSON();
    calls.added.push(body);
    return route.fulfill({
      status: 201,
      body: JSON.stringify({ id: `new-${calls.added.length}`, ...body }),
    });
  });
  await page.route(
    `${API_URL}/test-runs/${run.id}/element-rules/remove`,
    (route) => {
      calls.removed.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, body: "" });
    },
  );
  await openProjectPage(project.id, build.id, run.id);
  await expect(canvasOf(page, "current")).toBeVisible();
  return calls;
};

const canvasOf = (page: Page, side: "baseline" | "current") =>
  page
    .getByTestId("drawArea")
    .nth(side === "baseline" ? 0 : 1)
    .locator("canvas")
    .first();

/** Image pixels on a pane, as page pixels: the image is shown scaled down. */
const at = async (
  page: Page,
  side: "baseline" | "current",
  x: number,
  y: number,
) => {
  const box = await canvasOf(page, side).boundingBox();
  const scale = box.width / IMAGE.width;
  return { x: box.x + x * scale, y: box.y + y * scale };
};
const centre = (element: PickableElement) => ({
  x: element.bounds.x + element.bounds.width / 2,
  y: element.bounds.y + element.bounds.height / 2,
});

const clickElement = async (
  page: Page,
  element: PickableElement,
  side: "baseline" | "current" = "current",
  { shift = false } = {},
) => {
  const { x, y } = await at(page, side, centre(element).x, centre(element).y);
  // page.mouse.click takes no modifiers: Shift is held on the keyboard
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.click(x, y);
  if (shift) await page.keyboard.up("Shift");
};

/**
 * The most opaque pixel of the overlay layer (rule marks, dimming) in an
 * image-pixel box: one pixel could fall into a gap of a dash or a hatch.
 */
const overlayAlpha = (
  page: Page,
  side: "baseline" | "current",
  box: { x: number; y: number; width: number; height: number },
) =>
  page
    .getByTestId("drawArea")
    .nth(side === "baseline" ? 0 : 1)
    .evaluate(
      (pane, [b, width]) => {
        const canvases = pane.querySelectorAll("canvas");
        const overlay = canvases[canvases.length - 1];
        const ratio = overlay.width / (width as number);
        const area = b as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
        let data: Uint8ClampedArray;
        try {
          data = overlay
            .getContext("2d")
            .getImageData(
              Math.round(area.x * ratio),
              Math.round(area.y * ratio),
              Math.max(1, Math.round(area.width * ratio)),
              Math.max(1, Math.round(area.height * ratio)),
            ).data;
        } catch {
          // the last canvas is the screenshot itself: no overlay is drawn at all
          return 0;
        }
        let max = 0;
        for (let i = 3; i < data.length; i += 4) max = Math.max(max, data[i]);
        return max;
      },
      [box, IMAGE.width] as const,
    );
// a band across an element's left edge, and its middle clear of every edge
const edgeOf = (element: PickableElement) => ({
  x: element.bounds.x - 4,
  y: element.bounds.y + 4,
  width: 8,
  height: element.bounds.height - 8,
});
const middleOf = (element: PickableElement) => ({
  x: element.bounds.x + 20,
  y: element.bounds.y + 20,
  width: element.bounds.width - 40,
  height: element.bounds.height - 40,
});
const empty = { x: 1100, y: 600, width: 40, height: 40 };

const openChanges = (page: Page) =>
  page.getByRole("tab", { name: /Changes/ }).click();

const startSelecting = async (page: Page) => {
  await page.getByTestId("selectElements").click();
  await expect(page.getByTestId("selectingBar")).toBeVisible();
};

test("offers Select elements to editors of a screenshot with a UI tree", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  await expect(page.getByTestId("selectElements")).toHaveText(
    /Select elements/,
  );
  // the key does the same
  await page.keyboard.press("e");
  await expect(page.getByTestId("selectingBar")).toBeVisible();
});

test.describe("for a guest", () => {
  test.use({ userRole: "guest" });

  test("offers no Select elements to someone who cannot change rules", async ({
    openProjectPage,
    page,
  }) => {
    await openReview(page, openProjectPage);
    await expect(page.getByTestId("areasButton")).toBeVisible();
    await expect(page.getByTestId("selectElements")).toHaveCount(0);
  });
});

test("shows actions next to a clicked element", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  await startSelecting(page);
  await clickElement(page, pay);

  const popover = page.getByTestId("elementPopover");
  await expect(popover).toContainText("Pay");
  await expect(popover.getByTestId("elementAction-ignore")).toBeVisible();
  await expect(popover.getByTestId("elementAction-compare")).toBeVisible();
  await expect(popover.getByTestId("elementAction-tolerate")).toContainText(
    "Allow 5%",
  );
  await expect(
    popover.getByRole("button", { name: "This screen" }),
  ).toHaveAttribute("aria-pressed", "true");

  // a click beside every element puts the actions away, selecting stays on;
  // on the baseline, as the actions sit over that corner of the checkpoint
  const beside = await at(page, "baseline", empty.x, empty.y);
  await page.mouse.click(beside.x, beside.y);
  await expect(popover).toHaveCount(0);
  await expect(page.getByTestId("selectingBar")).toBeVisible();
  // with nothing open, the next one ends selecting, as Esc does
  await page.mouse.click(beside.x, beside.y);
  await expect(page.getByTestId("selectingBar")).toBeHidden();
  await expect(page.getByTestId("selectElements")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("ignores a clicked element and compares again", async ({
  openProjectPage,
  page,
}) => {
  const calls = await openReview(page, openProjectPage);
  await startSelecting(page);
  await clickElement(page, clock);
  const loadsBefore = calls.structureLoads;
  await page.getByTestId("elementAction-ignore").click();

  await expect(page.getByText("Rule added; compared again")).toBeVisible();
  expect(calls.added).toEqual([
    { scope: "screen", selector: "id:clock", action: "ignore" },
  ]);
  await expect.poll(() => calls.structureLoads).toBeGreaterThan(loadsBefore);
  await expect(page.getByTestId("elementPopover")).toHaveCount(0);
});

test("compares only a picked element", async ({ openProjectPage, page }) => {
  const calls = await openReview(page, openProjectPage);
  await startSelecting(page);
  await clickElement(page, pay, "baseline");
  await expect(page.getByTestId("elementPopover")).toBeVisible();
  await page.keyboard.press("c");

  await expect
    .poll(() => calls.added)
    .toEqual([{ scope: "screen", selector: "id:btn_pay", action: "compare" }]);
});

test("keeps compare only to this screen", async ({ openProjectPage, page }) => {
  await openReview(page, openProjectPage);
  await startSelecting(page);
  await clickElement(page, pay);
  const popover = page.getByTestId("elementPopover");
  await popover.getByRole("button", { name: "All screens" }).click();

  await expect(popover.getByTestId("elementAction-compare")).toBeDisabled();
  await expect(popover.getByTestId("elementAction-ignore")).toBeEnabled();
});

test("adds one rule per selected element", async ({
  openProjectPage,
  page,
}) => {
  const calls = await openReview(page, openProjectPage);
  await startSelecting(page);
  // the popover opens to the right of the click: the clock, left of it, stays clear
  await clickElement(page, pay);
  await clickElement(page, clock, "current", { shift: true });
  await expect(page.getByTestId("elementPopover")).toContainText("2 selected");
  await page.getByTestId("elementAction-ignore").click();

  await expect
    .poll(() => calls.added.map((rule) => rule.selector))
    .toEqual(["id:btn_pay", "id:clock"]);
  await expect(page.getByText("2 rules added; compared again")).toBeVisible();
});

test("undoes a rule from the notice", async ({ openProjectPage, page }) => {
  const calls = await openReview(page, openProjectPage);
  await startSelecting(page);
  await clickElement(page, clock);
  await page.getByTestId("elementAction-ignore").click();
  await page.getByTestId("undoRule").click();

  await expect
    .poll(() => calls.removed)
    .toEqual([{ scope: "screen", ruleId: "new-1" }]);
});

test("stays in selection until Esc", async ({ openProjectPage, page }) => {
  await openReview(page, openProjectPage);
  await startSelecting(page);
  await clickElement(page, clock);
  await page.getByTestId("elementAction-ignore").click();
  await expect(page.getByTestId("selectingBar")).toBeVisible();

  await clickElement(page, pay);
  await expect(page.getByTestId("elementPopover")).toBeVisible();
  // the first Esc closes what is open next to the element, the next one leaves
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("elementPopover")).toHaveCount(0);
  await expect(page.getByTestId("selectingBar")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("selectingBar")).toHaveCount(0);
  // and the review is still open
  await expect(page.getByTestId("selectElements")).toBeVisible();
});

test("offers to remove the rule an element is under", async ({
  openProjectPage,
  page,
}) => {
  const calls = await openReview(page, openProjectPage, {
    ...baseStructure,
    rules: [ruleOn(clock, "ignore", { scope: "project" })],
  });
  await startSelecting(page);
  await clickElement(page, clock);
  const popover = page.getByTestId("elementPopover");
  await expect(popover).toContainText("Ignored");
  await expect(popover).toContainText("All screens");
  await expect(popover.getByTestId("elementAction-ignore")).toHaveCount(0);

  // a rule for every screen is asked about first
  await popover.getByTestId("elementRemoveRule").click();
  expect(calls.removed).toEqual([]);
  await popover.getByRole("button", { name: "Remove on every screen" }).click();
  await expect
    .poll(() => calls.removed)
    .toEqual([{ scope: "project", ruleId: "rule-4" }]);
});

test("opens the full rule form from the element", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage);
  await startSelecting(page);
  await clickElement(page, amount);
  // the text inside the card was meant: step out to the card
  await page.keyboard.press("ArrowUp");
  await expect(page.getByTestId("elementPopover")).toContainText(
    "Balance card",
  );
  await page.getByTestId("elementMore").click();

  const form = page.getByRole("dialog", { name: "Ignore element" });
  await expect(form).toBeVisible();
  await expect(form.getByLabel("Element")).toHaveValue("Balance card");
});

test("marks rules on both screenshots", async ({ openProjectPage, page }) => {
  await openReview(page, openProjectPage, {
    ...baseStructure,
    rules: [
      ruleOn(clock, "ignore"),
      ruleOn(pay, "tolerate", { maxDiffPercent: 5 }),
    ],
  });
  for (const side of ["baseline", "current"] as const) {
    // the hatching inside the ignored clock, the dashed edge of the tolerated button
    await expect
      .poll(() => overlayAlpha(page, side, middleOf(clock)))
      .toBeGreaterThan(0);
    await expect
      .poll(() => overlayAlpha(page, side, edgeOf(pay)))
      .toBeGreaterThan(0);
    // a tolerated element is outlined, not filled
    await expect.poll(() => overlayAlpha(page, side, middleOf(pay))).toBe(0);
  }
  await expect.poll(() => overlayAlpha(page, "current", empty)).toBe(0);
});

test("highlights a rule's elements on hover", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage, {
    ...baseStructure,
    rules: [ruleOn(pay, "tolerate")],
  });
  // the inside of a tolerated element is clear until its rule is pointed at
  const inside = () => overlayAlpha(page, "current", middleOf(pay));
  await expect.poll(inside).toBe(0);
  await openChanges(page);
  await page.getByTestId("elementRule").hover();
  await expect.poll(inside).toBeGreaterThan(0);
});

test("dims the screenshot outside the compared elements", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage, {
    ...baseStructure,
    rules: [ruleOn(pay, "compare")],
    compareOnly: { active: true, keep: [pay.bounds], problems: [] },
  });
  for (const side of ["baseline", "current"] as const) {
    await expect.poll(() => overlayAlpha(page, side, empty)).toBeGreaterThan(0);
    await expect.poll(() => overlayAlpha(page, side, middleOf(pay))).toBe(0);
  }
  await openChanges(page);
  // the run's saved and test areas still count
  await expect(page.getByTestId("comparedSummary")).toHaveText(
    "Only 1 element · without 2 areas",
  );
});

test("offers an area when the screenshot has no UI tree", async ({
  openProjectPage,
  page,
}) => {
  await openReview(
    page,
    openProjectPage,
    { ...baseStructure, hasUiTree: false, elements: [], baselineElements: [] },
    { ...TEST_UNRESOLVED, uiTreeName: null },
  );
  await page.getByTestId("selectElements").click();
  await expect(page.getByTestId("noTree")).toContainText(
    "No UI tree on this screenshot",
  );
  await expect(page.getByTestId("selectingBar")).toHaveCount(0);

  await page.getByTestId("drawAreaInstead").click();
  await expect(page.getByTestId("areasMenu")).toBeVisible();
  await expect(page.getByTestId("areaDraw")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("offers element actions on a changed area", async ({
  openProjectPage,
  page,
}) => {
  await openReview(page, openProjectPage, {
    ...baseStructure,
    regions: [
      {
        region: pay.bounds,
        key: "id:btn_pay",
        element: "Pay",
        resourceId: "com.bank.app:id/btn_pay",
      },
    ],
  });
  await openChanges(page);
  const area = page.getByTestId("changedArea");
  await expect(area.getByRole("button", { name: "Ignore" })).toBeVisible();
  await area.getByTestId("changedAreaMore").click();
  await page.getByRole("menuitem", { name: "Compare only" }).click();

  const form = page.getByRole("dialog", { name: "Compare only" });
  await expect(form).toBeVisible();
  await expect(form.getByLabel("Element")).toHaveValue("Pay");
});
