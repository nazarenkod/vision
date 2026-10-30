import { expect, Page, Request } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import {
  API_URL,
  mockGetBuildDetails,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestRuns,
  mockImage,
  mockTestRun,
} from "utils/mocks";

const project = TEST_PROJECT;
const build = TEST_BUILD_FAILED;
const run = { ...TEST_UNRESOLVED, hasUiTree: true };

const bounds = { x: 0, y: 2200, width: 100, height: 100 };
const button = (label: string) => ({
  id: `touch-target|id:${label}#PbButton`,
  rule: "touch-target",
  severity: "warning",
  title: "Touch target too small",
  message: `Button "${label}" is 38 × 38 dp, minimum is 48 × 48 dp.`,
  nodeKey: `id:${label}#PbButton`,
  resourceId: `${label}#PbButton`,
  className: "android.widget.Button",
  label,
  bounds,
  status: "new",
  group: "touch-target|c:PbButton|38x38",
  problemCode: "a11y-3f9c2a1b",
});
const icon = {
  ...button("icon"),
  id: "missing-label|id:com.bank:id/icon",
  rule: "missing-label",
  severity: "error",
  title: "Control has no label",
  message: "Clickable image has no label.",
  nodeKey: "id:com.bank:id/icon",
  resourceId: "com.bank:id/icon",
  group: "missing-label|c:icon|",
  problemCode: "a11y-0a1b2c3d",
  // filed from another screen: the component's problem is covered here too
  issue: {
    status: "reported",
    jiraKey: "MOB-7",
    jiraUrl: null,
    screenName: "Платежі. Головна",
    screenTitle: "Платежі",
    // settings now see two filed problems as one: both bugs show
    related: [{ code: "a11y-99999999", jiraKey: "MOB-8", jiraUrl: null }],
  },
};
const report = {
  format: "appium-android",
  pixelsPerDp: 2.6,
  pixelsPerDpEstimated: false,
  baselineChecked: true,
  summary: { new: 2, existing: 0, reported: 1, ignored: 0, fixed: 0, total: 3 },
  violations: [button("Адреса реєстрації"), button("Адреса роботи"), icon],
  ignored: [],
  fixed: [],
  resolved: [],
};

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, [run]);
  await mockTestRun(page, run);
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
  await page.route(`${API_URL}/test-runs/${run.id}/a11y`, (route) =>
    route.fulfill({ body: JSON.stringify(report) }),
  );
});

const posted = (request: Request) => JSON.parse(request.postData() ?? "{}");

// Two buttons of one component with the same tap area are one fix, so one
// card and one bug, not two bugs a developer closes as duplicates.
test("shows one problem for the same issue on elements of one component", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, run.id);
  const problems = page.getByTestId("a11yProblem");

  await expect(problems).toHaveCount(2);
  await expect(problems.first()).toContainText(
    "The same issue on 2 elements of PbButton",
  );
  await expect(problems.first().getByTestId("a11yProblemCode")).toHaveText(
    "a11y-3f9c2a1b",
  );

  const ignore = page.waitForRequest(
    `${API_URL}/test-runs/${run.id}/a11y/ignore`,
  );
  await problems
    .first()
    .getByRole("button", { name: "False positive" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Mark as false positive" })
    .click();
  expect(posted(await ignore).violationIds).toEqual([
    button("Адреса реєстрації").id,
    button("Адреса роботи").id,
  ]);
});

// A component problem filed from another screen holds here: nothing to file.
test("shows a problem filed on another screen as covered", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, run.id);
  const covered = page.getByTestId("a11yProblem").nth(1);

  await expect(covered).toContainText("Bug MOB-7");
  await expect(covered.getByTestId("a11yElsewhere")).toContainText(
    "A problem of icon: filed on screen “Платежі”",
  );
  await expect(covered.getByTestId("a11yRelated")).toContainText(
    "Also filed for it: MOB-8 (a11y-99999999)",
  );
  await expect(
    covered.getByRole("button", { name: "Create Jira bug" }),
  ).toHaveCount(0);
  await expect(
    covered.getByRole("button", { name: "Unlink on every screen" }),
  ).toBeVisible();
});

// how opaque the frames drawn over the checkpoint are inside a box
const frameAlpha = (
  page: Page,
  box: { x: number; y: number; width: number; height: number },
) =>
  page
    .getByTestId("drawArea")
    .nth(1)
    .evaluate(
      (pane, [area, width]) => {
        const canvases = pane.querySelectorAll("canvas");
        const overlay = canvases[canvases.length - 1];
        const ratio = overlay.width / width;
        try {
          const data = overlay
            .getContext("2d")
            ?.getImageData(
              Math.round(area.x * ratio),
              Math.round(area.y * ratio),
              Math.max(1, Math.round(area.width * ratio)),
              Math.max(1, Math.round(area.height * ratio)),
            ).data;
          let max = 0;
          for (let i = 3; i < (data?.length ?? 0); i += 4)
            max = Math.max(max, data?.[i] ?? 0);
          return max;
        } catch {
          return 0;
        }
      },
      [box, 1280] as const,
    );

test("switches the frames on the screenshot from the Accessibility tab", async ({
  openProjectPage,
  page,
}) => {
  const framed = { x: 200, y: 200, width: 200, height: 100 };
  await page.route(`${API_URL}/test-runs/${run.id}/a11y`, (route) =>
    route.fulfill({
      body: JSON.stringify({
        ...report,
        violations: [{ ...button("Pay"), bounds: framed }],
      }),
    }),
  );
  await openProjectPage(project.id, build.id, run.id);
  const leftEdge = { x: framed.x - 2, y: framed.y + 20, width: 4, height: 60 };

  const panel = page.getByRole("complementary");
  await expect(panel.getByText("Highlight on screenshot")).toBeVisible();
  await expect.poll(() => frameAlpha(page, leftEdge)).toBeGreaterThan(0);

  await panel.getByTestId("a11yMarksSwitch").click();
  await expect.poll(() => frameAlpha(page, leftEdge)).toBe(0);
});
