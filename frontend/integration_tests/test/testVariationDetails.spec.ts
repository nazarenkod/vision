import { expect } from "@playwright/test";
import { test } from "fixtures";
import {
  API_URL,
  mockApiError,
  mockGetProjects,
  mockGetTestVariationDetails,
  mockImage,
  inUkrainian,
} from "utils/mocks";
import {
  TEST_PROJECT,
  TEST_VARIATION_ONE,
} from "~client/_test/test.data.helper";

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT]);
  await mockGetTestVariationDetails(page, TEST_VARIATION_ONE);
  await mockImage(page, "baseline1.png");
  await mockImage(page, "baseline2.png");
});

test("renders", async ({ openTestVariationDetailsPage, page }) => {
  await openTestVariationDetailsPage(TEST_VARIATION_ONE.id);

  await expect(page).toHaveScreenshot("test-variation-details-page.png", {
    fullPage: true,
  });
});

test("renders in Ukrainian", async ({ openTestVariationDetailsPage, page }) => {
  await inUkrainian(page);
  await openTestVariationDetailsPage(TEST_VARIATION_ONE.id);

  await expect(page).toHaveScreenshot("test-variation-details-page-uk.png", {
    fullPage: true,
  });
});

test("lists every baseline with who made it", async ({
  openTestVariationDetailsPage,
}) => {
  const detailsPage = await openTestVariationDetailsPage(TEST_VARIATION_ONE.id);

  await expect(detailsPage.testRunBtns).toHaveCount(
    TEST_VARIATION_ONE.baselines.length,
  );
  const { user } = TEST_VARIATION_ONE.baselines[0];
  await expect(
    detailsPage.page.getByText(
      `${user?.firstName} ${user?.lastName} <${user?.email}>`,
    ),
  ).toHaveCount(TEST_VARIATION_ONE.baselines.length);
});

test("opens the test run a baseline came from", async ({
  openTestVariationDetailsPage,
  page,
}) => {
  const detailsPage = await openTestVariationDetailsPage(TEST_VARIATION_ONE.id);
  const { testRun } = TEST_VARIATION_ONE.baselines[0];

  await detailsPage.testRunBtns.first().click();

  await expect(page).toHaveURL(
    (url) =>
      url.pathname === `/${TEST_VARIATION_ONE.projectId}` &&
      url.searchParams.get("buildId") === testRun?.buildId &&
      url.searchParams.get("testId") === testRun?.id,
  );
});

test("shows why the variation did not load", async ({
  openTestVariationDetailsPage,
  page,
}) => {
  await mockApiError(
    page,
    `${API_URL}/test-variations/details/${TEST_VARIATION_ONE.id}`,
    500,
    "Could not load the variation",
  );

  const detailsPage = await openTestVariationDetailsPage(TEST_VARIATION_ONE.id);

  await expect(detailsPage.notification.message).toHaveText(
    "Could not load the variation",
  );
  await expect(detailsPage.testRunBtns).toHaveCount(0);
});

test("shows the picked baseline next to the one before", async ({
  openTestVariationDetailsPage,
  page,
}) => {
  await openTestVariationDetailsPage(TEST_VARIATION_ONE.id);
  const [newest, older] = TEST_VARIATION_ONE.baselines;
  const entries = page.getByTestId("historyEntry");
  await expect(entries).toHaveCount(TEST_VARIATION_ONE.baselines.length);
  await expect(entries.first()).toHaveAttribute("data-picked", "true");

  // the newest is shown next to the one it replaced
  await expect(page.getByTestId("historyPicked")).toHaveAttribute(
    "src",
    new RegExp(newest.baselineName),
  );
  await expect(page.getByTestId("historyBefore")).toHaveAttribute(
    "src",
    new RegExp(older.baselineName),
  );

  // the oldest has nothing before it
  await entries.last().locator("button[aria-pressed]").click();
  await expect(entries.last()).toHaveAttribute("data-picked", "true");
  await expect(page.getByTestId("historyBefore")).toHaveCount(0);
  await expect(page.getByText("Nothing before it")).toBeVisible();
});

test("labels the pair Selected and Previous", async ({
  openTestVariationDetailsPage,
  page,
}) => {
  await openTestVariationDetailsPage(TEST_VARIATION_ONE.id);

  await expect(page.getByText("Selected", { exact: true })).toBeVisible();
  await expect(page.getByText("Previous", { exact: true })).toBeVisible();
  await expect(page.getByText("Current", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Before it", { exact: true })).toHaveCount(0);

  // an older record picked is still the selected one
  await page
    .getByTestId("historyEntry")
    .nth(1)
    .locator("button[aria-pressed]")
    .click();
  await expect(page.getByText("Selected", { exact: true })).toBeVisible();
  await expect(page.getByText("This one", { exact: true })).toHaveCount(0);
});

test("shows the date of a record in one line", async ({
  openTestVariationDetailsPage,
  page,
}) => {
  await openTestVariationDetailsPage(TEST_VARIATION_ONE.id);
  const dates = page.getByTestId("historyDate");
  await expect(dates).toHaveCount(TEST_VARIATION_ONE.baselines.length);

  // "Oct 12, 2026 · 16:05": the date and the time, one line, for every record
  for (const date of await dates.all()) {
    await expect(date).toHaveText(
      /^[A-Z][a-z]{2} \d{1,2}, \d{4} · \d{2}:\d{2}$/,
    );
    const box = (await date.boundingBox())!;
    const lineHeight = await date.evaluate((node) =>
      parseFloat(getComputedStyle(node).lineHeight),
    );
    expect(box.height).toBeLessThan(lineHeight * 1.5);
  }
  // the same in the header of the pair
  await expect(page.getByTestId("historyPickedDate")).toHaveText(
    await dates.first().innerText(),
  );
  // the newest is the one in use, and opens in review
  await expect(page.getByTestId("historyEntry").first()).toContainText(
    "in use",
  );
  await expect(
    page.getByRole("button", { name: "Open in review" }).first(),
  ).toBeVisible();
});
