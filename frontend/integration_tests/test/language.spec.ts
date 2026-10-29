import { expect } from "@playwright/test";
import { test } from "fixtures";
import { TEST_PROJECT } from "~client/_test/test.data.helper";
import { inUkrainian, mockGetProjects } from "utils/mocks";

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT]);
});

test("offers the language switch on the login page", async ({ loginPage }) => {
  const switcher = loginPage.page.getByTestId("languageSwitch");
  await expect(switcher.getByRole("button", { name: "English" })).toBeVisible();
  await expect(
    switcher.getByRole("button", { name: "Українська" }),
  ).toBeVisible();
});

test("switches the header and the page to Ukrainian and keeps it after a reload", async ({
  projectListPage,
  page,
}) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Projects");

  await page.getByRole("button", { name: "Українська" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Проєкти");
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(page.getByRole("button", { name: "Довідка" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Головне меню" }),
  ).toBeVisible();
  // data is shown as it is
  await expect(projectListPage.project(TEST_PROJECT.name)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Проєкти");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Projects");
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test("shows the project settings in Ukrainian", async ({ page, authUser }) => {
  await inUkrainian(page);
  await page.goto(`/projects/${TEST_PROJECT.id}/settings`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Налаштування",
  );
  await expect(page.getByTestId("nav-mobile")).toContainText("Мобільні знімки");
  await expect(
    page.getByText("Не враховувати рядок стану й панель навігації"),
  ).toBeVisible();

  // a setting is found by its Ukrainian name, and by its English one
  const search = page.getByTestId("settingsSearch");
  await search.fill("панель навігації");
  await expect(page.getByTestId("section-mobile")).toBeVisible();
  await expect(page.getByTestId("section-jira")).toBeHidden();
  await search.fill("navigation");
  await expect(page.getByTestId("section-mobile")).toBeVisible();
});

// Ukrainian texts run longer: nothing is cut off or wrapped mid-word
// eslint-disable-next-line @typescript-eslint/no-unused-vars
test("renders the project list in Ukrainian", async ({ page, authUser }) => {
  await inUkrainian(page);
  await page.goto("/projects");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Проєкти");

  await expect(page).toHaveScreenshot("projects-list-page-uk.png");
});
