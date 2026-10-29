import { expect } from "@playwright/test";
import { test } from "fixtures";
import { mockGetProjects, mockGetUsers } from "utils/mocks";
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
