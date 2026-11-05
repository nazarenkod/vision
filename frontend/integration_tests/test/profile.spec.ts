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
  // the sidebar shows the saved user, and it is kept for the next visit
  await expect(profilePage.sideNav.avatarButton).toContainText("JD");
  await expect(profilePage.sideNav.avatarButton).toContainText("Jane Doe");
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

test("shows a new API key once and only its ending later", async ({
  profilePage,
  page,
  context,
}) => {
  const newKey = "NEWKEY0123456789ABCDEFGHJKMN";
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route(`${API_URL}/users/newApiKey`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: newKey }),
  );
  const value = page.getByTestId("apiKeyValue");

  // the server keeps only the hash: the ending, and the examples name the key's place
  await expect(value).toHaveText(`${"•".repeat(24)}${AUTH_USER.apiKeyEnding}`);
  await expect(profilePage.configFile).toHaveValue(/"apiKey": "YOUR_API_KEY"/);
  await expect(page.getByTestId("copyApiKey")).toHaveCount(0);

  // replacing a key in use asks first
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New API key" }).click();

  await expect(value).toHaveText(newKey);
  await expect(page.getByTestId("apiKeyOnce")).toContainText(
    "Vision shows the key only once",
  );
  await expect(profilePage.configFile).toHaveValue(
    new RegExp(`"apiKey": "${newKey}"`),
  );
  await expect(
    profilePage.page.getByText(/Save as vision\.json/),
  ).toBeVisible();
  await profilePage.envVariablesTab.click();
  await expect(profilePage.envVariables).toHaveValue(
    new RegExp(`VISION_APIKEY="${newKey}"`),
  );
  // the names SDK 1.0.0 reads (040); the old VRT_* ones it ignores
  await expect(profilePage.envVariables).not.toHaveValue(/VRT_/);

  await page.getByTestId("copyApiKey").click();
  await expect(page.getByTestId("copyApiKey")).toHaveAttribute(
    "data-copied",
    "true",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    newKey,
  );

  // back on the page later: only the new ending
  await page.reload();
  await expect(value).toHaveText(`${"•".repeat(24)}${newKey.slice(-4)}`);
  await expect(page.getByText(newKey)).toHaveCount(0);
});
