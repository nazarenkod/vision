import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import {
  TEST_PROJECT,
  TEST_VARIATION_ONE,
} from "~client/_test/test.data.helper";
import type { ScreenSearchResult } from "~client/types";
import {
  API_URL,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestVariationDetails,
  mockImage,
} from "utils/mocks";

const RESULT: ScreenSearchResult = {
  scanned: 1284,
  withoutTree: 46,
  total: 2,
  page: 0,
  rows: [
    {
      name: "Cards.CardDetails.cashbackTab",
      customTags: "",
      screen: "Картка",
      matches: 3,
      where: ["text"],
      items: [
        {
          id: TEST_VARIATION_ONE.id,
          testVariationId: TEST_VARIATION_ONE.id,
          device: "Pixel 7",
          os: "Android 14",
          browser: "",
          viewport: "",
          imageName: "baseline1.png",
          imageThumbnailName: null,
          width: 1080,
          height: 2400,
          boxes: [
            { x: 40, y: 300, width: 1000, height: 200 },
            { x: 40, y: 700, width: 1000, height: 120 },
          ],
          keys: ["id:cashback", "id:cashback_month"],
        },
      ],
    },
    {
      name: "Profile.Settings.notifications",
      customTags: "",
      screen: "Сповіщення",
      matches: 1,
      where: ["label"],
      items: [
        {
          id: "v2",
          testVariationId: "v2",
          device: "Pixel 7",
          os: "Android 14",
          browser: "",
          viewport: "",
          imageName: "baseline2.png",
          imageThumbnailName: null,
          width: 1080,
          height: 2400,
          boxes: [{ x: 900, y: 1800, width: 120, height: 80 }],
          keys: ["id:switch"],
        },
      ],
    },
  ],
};

const mockSearch = async (page: Page, result = RESULT) => {
  const queries: string[] = [];
  await page.route(
    `${API_URL}/projects/${TEST_PROJECT.id}/screen-search?*`,
    (route, request) => {
      queries.push(new URL(request.url()).searchParams.get("q") ?? "");
      return route.fulfill({ body: JSON.stringify(result) });
    },
  );
  return queries;
};

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT]);
  await mockGetBuilds(page, TEST_PROJECT.id, []);
  await mockImage(page, "baseline1.png");
  await mockImage(page, "baseline2.png");
});

test("opens the search from the side menu and with the slash key", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSearch(page);
  await page.goto("/projects");
  await page.locator("#project-select").click();
  await page.getByRole("option", { name: TEST_PROJECT.name }).click();

  await page
    .getByTestId("sideNav")
    .getByRole("link", { name: "Search" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/search/${TEST_PROJECT.id}$`));
  await expect(page.getByTestId("searchInput")).toBeFocused();

  await page.goBack();
  await page.locator("body").press("/");
  await expect(page).toHaveURL(new RegExp(`/search/${TEST_PROJECT.id}$`));
});

test("finds screens and outlines the found elements", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  const queries = await mockSearch(page);
  await page.goto(`/search/${TEST_PROJECT.id}`);

  await page.getByTestId("searchInput").fill("кешбек");

  await expect(page.getByTestId("searchSummary")).toContainText("2 checks");
  await expect(page.getByTestId("searchSummary")).toContainText(
    "46 without a UI tree",
  );
  await expect(page.getByTestId("searchRow")).toHaveCount(2);
  await expect(page.getByTestId("searchRow").first()).toContainText(
    "Картка · 3 matches",
  );
  await expect(page.getByTestId("searchRow").nth(1)).toContainText("label");
  await expect(
    page.getByTestId("searchRow").first().getByTestId("searchBox"),
  ).toHaveCount(2);
  // one request after typing stops, not one per key
  expect(queries).toEqual(["кешбек"]);
});

test("keeps the query in the address", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  const queries = await mockSearch(page);
  await page.goto(`/search/${TEST_PROJECT.id}?q=id%3Abtn_pay`);

  await expect(page.getByTestId("searchInput")).toHaveValue("id:btn_pay");
  await expect(page.getByTestId("searchRow")).toHaveCount(2);
  expect(queries).toEqual(["id:btn_pay"]);

  await page.getByTestId("searchInput").fill("кешбек");
  await expect(page).toHaveURL(/q=%D0%BA%D0%B5%D1%88%D0%B1%D0%B5%D0%BA/);
});

test("explains a selector it cannot read", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSearch(page, { ...RESULT, problem: "pattern", rows: [], total: 0 });
  await page.goto(`/search/${TEST_PROJECT.id}?q=text%3A%2F(a)%5C1%2F`);

  await expect(page.getByText("This pattern cannot run")).toBeVisible();
  await expect(page.getByTestId("searchRow")).toHaveCount(0);
});

test("opens the baseline with the found elements outlined", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockSearch(page);
  await mockGetTestVariationDetails(page, TEST_VARIATION_ONE);
  await page.goto(`/search/${TEST_PROJECT.id}?q=%D0%BA%D0%B5%D1%88`);

  await page.getByTestId("searchThumbnail").first().click();

  await expect(page).toHaveURL(
    new RegExp(`/variations/details/${TEST_VARIATION_ONE.id}\\?highlight=`),
  );
  await expect(page.getByTestId("foundElement")).toHaveCount(2);
});

test("outlines nothing on a baseline approved after the search", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockGetTestVariationDetails(page, TEST_VARIATION_ONE);
  await page.goto(
    `/variations/details/${TEST_VARIATION_ONE.id}?highlight=40,300,1000,200&on=older.png`,
  );

  await expect(page.getByTestId("historyPicked")).toBeVisible();
  await expect(page.getByTestId("foundElement")).toHaveCount(0);
});
