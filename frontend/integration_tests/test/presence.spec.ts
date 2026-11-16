import { expect } from "@playwright/test";
import { AUTH_USER, test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
  TEST_UNRESOLVED,
} from "~client/_test/test.data.helper";
import {
  mockGetBuildDetails,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestRuns,
  mockImage,
  mockSocket,
  mockTestRun,
} from "utils/mocks";

// Spec 056: who else has a screen of the build open, told over the events socket.

const project = TEST_PROJECT;
const build = TEST_BUILD_FAILED;
const presence = (buildId: string, testRunId: string | null) =>
  `42${JSON.stringify(["presence", { buildId, testRunId }])}`;

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, [TEST_UNRESOLVED]);
  await mockTestRun(page, TEST_UNRESOLVED);
  await mockImage(page, "image.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "baseline.png");
});

test("tells which build and screen this tab has open", async ({
  page,
  openProjectPage,
}) => {
  const { sent } = await mockSocket(page);

  const projectPage = await openProjectPage(project.id, build.id);
  await expect.poll(() => sent).toContain(presence(build.id, null));

  // opened inside the page: the same connection tells the new screen
  await projectPage.testRunList.gridViewToggle.click();
  await page
    .getByTestId("testRunCard")
    .first()
    .getByRole("button")
    .first()
    .click();
  await expect(page.getByTestId("screenName")).toBeVisible();
  await expect
    .poll(() => sent)
    .toContain(presence(build.id, TEST_UNRESOLVED.id));
});

test("shows a colleague on the tile and in the comparison, never oneself", async ({
  page,
  openProjectPage,
}) => {
  const socket = await mockSocket(page);
  const projectPage = await openProjectPage(project.id, build.id);
  await projectPage.testRunList.gridViewToggle.click();
  await expect.poll(() => socket.sent).toContain(presence(build.id, null));

  socket.emit("presence", {
    buildId: build.id,
    viewers: [
      { userId: AUTH_USER.id, name: "Me M.", testRunId: TEST_UNRESOLVED.id },
      { userId: "u-olena", name: "Olena K.", testRunId: TEST_UNRESOLVED.id },
    ],
  });

  const tile = page.getByTestId("testRunCard").getByTestId("presence");
  await expect(tile).toHaveText("OK");
  await expect(tile).toHaveAttribute("aria-label", "Open now: Olena K.");

  await page
    .getByTestId("testRunCard")
    .first()
    .getByRole("button")
    .first()
    .click();
  await expect(page.getByTestId("screenName")).toBeVisible();
  socket.emit("presence", {
    buildId: build.id,
    viewers: [
      { userId: AUTH_USER.id, name: "Me M.", testRunId: TEST_UNRESOLVED.id },
      { userId: "u-olena", name: "Olena K.", testRunId: TEST_UNRESOLVED.id },
    ],
  });
  const header = page.getByRole("dialog").getByTestId("presence");
  await expect(header).toContainText("here too");

  // Olena moved on: she is gone from this screen
  socket.emit("presence", {
    buildId: build.id,
    viewers: [{ userId: "u-olena", name: "Olena K.", testRunId: "other" }],
  });
  await expect(page.getByRole("dialog").getByTestId("presence")).toHaveCount(0);
});

test("ignores who is in another build", async ({ page, openProjectPage }) => {
  const socket = await mockSocket(page);
  const projectPage = await openProjectPage(project.id, build.id);
  await projectPage.testRunList.gridViewToggle.click();
  await expect.poll(() => socket.sent).toContain(presence(build.id, null));

  socket.emit("presence", {
    buildId: "another-build",
    viewers: [
      { userId: "u-olena", name: "Olena K.", testRunId: TEST_UNRESOLVED.id },
    ],
  });
  await page.waitForTimeout(700);

  await expect(page.getByTestId("presence")).toHaveCount(0);
});
