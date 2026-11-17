import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import { TEST_PROJECT } from "~client/_test/test.data.helper";
import {
  inUkrainian,
  mockGetBuilds,
  mockGetProjects,
  mockGetTestVariations,
} from "utils/mocks";

const width = async (page: Page) =>
  (await page.getByTestId("sideNav").boundingBox())?.width;

const AOS = { ...TEST_PROJECT, id: "aos", name: "AOS" };
const SHOP = { ...TEST_PROJECT, id: "shop", name: "Mobile Shop Android" };

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT, AOS, SHOP]);
  for (const project of [TEST_PROJECT, AOS, SHOP]) {
    await mockGetBuilds(page, project.id, []);
    await mockGetTestVariations(page, project.id, []);
  }
});

test("shows no top bar after sign-in", async ({ projectListPage, page }) => {
  await expect(projectListPage.sideNav.nav).toBeVisible();
  await expect(page.locator(".MuiAppBar-root")).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(0);
});

test("shows the logo, a tile per project, the plus tile and the account in the rail", async ({
  projectListPage,
}) => {
  const { sideNav } = projectListPage;
  await expect(sideNav.logo).toBeVisible();
  // the tiles read short, the full name stays the tile's name
  await expect(sideNav.projectTile(TEST_PROJECT.name)).toHaveText("PN");
  await expect(sideNav.projectTile("AOS")).toHaveText("AOS");
  await expect(sideNav.projectTile(SHOP.name)).toHaveText("MSA");
  await expect(sideNav.newProjectTile).toBeVisible();
  await expect(sideNav.avatarButton).toBeVisible();
  expect(await width(projectListPage.page)).toBe(264);

  await sideNav.projectTile(SHOP.name).hover();
  await expect(projectListPage.page.getByRole("tooltip")).toHaveText(SHOP.name);
});

test("opens Projects from the logo", async ({ openProjectPage, page }) => {
  const projectPage = await openProjectPage(TEST_PROJECT.id);
  await projectPage.sideNav.logo.click();
  await expect(page).toHaveURL(/\/projects$/);
});

test("marks the chosen project tile as current", async ({
  openProjectPage,
}) => {
  const { sideNav } = await openProjectPage(TEST_PROJECT.id);
  await expect(sideNav.projectTile(TEST_PROJECT.name)).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(sideNav.projectTile("AOS")).not.toHaveAttribute("aria-current");
});

test("keeps the section when a tile switches the project", async ({
  openTestVariationListPage,
  page,
}) => {
  const listPage = await openTestVariationListPage(TEST_PROJECT.id);
  await listPage.sideNav.projectTile("AOS").click();
  await expect(page).toHaveURL(`/variations/${AOS.id}`);
  await expect(listPage.sideNav.projectHeading).toContainText("AOS");
  await expect(listPage.sideNav.item("Baselines")).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("lists the project's sections under its name and says Choose project before", async ({
  projectListPage,
  page,
}) => {
  const { sideNav } = projectListPage;
  await expect(sideNav.projectHeading).toContainText("Choose project");
  for (const name of ["Builds", "Baselines", "Insights"]) {
    await expect(sideNav.item(name)).toHaveAttribute("aria-disabled", "true");
  }
  await sideNav.projectTile(TEST_PROJECT.name).click();
  await expect(page).toHaveURL(new RegExp(`/${TEST_PROJECT.id}$`));
  await expect(sideNav.projectHeading).toContainText(TEST_PROJECT.name);
  await expect(sideNav.item("Builds")).toHaveAttribute("aria-current", "page");
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
  await expect(page.getByTestId("projectHeading")).toContainText(
    "No projects yet",
  );
  // an admin may still create one
  await expect(page.getByTestId("projectTileNew")).toBeVisible();
});

test("has no Projects, Search or Help item and no version", async ({
  openProjectPage,
}) => {
  const { sideNav } = await openProjectPage(TEST_PROJECT.id);
  for (const name of ["Projects", "Search", "Help & shortcuts"]) {
    await expect(sideNav.item(name)).toHaveCount(0);
    await expect(sideNav.nav.getByRole("button", { name })).toHaveCount(0);
  }
  await expect(sideNav.nav.getByText("v1.0.0")).toHaveCount(0);
  await expect(sideNav.nav).not.toContainText("System theme");
});

test("puts Users and Backups under Administration for an admin", async ({
  projectListPage,
}) => {
  const { sideNav } = projectListPage;
  const admin = sideNav.nav.getByRole("group", { name: "Administration" });
  await expect(admin.getByRole("link", { name: "Users" })).toBeVisible();
  await expect(admin.getByRole("link", { name: "Backups" })).toBeVisible();
});

test.describe("as a guest", () => {
  test.use({ userRole: "guest" });

  test("shows no Administration and no plus tile", async ({
    projectListPage,
  }) => {
    const { sideNav } = projectListPage;
    await expect(sideNav.projectTile(TEST_PROJECT.name)).toBeVisible();
    await expect(sideNav.nav).not.toContainText("Administration");
    await expect(sideNav.item("Users")).toHaveCount(0);
    await expect(sideNav.newProjectTile).toHaveCount(0);
  });
});

test("opens New project from the plus tile for an editor only", async ({
  projectListPage,
  page,
}) => {
  await projectListPage.sideNav.newProjectTile.click();
  await expect(page.getByRole("dialog")).toContainText("New project");
});

test("scrolls only the tiles and keeps the chosen one in view", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  const many = Array.from({ length: 25 }, (_, index) => ({
    ...TEST_PROJECT,
    id: `p${index}`,
    name: `Project ${index}`,
  }));
  await mockGetProjects(page, many);
  await mockGetBuilds(page, "p24", []);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/p24");

  const rail = page.getByTestId("projectRail");
  const last = rail.getByRole("link", { name: "Project 24", exact: true });
  await expect(last).toHaveAttribute("aria-current", "true");
  await expect(last).toBeInViewport();
  // the logo and the account stay put
  await expect(page.getByTestId("railLogo")).toBeInViewport();
  await expect(page.getByTestId("avatarMenuButton")).toBeInViewport();
  expect(
    await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0),
  ).toBe(0);
});

test("holds all projects and manual checks, but no tour or version, in the account menu", async ({
  openProjectPage,
  page,
}) => {
  const { sideNav } = await openProjectPage(TEST_PROJECT.id);
  await sideNav.openAvatarMenu();
  const menu = sideNav.avatarMenu;
  await expect(menu).toContainText("fname lname");
  await expect(menu).toContainText("admin@vision.local");
  for (const name of [
    "All projects",
    "Profile",
    "Manual checks (CLI)",
    "Log out",
  ]) {
    await expect(sideNav.avatarMenuItem(name)).toBeVisible();
  }
  await expect(menu.getByTestId("languageSwitch")).toBeVisible();
  await expect(menu.getByRole("group", { name: "Theme" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Take a tour" })).toHaveCount(
    0,
  );
  await expect(menu).not.toContainText("Vision 1.0.0");

  await sideNav.avatarMenuItem("All projects").click();
  await expect(page).toHaveURL(/\/projects$/);

  await sideNav.openAvatarMenu();
  await sideNav.avatarMenuItem("Log out").click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(sideNav.nav).toHaveCount(0);
});

test("keeps only the rail with section icons below 1100 px", async ({
  openProjectPage,
  page,
}) => {
  const { sideNav } = await openProjectPage(TEST_PROJECT.id);
  expect(await width(page)).toBe(264);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect.poll(() => width(page)).toBe(64);
  await expect(sideNav.nav).toHaveAttribute("data-folded", "true");
  await expect(sideNav.projectHeading).toHaveCount(0);
  // the sections and administration come into the rail as icons with names
  for (const name of ["Builds", "Baselines", "Insights", "Users", "Backups"]) {
    await expect(sideNav.rail.getByRole("link", { name })).toBeVisible();
  }
  await expect(sideNav.nav.getByText("Baselines", { exact: true })).toHaveCount(
    0,
  );
  await sideNav.item("Users").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Users");

  await page.setViewportSize({ width: 1280, height: 768 });
  await expect.poll(() => width(page)).toBe(264);
  await expect(sideNav.nav).toHaveAttribute("data-folded", "false");
});

test("marks the open section without glow or green text", async ({
  openProjectPage,
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const { sideNav } = await openProjectPage(TEST_PROJECT.id);
  const builds = sideNav.item("Builds");
  await expect(builds).toHaveAttribute("aria-current", "page");
  const look = await builds.evaluate((element) => {
    const probe = (name: string) => {
      const span = document.createElement("span");
      span.style.color = `var(${name})`;
      document.body.append(span);
      const value = getComputedStyle(span).color;
      span.remove();
      return value;
    };
    const icon = element.querySelector("svg") as SVGElement;
    const indicator = document.querySelector(
      "[data-testid=navIndicator]",
    ) as HTMLElement;
    return {
      text: getComputedStyle(element).color,
      icon: getComputedStyle(icon).color,
      shadow: getComputedStyle(indicator).boxShadow,
      expectedText: probe("--v-text"),
      expectedIcon: probe("--v-brand"),
    };
  });
  expect(look.text).toBe(look.expectedText);
  expect(look.icon).toBe(look.expectedIcon);
  expect(look.shadow).toBe("none");
});

test("does not open a search on the slash key", async ({
  openProjectPage,
  page,
}) => {
  await openProjectPage(TEST_PROJECT.id);
  await page.locator("body").press("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /search/i })).toHaveCount(0);
});

test("sends an old search link to the project's builds", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await page.goto(`/search/${TEST_PROJECT.id}?q=Login`);
  await expect(page).toHaveURL(new RegExp(`/${TEST_PROJECT.id}$`));
  await expect(page.getByTestId("nav-builds")).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("keeps every sidebar label whole in Ukrainian", async ({
  openProjectPage,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await inUkrainian(page);
  await openProjectPage(TEST_PROJECT.id);
  const nav = page.getByTestId("sideNav");
  await expect(nav.getByText("Резервні копії", { exact: true })).toBeVisible();
  await expect(nav.getByText("Адміністрування", { exact: true })).toBeVisible();
  // no label of the open sidebar ends in an ellipsis
  const cut = await nav.evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>("*"))
      .filter((el) => getComputedStyle(el).textOverflow === "ellipsis")
      .filter((el) => el.scrollWidth > el.clientWidth)
      .map((el) => el.textContent),
  );
  expect(cut).toEqual([]);
});
