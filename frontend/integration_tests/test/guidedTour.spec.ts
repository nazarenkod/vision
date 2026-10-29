import { expect } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_BUILD_PASSED,
  TEST_BUILD_UNRESOLVED,
  TEST_PROJECT,
  TEST_RUN_APPROVED,
  TEST_RUN_NEW,
  TEST_RUN_OK,
  TEST_UNRESOLVED,
  TEST_VARIATION_ONE,
  TEST_VARIATION_TWO,
} from "~client/_test/test.data.helper";
import {
  LOGIN_PAGE_STEPS,
  PROJECT_LIST_PAGE_STEPS,
  PROJECT_PAGE_STEPS,
  TEST_VARIATION_LIST_PAGE,
} from "~client/constants/help";
// the steps hold dictionary keys; the tour shows their English
import { english } from "~client/i18n/dictionaries";
import type { MessageKey } from "~client/i18n";
import {
  mockGetBuildDetails,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestRuns,
  mockGetTestVariations,
  mockImage,
  mockTestRun,
} from "utils/mocks";

const project = TEST_PROJECT;

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [
    TEST_BUILD_FAILED,
    TEST_BUILD_PASSED,
    TEST_BUILD_UNRESOLVED,
  ]);
  await mockGetBuildDetails(page, TEST_BUILD_FAILED);
  await mockGetTestRuns(page, TEST_BUILD_FAILED.id, [
    TEST_UNRESOLVED,
    TEST_RUN_APPROVED,
    TEST_RUN_NEW,
    TEST_RUN_OK,
  ]);
  await mockTestRun(page, TEST_UNRESOLVED);
  await mockGetTestVariations(page, project.id, [
    TEST_VARIATION_ONE,
    TEST_VARIATION_TWO,
  ]);
  await mockImage(page, "baseline.png");
  await mockImage(page, "diff.png");
  await mockImage(page, "image.png");
  await mockImage(page, "baseline1.png");
  await mockImage(page, "baseline2.png");
});

test.describe("Guided Tour", () => {
  test("should allow skipping the tour", async ({ loginPage }) => {
    const tour = await loginPage.header.startTour();
    await expect(tour.joyrideOverlay).toBeVisible();

    await tour.skipTour();

    await expect(tour.joyrideOverlay).not.toBeVisible();
  });

  test.describe("Login Page", () => {
    test("should display all tour steps", async ({ loginPage }) => {
      const tour = await loginPage.header.startTour();

      await expect(tour.joyrideOverlay).toContainText(english(LOGIN_PAGE_STEPS[0].content as MessageKey));
      await tour.clickNext();

      await expect(tour.joyrideOverlay).toContainText(english(LOGIN_PAGE_STEPS[1].content as MessageKey));
      await tour.clickLast();

      await expect(tour.joyrideOverlay).not.toBeVisible();
    });
  });

  test.describe("Project List Page", () => {
    test("should display all tour steps", async ({ projectListPage }) => {
      const tour = await projectListPage.header.startTour();

      await expect(tour.joyrideOverlay).toContainText(english(PROJECT_LIST_PAGE_STEPS[0].title as MessageKey));
      await tour.clickLast();

      await expect(tour.joyrideOverlay).not.toBeVisible();
    });
  });

  test.describe("Project Page", () => {
    test("should display all tour steps", async ({ openProjectPage }) => {
      const projectPage = await openProjectPage(project.id);
      await projectPage.buildList.getBuildLocator(TEST_BUILD_FAILED.number).click();

      const tour = await projectPage.header.startTour();

      await expect(tour.joyrideOverlay).toContainText(english(PROJECT_PAGE_STEPS[0].content as MessageKey));
      await tour.clickNext();

      await expect(tour.joyrideOverlay).toContainText(english(PROJECT_PAGE_STEPS[1].content as MessageKey));
      await tour.clickNext();

      await expect(tour.joyrideOverlay).toContainText(english(PROJECT_PAGE_STEPS[2].content as MessageKey));
      await tour.clickNext();

      await expect(tour.joyrideOverlay).toContainText(english(PROJECT_PAGE_STEPS[3].content as MessageKey));
      await tour.clickNext();

      await expect(tour.joyrideOverlay).toContainText(english(PROJECT_PAGE_STEPS[4].content as MessageKey));
      await tour.clickLast();

      await expect(tour.joyrideOverlay).not.toBeVisible();
    });
  });

  test.describe("Test Variation List Page", () => {
    test("should display all tour steps", async ({ openTestVariationListPage }) => {
      const variationListPage = await openTestVariationListPage(project.id);
      const tour = await variationListPage.header.startTour();

      await expect(tour.joyrideOverlay).toContainText(english(TEST_VARIATION_LIST_PAGE[0].title as MessageKey));
      await tour.clickNext();

      await expect(tour.joyrideOverlay).toContainText(english(TEST_VARIATION_LIST_PAGE[1].content as MessageKey));
      await tour.clickNext();

      await expect(tour.joyrideOverlay).toContainText(english(TEST_VARIATION_LIST_PAGE[2].content as MessageKey));
      await tour.clickLast();

      await expect(tour.joyrideOverlay).not.toBeVisible();
    });
  });
});
