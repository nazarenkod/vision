import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import { TEST_PROJECT } from "~client/_test/test.data.helper";
import { inUkrainian, mockGetBuilds, mockGetProjects } from "utils/mocks";

const width = async (page: Page) =>
  (await page.getByTestId("sideNav").boundingBox())?.width;

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT]);
  await mockGetBuilds(page, TEST_PROJECT.id, []);
});

test("shows no top bar after sign-in", async ({ projectListPage, page }) => {
  const { sideNav } = projectListPage;
  await expect(sideNav.nav).toBeVisible();
  await expect(page.locator(".MuiAppBar-root")).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(0);
  expect(await width(page)).toBe(232);

  // the labelled items of an admin, the project's ones waiting for a project
  for (const name of ["Projects", "Users", "Backups"]) {
    await expect(sideNav.item(name)).toBeVisible();
  }
  await expect(sideNav.item("Projects")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(sideNav.projectSwitcher).toContainText("Choose project");
  for (const name of ["Builds", "Baselines", "Insights"]) {
    await expect(sideNav.item(name)).toHaveAttribute("aria-disabled", "true");
  }
  await sideNav.item("Builds").click({ force: true });
  await expect(page).toHaveURL(/\/projects$/);

  // a chosen project opens its builds and wakes its items
  await page.locator("#project-select").click();
  await page.getByRole("option", { name: TEST_PROJECT.name }).click();
  await expect(page).toHaveURL(new RegExp(`/${TEST_PROJECT.id}$`));
  await expect(sideNav.projectSwitcher).toContainText(TEST_PROJECT.name);
  await expect(sideNav.item("Builds")).toHaveAttribute("aria-current", "page");
  await expect(sideNav.item("Baselines")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(sideNav.item("Baselines")).toHaveAttribute(
    "href",
    `/variations/${TEST_PROJECT.id}`,
  );
});

test("says No projects yet when the user has no project", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockGetProjects(page, []);
  await page.goto("/projects");
  const switcher = page.getByTestId("projectSwitcher");
  await expect(switcher).toContainText("No projects yet");
  for (const name of ["Builds", "Baselines", "Insights"]) {
    await expect(
      page.getByTestId("sideNav").getByRole("link", { name, exact: true }),
    ).toHaveAttribute("aria-disabled", "true");
  }
});

test.describe("as a guest", () => {
  test.use({ userRole: "guest" });

  test("shows no Users or Backups", async ({ projectListPage }) => {
    const { sideNav } = projectListPage;
    await expect(sideNav.item("Projects")).toBeVisible();
    await expect(sideNav.item("Users")).toHaveCount(0);
    await expect(sideNav.item("Backups")).toHaveCount(0);
  });
});

test("holds Profile, language, theme and Log out in the account menu", async ({
  projectListPage,
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  const { sideNav } = projectListPage;
  await expect(sideNav.avatarButton).toContainText("fname lname");
  await expect(sideNav.avatarButton).toContainText("EN · System theme");

  await sideNav.openAvatarMenu();
  const menu = sideNav.avatarMenu;
  await expect(menu).toContainText("fname lname");
  await expect(menu).toContainText("admin@vision.local");
  await expect(sideNav.avatarMenuItem("Profile")).toBeVisible();
  await expect(menu.getByTestId("languageSwitch")).toBeVisible();
  const theme = menu.getByRole("group", { name: "Theme" });
  for (const name of ["System", "Light", "Dark"]) {
    await expect(theme.getByRole("button", { name })).toBeVisible();
  }
  await expect(sideNav.avatarMenuItem("Log out")).toBeVisible();

  await theme.getByRole("button", { name: "Dark" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe("dark");
  await expect(sideNav.avatarButton).toContainText("EN · Dark theme");

  await sideNav.avatarMenuItem("Profile").click();
  await expect(page).toHaveURL(/\/profile$/);

  await sideNav.openAvatarMenu();
  await sideNav.avatarMenuItem("Log out").click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(sideNav.nav).toHaveCount(0);
});

test("shows the version next to Help", async ({ projectListPage }) => {
  const { sideNav } = projectListPage;
  await expect(sideNav.helpMenuButton).toContainText("Help & shortcuts");
  // env-config.js is written from env.defaults, as in the image
  await expect(sideNav.version).toHaveText("v1.0.0");
  await expect(sideNav.helpMenuButton.getByTestId("visionVersion")).toHaveCount(
    1,
  );
  const help = await sideNav.helpMenuButton.boundingBox();
  const version = await sideNav.version.boundingBox();
  // one row, the version at its right end
  expect(
    Math.abs(help.y + help.height / 2 - (version.y + version.height / 2)),
  ).toBeLessThan(2);
  expect(version.x).toBeGreaterThan(help.x + help.width / 2);

  // the menu behind it: the tour and the manual checks
  await sideNav.helpMenuButton.click();
  await expect(sideNav.takeTourButton).toBeVisible();
  await expect(
    sideNav.helpMenu.getByRole("menuitem", { name: "Manual checks (CLI)" }),
  ).toBeVisible();
});

test("folds to icons with tooltips below 1100 px", async ({
  projectListPage,
  page,
}) => {
  const { sideNav } = projectListPage;
  expect(await width(page)).toBe(232);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect.poll(() => width(page)).toBe(64);
  await expect(sideNav.nav).toHaveAttribute("data-folded", "true");
  // labels leave, names stay for screen readers
  await expect(sideNav.nav.getByText("Projects", { exact: true })).toHaveCount(
    0,
  );
  await expect(sideNav.version).toHaveCount(0);
  await expect(sideNav.item("Projects")).toBeVisible();

  await sideNav.item("Users").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Users");

  await page.setViewportSize({ width: 1280, height: 768 });
  await expect.poll(() => width(page)).toBe(232);
  await expect(sideNav.nav).toHaveAttribute("data-folded", "false");
});

test("keeps every sidebar label whole in Ukrainian", async ({
  openProjectPage,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await inUkrainian(page);
  await openProjectPage(TEST_PROJECT.id);
  const nav = page.getByTestId("sideNav");
  await expect(nav.getByText("Довідка", { exact: true })).toBeVisible();
  // no label of the open sidebar ends in an ellipsis
  const cut = await nav.evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>("*"))
      .filter((el) => getComputedStyle(el).textOverflow === "ellipsis")
      .filter((el) => el.scrollWidth > el.clientWidth)
      .map((el) => el.textContent),
  );
  expect(cut).toEqual([]);
});
