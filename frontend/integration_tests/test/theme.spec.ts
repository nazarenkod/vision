import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
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
  mockTestRun,
} from "utils/mocks";

const shownTheme = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.theme);
const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT]);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test("opens in the theme of the system", async ({ page, authUser }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/projects");
  await expect.poll(() => shownTheme(page)).toBe("dark");
  expect(await background(page)).toBe("rgb(15, 18, 17)");

  await page.emulateMedia({ colorScheme: "light" });
  // nobody chose a theme, so it follows the system without a reload
  await expect.poll(() => shownTheme(page)).toBe("light");
  expect(await background(page)).toBe("rgb(245, 247, 246)");
});

test("switches theme with the header button and with Shift+D, and remembers it", async ({
  projectListPage,
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await expect(
    projectListPage.page.getByText("Projects").first(),
  ).toBeVisible();
  await expect.poll(() => shownTheme(page)).toBe("light");

  await page.getByTestId("themeToggle").click();
  await expect.poll(() => shownTheme(page)).toBe("dark");
  await expect(page.getByTestId("themeToggle")).toHaveAccessibleName(
    "Light theme",
  );

  await page.reload();
  await expect.poll(() => shownTheme(page)).toBe("dark");

  await page.keyboard.press("Shift+D");
  await expect.poll(() => shownTheme(page)).toBe("light");

  // typing a capital D in a field is just typing
  const search = page.getByPlaceholder("Project name");
  await search.click();
  await page.keyboard.press("Shift+D");
  await expect(search).toHaveValue("D");
  expect(await shownTheme(page)).toBe("light");
});

test("the account menu switches theme too", async ({
  projectListPage,
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await projectListPage.header.openAvatarMenu();
  await page.getByTestId("themeMenuItem").click();
  await expect.poll(() => shownTheme(page)).toBe("dark");
});

test("screenshots keep their pixels in the dark theme", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockGetBuilds(page, TEST_PROJECT.id, [TEST_BUILD_FAILED]);
  await mockGetBuildDetails(page, TEST_BUILD_FAILED);
  await mockGetTestRuns(page, TEST_BUILD_FAILED.id, [TEST_UNRESOLVED]);
  await mockTestRun(page, TEST_UNRESOLVED);
  for (const image of ["image.png", "diff.png", "baseline.png"]) {
    await mockImage(page, image);
  }
  const pixels = async (theme: "light" | "dark") => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(
      `/${TEST_PROJECT.id}?buildId=${TEST_BUILD_FAILED.id}&testId=${TEST_UNRESOLVED.id}`,
    );
    await expect.poll(() => shownTheme(page)).toBe(theme);
    await expect(page.locator(".konvajs-content canvas").first()).toBeVisible();
    await page.waitForTimeout(800);
    // as screenshots: the images come from the API's origin, so the canvas
    // itself cannot be read
    // the canvas is transparent around the image; one fixed colour behind it
    // in both themes, so only the canvas' own pixels can differ
    await page.addStyleTag({
      content: ".konvajs-content { background: #808080 !important; }",
    });
    const canvases = page.locator(".konvajs-content canvas");
    const result = [];
    for (let i = 0; i < (await canvases.count()); i++) {
      const canvas = canvases.nth(i);
      // whole pixels inside the canvas: its width is fractional, and the edge
      // column would carry the page around it
      const box = await canvas.boundingBox();
      if (!box) continue;
      const x = Math.ceil(box.x);
      const y = Math.ceil(box.y);
      const clip = {
        x,
        y,
        width: Math.floor(box.x + box.width) - x,
        height: Math.floor(box.y + box.height) - y,
      };
      result.push({
        pixels: (
          await page.screenshot({ clip, animations: "disabled" })
        ).toString("base64"),
        ...(await canvas.evaluate((el) => ({
          filter: getComputedStyle(el).filter,
          blend: getComputedStyle(el).mixBlendMode,
        }))),
      });
    }
    return result;
  };

  const light = await pixels("light");
  const dark = await pixels("dark");
  expect(light.length).toBeGreaterThan(0);
  expect(dark).toEqual(light);
  for (const canvas of dark) {
    expect(canvas.filter).toBe("none");
    expect(canvas.blend).toBe("normal");
  }
});

test("Appearance System forgets the choice and follows the system again", async ({
  profilePage,
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await expect(profilePage.page.getByTestId("appearanceCard")).toBeVisible();
  const appearance = page.getByRole("group", { name: "Appearance" });

  await appearance.getByRole("button", { name: "Dark" }).click();
  await expect.poll(() => shownTheme(page)).toBe("dark");
  expect(await page.evaluate(() => localStorage.getItem("vision.theme"))).toBe(
    "dark",
  );

  await appearance.getByRole("button", { name: "System" }).click();
  await expect.poll(() => shownTheme(page)).toBe("light");
  expect(
    await page.evaluate(() => localStorage.getItem("vision.theme")),
  ).toBeNull();
  // and it follows the system from then on
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => shownTheme(page)).toBe("dark");
});
