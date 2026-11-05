import { expect } from "@playwright/test";
import { AUTH_USER, test } from "fixtures";
import {
  TEST_BUILD_FAILED,
  TEST_PROJECT,
} from "~client/_test/test.data.helper";
import {
  API_URL,
  mockGetBuilds,
  mockGetProjects,
  mockSocket,
} from "utils/mocks";

// Spec 032: the events socket carries the login token and follows the open
// project; without a login there is no connection at all.

const project = TEST_PROJECT;
const handshake = (token: string) => `40${JSON.stringify({ token })}`;
const subscription = (projectId: string) =>
  `42${JSON.stringify(["subscribe", { projectId }])}`;

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [project]);
  await mockGetBuilds(page, project.id, [TEST_BUILD_FAILED]);
});

test("connects with the token of the signed-in user", async ({
  page,
  openProjectPage,
}) => {
  const { sent } = await mockSocket(page);

  await openProjectPage(project.id);

  await expect.poll(() => sent).toContain(handshake(AUTH_USER.token));
});

test("subscribes to the project that is open", async ({
  page,
  openProjectPage,
}) => {
  const { sent } = await mockSocket(page);

  await openProjectPage(project.id);

  await expect.poll(() => sent).toContain(subscription(project.id));
});

test("opens no events connection before signing in", async ({
  page,
  loginPage,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/socket.io/")) requests.push(request.url());
  });

  await expect(loginPage.loginBtn).toBeVisible();
  await page.waitForTimeout(1000);

  expect(requests).toEqual([]);
});

test("signing out closes the connection and signing in opens one with the new token", async ({
  page,
  projectListPage,
}) => {
  const { sent } = await mockSocket(page);
  await expect.poll(() => sent).toContain(handshake(AUTH_USER.token));

  await projectListPage.sideNav.openAvatarMenu();
  await projectListPage.sideNav.avatarMenuItem("Log out").click();
  // the client leaves the namespace as it closes the connection
  await expect.poll(() => sent).toContain("41");

  const newToken = "eyJnew-login-token";
  await page.route(`${API_URL}/users/login`, (route) =>
    route.fulfill({ body: JSON.stringify({ ...AUTH_USER, token: newToken }) }),
  );
  await page.getByTestId("email").fill(AUTH_USER.email);
  await page.getByTestId("password").fill("123456");
  await page.getByTestId("loginBtn").click();

  await expect.poll(() => sent).toContain(handshake(newToken));
});

test("signs out when the server rejects the token", async ({
  page,
  projectListPage,
}) => {
  await mockSocket(page, { rejectToken: AUTH_USER.token });

  await expect(projectListPage.page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("user"))).toBeNull();
});
