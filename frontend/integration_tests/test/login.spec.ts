import { test } from "fixtures";
import { expect } from "@playwright/test";

test("renders", async ({ loginPage }) => {
  await expect(loginPage.page).toHaveScreenshot("login-page.png");
});

test("can login", async ({ loginPage }) => {
  await loginPage.email.type("email@google.com");
  await loginPage.password.type("123456");

  const [request] = await Promise.all([
    loginPage.page.waitForRequest("**/login"),
    loginPage.loginBtn.click(),
  ]);

  expect(request.postDataJSON()).toEqual({
    email: "email@google.com",
    password: "123456",
  });
});

test("show and hide password", async ({ loginPage }) => {
  await loginPage.password.type("123456");

  await loginPage.showPasswordBtn.click();
  expect(await loginPage.password.getAttribute("type")).toBe("text");

  await loginPage.showPasswordBtn.click();
  expect(await loginPage.password.getAttribute("type")).toBe("password");
});

test("offers no way to sign up", async ({ loginPage }) => {
  await expect(
    loginPage.page.getByText("No account? Ask an admin to create one."),
  ).toBeVisible();
  await expect(
    loginPage.page.getByRole("link", { name: /create/i }),
  ).toHaveCount(0);
  await expect(loginPage.page.locator('a[href="/register"]')).toHaveCount(0);
});

test("an old sign-up link opens the sign-in page", async ({ page }) => {
  await page.goto("/register");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId("loginBtn")).toBeVisible();
});

test("an old sign-up link opens the start page once signed in", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await page.goto("/register");
  await expect(page).not.toHaveURL(/\/(register|login)$/);
});
