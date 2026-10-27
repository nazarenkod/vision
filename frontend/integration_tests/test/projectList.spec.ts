import { expect } from "@playwright/test";
import { test } from "fixtures";
import { TEST_PROJECT } from "~client/_test/test.data.helper";
import { PIXELMATCH_DEFAULT_CONFIG } from "~client/constants/project";
import { ImageComparison } from "~client/types/imageComparison";
import {
  API_URL,
  mockDeleteProject,
  mockGetProjects,
  mockSaveProject,
} from "utils/mocks";

const project = TEST_PROJECT;

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [project]);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test("renders", async ({ projectListPage, page }) => {
  await expect(page).toHaveScreenshot("projects-list-page.png");
});

test("can delete project", async ({ projectListPage, page }) => {
  await mockDeleteProject(page, project);

  await projectListPage.deleteBtn.click();
  await projectListPage.modal.confirmBtn.click();

  await expect(projectListPage.notification.message).toHaveText(
    "Project name deleted",
  );
});

test("can dismiss a notification without waiting it out", async ({
  projectListPage,
  page,
}) => {
  await mockDeleteProject(page, project);

  await projectListPage.deleteBtn.click();
  await projectListPage.modal.confirmBtn.click();
  await expect(projectListPage.notification.message).toBeVisible();

  await projectListPage.notification.dismissBtn.click();

  // shorter than autoHideDuration, so waiting the toast out cannot pass this
  await expect(projectListPage.notification.message).toBeHidden({
    timeout: 1000,
  });
});

test("creates a project and opens its settings", async ({
  projectListPage,
  page,
}) => {
  await mockSaveProject(page);

  await projectListPage.addBtn.click();
  await projectListPage.name.fill("New project");
  await projectListPage.mainBranch.fill("main");

  const [request] = await Promise.all([
    page.waitForRequest(
      (request) =>
        request.url() === `${API_URL}/projects` && request.method() === "POST",
    ),
    projectListPage.modal.confirmBtn.click(),
  ]);

  // everything but the name and the branch starts at the defaults
  expect(request.postDataJSON()).toMatchObject({
    name: "New project",
    mainBranchName: "main",
    maxBuildAllowed: 100,
    maxBranchLifetime: 30,
    autoApproveFeature: true,
    imageComparison: ImageComparison.pixelmatch,
    imageComparisonConfig: PIXELMATCH_DEFAULT_CONFIG,
  });
  await expect(projectListPage.notification.message).toHaveText(
    "New project created",
  );
  await expect(page).toHaveURL("/projects/createdProjectId/settings");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Project settings",
  );
});

test("does not create a project with too short a name", async ({
  projectListPage,
  page,
}) => {
  const creates: string[] = [];
  page.on("request", (request) => {
    if (
      request.url() === `${API_URL}/projects` &&
      request.method() === "POST"
    ) {
      creates.push(request.url());
    }
  });

  await projectListPage.addBtn.click();
  await projectListPage.name.fill("N");
  await projectListPage.mainBranch.fill("main");
  await projectListPage.modal.confirmBtn.click();

  await expect(
    projectListPage.modal.dialog.getByText("Enter at least two characters."),
  ).toBeVisible();
  await expect(projectListPage.modal.dialog).toBeVisible();
  expect(creates).toEqual([]);
});
