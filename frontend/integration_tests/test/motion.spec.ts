import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_RUN_NEW,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import {
  mockGetBuildDetails,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestRuns,
  mockImage,
  mockTestRun,
} from "utils/mocks";

const project = TEST_PROJECT;
const build = TEST_BUILD_FAILED;

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, [TEST_UNRESOLVED, TEST_RUN_NEW]);
  await mockTestRun(page, TEST_UNRESOLVED);
  await mockTestRun(page, TEST_RUN_NEW);
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
});

// what the reviewer sees of the screenshots: the canvas pixels (as a
// screenshot: the images come from the API's origin, so the canvas cannot be
// read directly), where each canvas sits, and anything that would distort it
const screenshots = async (page: Page) => {
  const canvases = page.locator(".konvajs-content canvas");
  const result = [];
  for (let i = 0; i < (await canvases.count()); i++) {
    const canvas = canvases.nth(i);
    const box = await canvas.boundingBox();
    result.push({
      pixels: (await canvas.screenshot({ animations: "disabled" })).toString(
        "base64",
      ),
      at: box && [Math.round(box.x), Math.round(box.y), box.width, box.height],
      look: await canvas.evaluate((el) => {
        const chain: Element[] = [];
        for (let node: Element | null = el; node; node = node.parentElement) {
          chain.push(node);
        }
        return chain
          .map((node) => {
            const style = getComputedStyle(node);
            return `${style.transform}|${style.filter}|${style.opacity}`;
          })
          .join(";");
      }),
    });
  }
  return result;
};

test("screenshots do not move after the step appears", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);
  await expect(page.locator(".konvajs-content canvas").first()).toBeVisible();
  // past the step's slide (220 ms) and the images' loading
  await page.waitForTimeout(800);
  const first = await screenshots(page);
  await page.waitForTimeout(1500);
  const later = await screenshots(page);

  expect(first.length).toBeGreaterThan(0);
  expect(later).toEqual(first);
  // no blur on the way up; the zoom's scale is fine as long as it holds still
  for (const canvas of later) {
    expect(canvas.look).not.toMatch(/blur/);
  }
});

test("reduced motion turns every animation off", async ({
  openProjectPage,
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openProjectPage(project.id, build.id);
  await expect(
    page
      .getByTestId("testRunCard")
      .or(page.locator(".MuiDataGrid-row"))
      .first(),
  ).toBeVisible();

  const durations = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .map((el) => getComputedStyle(el))
      .filter((style) => style.animationName !== "none")
      .map((style) => parseFloat(style.animationDuration) * 1000),
  );
  for (const duration of durations) expect(duration).toBeLessThanOrEqual(1);
  await expect(page.getByTestId("brandMark")).toHaveAttribute(
    "data-playing",
    "false",
  );
  // counters show their number at once
  await expect(page.getByTestId("buildStatusBar")).toBeVisible();
});

test("highlights travel to the new item instead of jumping", async ({
  openProjectPage,
  page,
}) => {
  // a transition that starts is a highlight on its way; one that jumps never
  // runs. Recorded as they start, so a slow machine cannot miss them.
  await page.addInitScript(() => {
    const runs: unknown[] = [];
    Object.assign(window, { transitionRuns: runs });
    document.addEventListener(
      "transitionrun",
      (event) => {
        const target = event.target as Element;
        runs.push({
          property: event.propertyName,
          pseudo: event.pseudoElement,
          testId: target.getAttribute("data-testid"),
          className: target.getAttribute("class") ?? "",
          holds: Array.from(target.querySelectorAll("[data-testid]")).map(
            (node) => node.getAttribute("data-testid"),
          ),
        });
      },
      true,
    );
  });
  type Run = {
    property: string;
    pseudo: string;
    testId: string | null;
    className: string;
    holds: string[];
  };
  const runs = () =>
    page.evaluate(
      () => (window as unknown as { transitionRuns: Run[] }).transitionRuns,
    );
  const travelled = (match: (run: Run) => boolean) =>
    expect.poll(async () => (await runs()).some(match)).toBe(true);

  await openProjectPage(project.id, build.id);
  await expect(page.getByTestId("navIndicator")).toBeVisible();

  // a build tab, and back to the list of all tests
  await page.getByRole("tab", { selected: false }).first().click();
  await travelled(
    (run) =>
      run.className.includes("MuiTabs-indicator") && run.property === "left",
  );

  await page.getByRole("tab", { name: /All tests/ }).click();

  // a segment, even though the other view draws the switch anew
  await page.getByTestId("gridViewToggle").click();
  await travelled(
    (run) =>
      run.pseudo === "::before" &&
      run.property === "transform" &&
      run.holds.includes("gridViewToggle"),
  );

  // the rail
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link")
    .nth(2)
    .click();
  await travelled(
    (run) => run.testId === "navIndicator" && run.property === "transform",
  );
});
