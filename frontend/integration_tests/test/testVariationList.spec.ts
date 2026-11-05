import { expect } from "@playwright/test";
import { test } from "fixtures";
import {
  mockDeleteTestVariation,
  mockGetBuildDetails,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestRuns,
  mockGetTestVariations,
  mockImage,
  mockMergeTestVariations,
  inUkrainian,
} from "utils/mocks";
import {
  TEST_BUILD_PASSED,
  TEST_PROJECT,
  TEST_VARIATION_ONE,
  TEST_VARIATION_TWO,
} from "~client/_test/test.data.helper";

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT]);
  await mockGetTestVariations(page, TEST_PROJECT.id, [
    TEST_VARIATION_ONE,
    TEST_VARIATION_TWO,
  ]);
  await mockImage(page, "baseline1.png");
  await mockImage(page, "baseline2.png");
});

test("renders", async ({ openTestVariationListPage, page }) => {
  await openTestVariationListPage(TEST_PROJECT.id);

  await expect(page).toHaveScreenshot("test-variation-list-page.png");
});

test("renders in Ukrainian", async ({ openTestVariationListPage, page }) => {
  await inUkrainian(page);
  await openTestVariationListPage(TEST_PROJECT.id);

  await expect(page).toHaveScreenshot("test-variation-list-page-uk.png");
});

test("deletes a variation", async ({ openTestVariationListPage, page }) => {
  await mockDeleteTestVariation(page, TEST_VARIATION_TWO);
  const listPage = await openTestVariationListPage(TEST_PROJECT.id);

  await listPage.deleteBtn(TEST_VARIATION_TWO.name).click();
  await expect(listPage.modal.dialog).toContainText(
    `Are you sure you want to delete: ${TEST_VARIATION_TWO.name}?`,
  );
  await Promise.all([
    page.waitForRequest(
      (request) =>
        request.method() === "DELETE" &&
        decodeURIComponent(new URL(request.url()).pathname) ===
          `/test-variations/${TEST_VARIATION_TWO.id}`,
    ),
    listPage.modal.confirmBtn.click(),
  ]);

  await expect(listPage.notification.message).toHaveText(
    `${TEST_VARIATION_TWO.name} deleted`,
  );
  await expect(listPage.getCard(TEST_VARIATION_TWO.name)).toHaveCount(0);
  await expect(listPage.getCard(TEST_VARIATION_ONE.name)).toBeVisible();
});

test("keeps a variation when the delete is cancelled", async ({
  openTestVariationListPage,
}) => {
  const listPage = await openTestVariationListPage(TEST_PROJECT.id);

  await listPage.deleteBtn(TEST_VARIATION_TWO.name).click();
  await listPage.modal.cancelBtn.click();

  await expect(listPage.modal.dialog).toBeHidden();
  await expect(listPage.getCard(TEST_VARIATION_TWO.name)).toBeVisible();
});

test("merges one branch into another", async ({
  openTestVariationListPage,
  page,
}) => {
  const build = { ...TEST_BUILD_PASSED, id: "mergeBuildId" };
  await mockMergeTestVariations(page, build);
  // where the merge leads: the project page on the build it started
  await mockGetBuilds(page, TEST_PROJECT.id, [build]);
  await mockGetBuildDetails(page, build);
  await mockGetTestRuns(page, build.id, []);
  const listPage = await openTestVariationListPage(TEST_PROJECT.id);

  const [request] = await Promise.all([
    page.waitForRequest("**/test-variations/merge?**"),
    listPage.merge(TEST_VARIATION_ONE.branchName, "master"),
  ]);

  expect(Object.fromEntries(new URL(request.url()).searchParams)).toEqual({
    projectId: TEST_PROJECT.id,
    fromBranch: TEST_VARIATION_ONE.branchName,
    toBranch: "master",
  });
  await expect(
    listPage.notification.message.filter({
      hasText: `Merge started in build: ${build.id}`,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(`/${TEST_PROJECT.id}?buildId=${build.id}`);
});

test("does not merge without a branch to merge from", async ({
  openTestVariationListPage,
  page,
}) => {
  const merges: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/test-variations/merge")) {
      merges.push(request.url());
    }
  });
  const listPage = await openTestVariationListPage(TEST_PROJECT.id);
  await listPage.mergeToggle.click();

  await listPage.toBranch.fill("master");
  await listPage.mergeBtn.click();

  await expect(page).toHaveURL(`/variations/${TEST_PROJECT.id}`);
  expect(merges).toEqual([]);
});

test("filters with chips and hides merge behind a button", async ({
  openTestVariationListPage,
  page,
}) => {
  const other = {
    ...TEST_VARIATION_TWO,
    id: "other-device",
    name: "other device screen",
    device: "PIXEL_4_XL",
  };
  await mockGetTestVariations(page, TEST_PROJECT.id, [
    TEST_VARIATION_ONE,
    TEST_VARIATION_TWO,
    other,
  ]);
  const listPage = await openTestVariationListPage(TEST_PROJECT.id);

  // merging is out of the way until asked for
  await expect(listPage.toBranch).toBeHidden();
  await listPage.mergeToggle.click();
  await expect(listPage.toBranch).toBeVisible();

  await expect(listPage.cards).toHaveCount(3);
  await page.getByTestId("filtersButton").click();
  await page.getByLabel("Device", { exact: true }).click();
  await page.getByRole("option", { name: "PIXEL_4_XL" }).click();
  await expect(listPage.cards).toHaveCount(1);
  await expect(listPage.getCard(other.name)).toBeVisible();
});

test("filters with one Filters button and removable chips", async ({
  openTestVariationListPage,
  page,
}) => {
  const android = {
    ...TEST_VARIATION_TWO,
    id: "android-14",
    name: "android screen",
    os: "Android 14",
  };
  await mockGetTestVariations(page, TEST_PROJECT.id, [
    TEST_VARIATION_ONE,
    TEST_VARIATION_TWO,
    android,
  ]);
  const listPage = await openTestVariationListPage(TEST_PROJECT.id);
  const filtersButton = page.getByTestId("filtersButton");
  const chips = page.getByTestId("filterChip");

  // a search and one button; the filter fields wait in its popover
  await expect(page.getByTestId("filterSearch")).toHaveAttribute(
    "placeholder",
    "Search checks",
  );
  await expect(filtersButton).toHaveText("Filters");
  await expect(page.getByLabel("OS", { exact: true })).toHaveCount(0);
  await expect(chips).toHaveCount(0);
  // a baseline is a check: name and tags, its devices inside
  await expect(page.getByTestId("baselinesCount")).toHaveText("3 checks");

  await filtersButton.click();
  await page.getByLabel("OS", { exact: true }).click();
  await page.getByRole("option", { name: "Android 14" }).click();
  await page.getByLabel("Branch", { exact: true }).click();
  await page
    .getByRole("option", { name: TEST_VARIATION_TWO.branchName })
    .click();
  await page.keyboard.press("Escape");

  await expect(filtersButton).toHaveText("Filters2");
  await expect(chips).toHaveText([
    "OS: Android 14",
    `Branch: ${TEST_VARIATION_TWO.branchName}`,
  ]);
  await expect(listPage.cards).toHaveCount(1);

  // a chip's cross drops that filter only
  await page.getByRole("button", { name: "Remove filter OS" }).click();
  await expect(chips).toHaveText([`Branch: ${TEST_VARIATION_TWO.branchName}`]);
  await expect(filtersButton).toHaveText("Filters1");
  await expect(listPage.cards).toHaveCount(3);

  // Clear drops the rest
  await page.getByTestId("clearFilters").click();
  await expect(chips).toHaveCount(0);
  await expect(filtersButton).toHaveText("Filters");
  await expect(page.getByTestId("clearFilters")).toHaveCount(0);
});
