import { expect } from "@playwright/test";
import { test } from "fixtures";
import {
  mockAccountsEnabled,
  mockGetProjects,
  mockGetUsers,
} from "utils/mocks";
import {
  EDITOR_USER,
  GUEST_USER,
  TEST_PROJECT,
  TEST_USER,
} from "~client/_test/test.data.helper";
import { Role, User } from "~client/types";

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT]);
  await mockGetUsers(page, [TEST_USER, EDITOR_USER, GUEST_USER]);
  await mockAccountsEnabled(page, true);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test("renders", async ({ userListPage, page }) => {
  await expect(page).toHaveScreenshot("user-list-page.png");
});

const assignRoleCases: [User, keyof typeof Role][] = [
  [EDITOR_USER, "admin"],
  [EDITOR_USER, "guest"],
  [GUEST_USER, "editor"],
];

for (const [user, role] of assignRoleCases) {
  test(`can assign role ${role}`, async ({ userListPage, page }) => {
    const [request] = await Promise.all([
      page.waitForRequest("**/assignRole"),
      userListPage.changeRole(user.id, role),
    ]);

    expect(request.postDataJSON()).toEqual({
      id: user.id,
      role,
    });
  });
}

test("lets an admin set a user's password", async ({ userListPage, page }) => {
  await page.route(`**/users/${GUEST_USER.id}/password`, (route) =>
    route.fulfill({ body: "true" }),
  );
  const [request] = await Promise.all([
    page.waitForRequest(`**/users/${GUEST_USER.id}/password`),
    userListPage.setPassword(GUEST_USER.id, "fresh-password-1"),
  ]);

  expect(request.method()).toBe("PUT");
  expect(request.postDataJSON()).toEqual({ password: "fresh-password-1" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test("shows last sign-in or a dash", async ({ page, authUser }) => {
  const signedIn = {
    ...EDITOR_USER,
    lastSignInAt: "2026-10-29T08:15:00.000Z",
  };
  await mockGetUsers(page, [signedIn, { ...GUEST_USER, lastSignInAt: null }]);
  await page.goto("/users");

  const cells = page.getByTestId("lastSignIn");
  await expect(cells).toHaveCount(2);
  await expect(cells.nth(0)).toHaveText(
    await page.evaluate(
      (value) => new Date(value).toLocaleString(),
      signedIn.lastSignInAt,
    ),
  );
  await expect(cells.nth(1)).toHaveText("—");

  // and the search narrows the list by name or email
  await page.getByTestId("userSearch").fill(GUEST_USER.firstName.toUpperCase());
  await expect(cells).toHaveCount(1);
  await expect(cells.first()).toHaveText("—");
});

test("lets an admin create an account", async ({ userListPage, page }) => {
  const created: User = {
    ...GUEST_USER,
    id: "4b3c2d1e-0000-4000-8000-000000000035",
    email: "qa.new@example.com",
    firstName: "Qa",
    lastName: "New",
    role: "editor",
  };
  await page.route("**/users", (route, request) =>
    request.method() === "POST"
      ? route.fulfill({ body: JSON.stringify(created) })
      : route.fallback(),
  );

  const [request] = await Promise.all([
    page.waitForRequest(
      (request) =>
        request.url().endsWith("/users") && request.method() === "POST",
    ),
    userListPage.createAccount({
      email: "qa.new@example.com",
      firstName: "Qa",
      lastName: "New",
      role: "editor",
      password: "fresh-password-1",
    }),
  ]);

  expect(request.postDataJSON()).toEqual({
    email: "qa.new@example.com",
    firstName: "Qa",
    lastName: "New",
    role: "editor",
    password: "fresh-password-1",
  });
  // the row is there without reloading the page
  await expect(
    page.getByRole("row", { name: /qa\.new@example\.com/ }),
  ).toBeVisible();
  await expect(page.getByTestId("submitButton")).toHaveCount(0);
});

test("keeps New user from saving without an email or a password", async ({
  userListPage,
  page,
}) => {
  await page.getByTestId("newUser").click();
  const save = page.getByTestId("submitButton");
  await expect(save).toBeDisabled();
  await page.getByTestId("newUserEmail").fill("qa.new@example.com");
  await expect(save).toBeDisabled();
  await page.locator("#password").fill("fresh-password-1");
  await expect(save).toBeEnabled();
  expect(userListPage).toBeTruthy();
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test("explains that accounts come from SSO", async ({ page, authUser }) => {
  await mockAccountsEnabled(page, false);
  await page.goto("/users");

  const newUser = page.getByTestId("newUser");
  await expect(newUser).toBeDisabled();
  await newUser.locator("..").hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "Accounts come from LDAP or SSO: they appear on the first sign-in.",
  );
});

test("shows no head count and no row height picker", async ({
  userListPage,
  page,
}) => {
  await expect(page.getByTestId("newUser")).toBeEnabled();
  await expect(page.getByText(/\d+ people/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /density/i })).toHaveCount(0);
  expect(userListPage).toBeTruthy();
});
