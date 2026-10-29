import { expect } from "@playwright/test";
import { AUTH_USER, test } from "fixtures";
import { TEST_PROJECT } from "~client/_test/test.data.helper";
import {
  API_URL,
  mockChangePassword,
  mockGetProjects,
  mockUpdateUser,
} from "utils/mocks";

const project = TEST_PROJECT;

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [project]);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test("renders", async ({ profilePage, page }) => {
  await expect(page).toHaveScreenshot("profile-page.png");
});

test("updates the user details", async ({ profilePage, page }) => {
  await mockUpdateUser(page, AUTH_USER);

  await profilePage.firstName.fill("Jane");
  await profilePage.lastName.fill("Doe");
  await profilePage.email.fill("jane@example.com");

  const [request] = await Promise.all([
    page.waitForRequest(
      (request) =>
        request.url() === `${API_URL}/users` && request.method() === "PUT",
    ),
    profilePage.updateUserBtn.click(),
  ]);

  expect(request.postDataJSON()).toEqual({
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
  });
  await expect(profilePage.notification.message).toHaveText("User updated");
  // the header shows the saved user, and it is kept for the next visit
  await expect(profilePage.header.avatarButton).toHaveText("JD");
  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("user") ?? "{}"),
  );
  expect(stored).toMatchObject({ firstName: "Jane", lastName: "Doe" });
});

test("does not send user details that fail validation", async ({
  profilePage,
  page,
}) => {
  const updates: string[] = [];
  page.on("request", (request) => {
    if (request.url() === `${API_URL}/users` && request.method() === "PUT") {
      updates.push(request.url());
    }
  });

  await profilePage.firstName.fill("J");
  await profilePage.email.fill("not an email");
  await profilePage.updateUserBtn.click();

  await expect(
    profilePage.userForm.getByText("Enter at least two characters."),
  ).toBeVisible();
  await expect(
    profilePage.userForm.getByText("Enter valid email address"),
  ).toBeVisible();
  expect(updates).toEqual([]);
});

test("changes the password", async ({ profilePage, page }) => {
  await mockChangePassword(page);

  await profilePage.password.fill("new password");

  const [request] = await Promise.all([
    page.waitForRequest("**/users/password"),
    profilePage.updatePasswordBtn.click(),
  ]);

  expect(request.postDataJSON()).toEqual({ password: "new password" });
  await expect(profilePage.notification.message).toHaveText("Password updated");
  await expect(profilePage.password).toHaveValue("");
});

test("shows the API key and puts it in the config examples", async ({
  profilePage,
}) => {
  await profilePage.page.getByRole("button", { name: "Show API key" }).click();
  await expect(profilePage.apiKeyCard).toContainText(AUTH_USER.apiKey);
  await expect(profilePage.configFile).toHaveValue(
    new RegExp(`"apiKey": "${AUTH_USER.apiKey}"`),
  );

  await profilePage.envVariablesTab.click();

  await expect(profilePage.envVariables).toHaveValue(
    new RegExp(`VRT_APIKEY="${AUTH_USER.apiKey}"`),
  );
});

test("hides the API key until Show and copies it", async ({
  profilePage,
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const value = page.getByTestId("apiKeyValue");
  const lastFour = AUTH_USER.apiKey.slice(-4);

  // hidden, in the examples as well
  await expect(value).not.toContainText(AUTH_USER.apiKey);
  await expect(value).toContainText(`•${lastFour}`);
  await expect(profilePage.configFile).not.toHaveValue(
    new RegExp(AUTH_USER.apiKey),
  );

  await page.getByRole("button", { name: "Show API key" }).click();
  await expect(value).toHaveText(AUTH_USER.apiKey);
  await page.getByRole("button", { name: "Hide API key" }).click();
  await expect(value).not.toContainText(AUTH_USER.apiKey);

  // copying needs no Show
  await page.getByTestId("copyApiKey").click();
  await expect(page.getByTestId("copyApiKey")).toHaveAttribute(
    "data-copied",
    "true",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    AUTH_USER.apiKey,
  );
});
