import { expect } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_RUN_NEW,
  TEST_RUN_OK,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import { GO_TO_NEXT_KEY } from "~client/constants/storage";
import { Project, TestRun } from "~client/types";
import {
  API_URL,
  mockGetBuildDetails,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestRuns,
  mockImage,
  mockSocket,
  mockTestRun,
  unfoldPanel,
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
  await page.route(`${API_URL}/test-runs/approve?merge=false`, (route) =>
    route.fulfill({ status: 200, body: "[]" }),
  );
});

// The app anchors toasts bottom-centre, which is clear of both paginations on
// the list. The dialog puts its approve/reject bar in exactly that spot, so a
// toast there lands on the buttons and blocks the next screen's approval until
// it times out or is dismissed.
test("raises its toast clear of the approve buttons", async ({
  openProjectPage,
  page,
}) => {
  const projectPage = await openProjectPage(
    project.id,
    build.id,
    TEST_UNRESOLVED.id,
  );
  // by text, not by role name: the tooltip wrapper makes "Hotkey: A" the
  // button's accessible name. Anchored so no longer label can match.
  const approve = page.locator("button").filter({ hasText: /^Approve$/ });
  await expect(approve).toBeVisible();
  const buttons = await approve.boundingBox();

  await approve.click();

  await expect(projectPage.notification.message).toBeVisible();
  const toast = await projectPage.notification.message.boundingBox();
  expect(toast.y + toast.height).toBeLessThanOrEqual(buttons.y);
});

// A screen now takes a couple of seconds to review and a toast lives five, so
// approving one after another piles them up over the checkpoint's header.
test("replaces its confirmation rather than stacking them up", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);
  const approve = page.locator("button").filter({ hasText: /^Approve$/ });

  await approve.click();
  await approve.click();
  await approve.click();

  await expect(page.getByText("Approved")).toHaveCount(1);
});

// A decision can be taken back for 8 seconds (REQ-018-70), so its notice stays
// that long; the next decision still takes its place rather than piling up.
test("lets the confirmation go before the next screen is reviewed", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);

  await page
    .locator("button")
    .filter({ hasText: /^Approve$/ })
    .click();

  await expect(page.getByText("Approved")).toBeVisible();
  // still there past the old two seconds: Undo is on it
  await page.waitForTimeout(3500);
  await expect(page.getByText("Approved")).toBeVisible();
  await expect(page.getByText("Approved")).toBeHidden({ timeout: 6000 });
});

// Errors are not interchangeable the way the confirmations are: a failure must
// not be swallowed by whatever the reviewer does next.
test("lets an error outlive the confirmation that follows it", async ({
  openProjectPage,
  page,
}) => {
  await page.route(`${API_URL}/test-runs/reject`, (route) =>
    route.fulfill({ status: 500, body: JSON.stringify({ message: "nope" }) }),
  );
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);

  await page
    .locator("button")
    .filter({ hasText: /^Reject$/ })
    .click();
  await expect(page.getByText("nope")).toBeVisible();
  await page
    .locator("button")
    .filter({ hasText: /^Approve$/ })
    .click();

  await expect(page.getByText("nope")).toBeVisible();
  await expect(page.getByText("Approved")).toBeVisible();
});

// The dialog stays mounted as the reviewer steps between runs, so state that
// belongs to one screen has to be cleared with it. Draw mode was not: it rode
// along, and the next click on a screenshot quietly drew an ignore area there,
// marking a run touched that the reviewer never meant to edit — which then
// blocked the very navigation that would have cleared the flag.
test("leaves draw mode behind when moving to another run", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);
  // drawing is in the Areas menu (REQ-024-30)
  const drawMode = page.getByTestId("areaDraw");

  await page.getByTestId("areasButton").click();
  await drawMode.click();
  await expect(drawMode).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");

  await expect(page).toHaveURL(new RegExp(`testId=${TEST_RUN_NEW.id}$`));
  // the menu closed with the screen it belonged to; opened again, it does not draw
  await expect(page.getByTestId("areasMenu")).toBeHidden();
  await page.getByTestId("areasButton").click();
  await expect(drawMode).toHaveAttribute("aria-pressed", "false");
});

// A rejection is not a success. Dressing it in the same green tick as an
// approval makes the two indistinguishable at a glance, which matters most
// when they sit next to each other and are pressed in a hurry.
test("does not dress a rejection up as a success", async ({
  openProjectPage,
  page,
}) => {
  await page.route(`${API_URL}/test-runs/reject`, (route) =>
    route.fulfill({ status: 200, body: "[]" }),
  );
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);

  await page
    .locator("button")
    .filter({ hasText: /^Reject$/ })
    .click();

  const toast = page.locator(".notistack-MuiContent", {
    hasText: "Rejected",
  });
  await expect(toast).toBeVisible();
  await expect(toast).not.toHaveClass(/notistack-MuiContent-success/);
});

test("keeps the review layout and its keys", async ({
  openProjectPage,
  page,
}) => {
  await page.route(`${API_URL}/test-runs/reject`, (route) =>
    route.fulfill({ status: 200, body: "[]" }),
  );
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);

  // nothing to say about this screen: the side panel opens folded (REQ-046-07)
  await page.getByTestId("panelUnfold").click();
  // the same parts in the same places as before the redesign
  await expect(page.getByText("Baseline", { exact: true })).toBeVisible();
  await expect(page.getByText("Current", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Accessibility" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Changes" })).toBeVisible();
  await expect(page.getByTestId("approveButton")).toBeVisible();
  await expect(page.getByTestId("rejectButton")).toBeVisible();
  await expect(page.getByTestId("diffMeter")).toBeVisible();

  const [approve] = await Promise.all([
    page.waitForRequest(`${API_URL}/test-runs/approve?merge=false`),
    page.keyboard.press("a"),
  ]);
  expect(approve.postDataJSON()).toEqual([TEST_UNRESOLVED.id]);

  const [reject] = await Promise.all([
    page.waitForRequest(`${API_URL}/test-runs/reject`),
    page.keyboard.press("x"),
  ]);
  expect(reject.postDataJSON()).toEqual([TEST_UNRESOLVED.id]);

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(new RegExp(`testId=${TEST_RUN_NEW.id}`));
  // as a person would: Esc once the next step is on screen
  await expect(page.getByTestId("screenName")).toHaveText(TEST_RUN_NEW.name);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("approveButton")).toBeHidden();
});

test("shows the A and X keys on Approve and Reject", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);
  const keyOf = (testId: string) =>
    page
      .getByTestId(testId)
      .evaluate((el) => getComputedStyle(el, "::after").content);

  expect(await keyOf("approveButton")).toBe('"A"');
  expect(await keyOf("rejectButton")).toBe('"X"');
  // the hint is drawn, not written: the buttons still read Approve and Reject
  await expect(page.getByTestId("approveButton")).toHaveText("Approve");
  await expect(page.getByTestId("rejectButton")).toHaveText("Reject");
});

test("shows a check on Approve instead of a toast", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);
  const approve = page.getByTestId("approveButton");

  await approve.click();
  await expect(page.getByTestId("approvedTick")).toBeVisible();
  await expect(approve).toHaveAttribute("data-ticked", "true");
  // the tick is a moment, not a state
  await expect(approve).toHaveAttribute("data-ticked", "false", {
    timeout: 2000,
  });
});

test("shows the diff against the tolerance in words and no position", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);
  // 1.24 % of a 3.21 % tolerance: under it, so in the text colour (REQ-047-06)
  await expect(page.getByTestId("diffMeter")).toHaveText(
    "1.24% changed·3.21% allowed",
  );
  await expect(page.getByTestId("diffValue")).not.toHaveCSS(
    "color",
    "rgb(180, 35, 24)",
  );
  await expect(page.getByTestId("diffFill")).toHaveCount(0);

  // the header names the screen; no "N of M" (REQ-047-05)
  await expect(page.getByTestId("stepProgress")).toHaveCount(0);
  await expect(page.getByTestId("compareHeader")).not.toContainText(" of ");
});

// the bulk review of a screen's variations was removed (022); a project saved
// with it on still has the columns, and the review must not bring it back
test("offers no variations actions, even where the project had them on", async ({
  openProjectPage,
  page,
}) => {
  const sibling = { ...TEST_UNRESOLVED, id: "sibling", customTags: "uk" };
  await mockGetProjects(page, [
    {
      ...project,
      bulkApproveVariations: true,
      bulkApproveGroupBy: "customTags",
    } as Project,
  ]);
  await mockGetTestRuns(page, build.id, [TEST_UNRESOLVED, sibling]);
  await mockTestRun(page, sibling);

  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);

  await expect(page.getByTestId("approveButton")).toBeVisible();
  await expect(page.getByText(/variations/i)).toHaveCount(0);
});

test("takes a decision back with Undo", async ({ openProjectPage, page }) => {
  await page.route(`${API_URL}/test-runs/approve?merge=false`, (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ decisionId: "d-1" }) }),
  );
  let refuse = false;
  await page.route(`${API_URL}/test-runs/undo/d-1`, (route) =>
    refuse
      ? route.fulfill({
          status: 409,
          body: JSON.stringify({
            message: "Someone approved this screen again after this decision.",
          }),
        })
      : route.fulfill({ status: 200, body: JSON.stringify({ undone: 1 }) }),
  );
  await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);

  await page.getByTestId("approveButton").click();
  const [undo] = await Promise.all([
    page.waitForRequest(`${API_URL}/test-runs/undo/d-1`),
    page.getByTestId("undoDecision").click(),
  ]);
  expect(undo.method()).toBe("POST");
  await expect(page.getByText("Undone")).toBeVisible();
  // the used notification leaves; on a slow machine it is still fading out
  // when the next decision raises its own
  await expect(page.getByTestId("undoDecision")).toHaveCount(0);

  // when the server says no, the reason is shown
  refuse = true;
  await page.getByTestId("approveButton").click();
  await page.getByTestId("undoDecision").click();
  await expect(
    page.getByText("Could not undo: Someone approved this screen again"),
  ).toBeVisible();
});

// A run opened from its address is on screen before its build's list has
// loaded. A step asked for in that moment counted from nowhere: → did nothing,
// or went to whichever run the list starts with. It waits for the list.
for (const keys of [["ArrowRight"], ["a", "x", "ArrowRight"]]) {
  test(`takes ${keys.join(", ")} pressed before the list has loaded to the next step`, async ({
    openProjectPage,
    page,
  }) => {
    await page.route(
      `${API_URL}/test-runs?buildId=${build.id}`,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({
          body: JSON.stringify([TEST_UNRESOLVED, TEST_RUN_NEW]),
        });
      },
    );
    await page.route(`${API_URL}/test-runs/reject`, (route) =>
      route.fulfill({ status: 200, body: "[]" }),
    );
    await openProjectPage(project.id, build.id, TEST_UNRESOLVED.id);
    await expect(page.getByTestId("approveButton")).toBeVisible();

    for (const key of keys) await page.keyboard.press(key);

    await expect(page).toHaveURL(new RegExp(`testId=${TEST_RUN_NEW.id}$`));
    await expect(page.getByTestId("screenName")).toHaveText(TEST_RUN_NEW.name);
  });
}

test.describe("with Go to the next on", () => {
  const runs: TestRun[] = [TEST_UNRESOLVED, TEST_RUN_NEW, TEST_RUN_OK].map(
    (run) => ({ ...run, buildId: build.id }),
  );

  test.beforeEach(async ({ page }) => {
    await mockGetTestRuns(page, build.id, runs);
    for (const run of runs) await mockTestRun(page, run);
    // the report is what turns the run approved on screen
    const { emit } = await mockSocket(page);
    for (const [path, status] of [
      ["approve?merge=false", "approved"],
      ["reject", "failed"],
    ]) {
      await page.route(`${API_URL}/test-runs/${path}`, async (route) => {
        const ids: string[] = route.request().postDataJSON();
        // as the server does: the report goes out before the answer, and a
        // request takes a moment
        emit(
          "testRun_updated",
          runs
            .filter((run) => ids.includes(run.id))
            .map((run) => ({
              ...run,
              status,
            })),
        );
        await new Promise((resolve) => setTimeout(resolve, 150));
        await route.fulfill({ body: "{}" });
      });
    }
    await page.addInitScript(
      (key) => localStorage.setItem(key, "true"),
      GO_TO_NEXT_KEY,
    );
  });

  // The decision moves the review a moment after the key: once the server
  // answers, and after the tick on Approve. An arrow pressed in that moment
  // acted on the step the decision was about to leave, so how far A then →
  // went depended on how fast the server was. Each key is one step.
  for (const [key, decision] of [
    ["a", "approve"],
    ["x", "reject"],
  ]) {
    test(`counts an arrow pressed right after ${decision} from the step the decision moves to`, async ({
      openProjectPage,
      page,
    }) => {
      await openProjectPage(project.id, build.id, runs[0].id);
      await expect(page.getByTestId("screenName")).toHaveText(runs[0].name);

      await page.keyboard.press(key);
      await page.keyboard.press("ArrowRight");

      await expect(page.getByTestId("screenName")).toHaveText(runs[2].name);
      await expect(page).toHaveURL(new RegExp(`testId=${runs[2].id}$`));
      // and nothing moves it on afterwards
      await page.waitForTimeout(1000);
      await expect(page.getByTestId("screenName")).toHaveText(runs[2].name);
    });
  }

  test("moves on by itself after approving with the key", async ({
    openProjectPage,
    page,
  }) => {
    await openProjectPage(project.id, build.id, runs[0].id);
    await expect(page.getByTestId("screenName")).toHaveText(runs[0].name);

    await page.keyboard.press("a");

    await expect(page.getByTestId("screenName")).toHaveText(runs[1].name);
    await page.waitForTimeout(1000);
    await expect(page.getByTestId("screenName")).toHaveText(runs[1].name);
  });

  test("stays on the screen and lets the arrow go when the server refuses", async ({
    openProjectPage,
    page,
  }) => {
    await page.route(`${API_URL}/test-runs/approve?merge=false`, (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ message: "nope" }) }),
    );
    await openProjectPage(project.id, build.id, runs[0].id);
    await expect(page.getByTestId("screenName")).toHaveText(runs[0].name);

    await page.keyboard.press("a");
    await page.keyboard.press("ArrowRight");

    await expect(page.getByText("nope")).toBeVisible();
    await expect(page.getByTestId("screenName")).toHaveText(runs[1].name);
    await page.waitForTimeout(1000);
    await expect(page.getByTestId("screenName")).toHaveText(runs[1].name);
  });
});

test("has no Devices tab and no capture warnings", async ({
  openProjectPage,
  page,
}) => {
  // as an older version kept them on the run and in the structure (spec 020)
  const saved = [
    { kind: "loading", message: "Taken before the screen settled" },
    { kind: "screen-mismatch", message: "This does not look like its screen" },
  ];
  const run = {
    ...TEST_UNRESOLVED,
    hasUiTree: true,
    captureWarnings: JSON.stringify(saved),
  } as TestRun;
  await mockGetTestRuns(page, build.id, [run]);
  await mockTestRun(page, run);
  await page.route(`${API_URL}/test-runs/${run.id}/a11y`, (route) =>
    route.fulfill({ body: "null" }),
  );
  await page.route(`${API_URL}/test-runs/${run.id}/structure`, (route) =>
    route.fulfill({
      body: JSON.stringify({
        hasUiTree: true,
        hasBaselineUiTree: true,
        changes: [],
        regions: [],
        hints: [],
        invisible: [],
        warnings: saved,
        rules: [],
        ignoredAreas: [],
        toleratedAreas: [],
        systemBars: [],
        moves: [],
        elements: [],
        settings: null,
      }),
    }),
  );

  await openProjectPage(project.id, build.id, run.id);
  // the folded panel opens like any other (folding itself: compareLayout)
  await unfoldPanel(page);
  await expect(page.getByRole("tab", { name: "Changes" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Devices" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Changes" }).click();
  for (const text of [
    "Taken before the screen settled",
    "This does not look like its screen",
    "Loading",
    "Other screen?",
  ]) {
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  }
});

test("says accessibility needs the UI tree when it cannot be read", async ({
  openProjectPage,
  page,
}) => {
  const run = { ...TEST_UNRESOLVED, hasUiTree: true } as TestRun;
  await mockGetTestRuns(page, build.id, [run]);
  await mockTestRun(page, run);
  await page.route(`${API_URL}/test-runs/${run.id}/a11y`, (route) =>
    route.fulfill({ body: "null" }),
  );

  await openProjectPage(project.id, build.id, run.id);
  await page.getByTestId("panelUnfold").click();
  await expect(
    page.getByText(
      "Accessibility is checked from the UI tree, and this screen's tree could not be read.",
    ),
  ).toBeVisible();
});
