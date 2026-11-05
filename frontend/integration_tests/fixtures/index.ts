import { test as base } from "@playwright/test";
import { LoginPage, ProfilePage, ProjectListPage, ProjectPage } from "pages";
import { TestVariationDetailsPage } from "pages/TestVariationDetailsPage";
import { TestVariationListPage } from "pages/TestVariationListPage";
import { UserListPage } from "pages/UserListPage";
import type { User } from "~client/types";

type Options = {
  // the role the signed-in user has; override with test.use({ userRole })
  userRole: User["role"];
  // whether the signed-in user saved a Jira token in their profile; the only
  // token that reaches Jira (035). Override with test.use({ userJiraToken })
  userJiraToken: boolean;
};

type Fixtures = {
  loginPage: LoginPage;
  openProjectPage: (
    id: string,
    buildId?: string,
    testId?: string,
    tab?: "overview" | "changes" | "all" | "a11y",
  ) => Promise<ProjectPage>;
  openTestVariationListPage: (
    projectId: string,
  ) => Promise<TestVariationListPage>;
  openTestVariationDetailsPage: (
    id: string,
  ) => Promise<TestVariationDetailsPage>;
  projectListPage: ProjectListPage;
  profilePage: ProfilePage;
  userListPage: UserListPage;
  authUser: void;
};

// the user the authUser fixture signs in, before its role is applied
export const AUTH_USER = {
  id: "00b428bf-9b4d-487f-9883-0dc5ec9403d3",
  email: "admin@vision.local",
  firstName: "fname",
  lastName: "lname",
  apiKey: "ASJDHGAKJSDGASD",
  role: "admin",
  token: "eyJsgOE8Bw2bFwhZAugRRGm8U",
};

export const test = base.extend<Fixtures & Options>({
  userRole: ["admin", { option: true }],
  userJiraToken: [false, { option: true }],
  loginPage: async ({ page }, use) => {
    await page.goto("/");

    await use(new LoginPage(page));
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  projectListPage: async ({ page, authUser }, use) => {
    await page.goto("/projects");

    await use(new ProjectListPage(page));
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  profilePage: async ({ page, authUser }, use) => {
    await page.goto("/profile");

    await use(new ProfilePage(page));
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userListPage: async ({ page, authUser }, use) => {
    await page.goto("/users");

    await use(new UserListPage(page));
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  openProjectPage: async ({ page, authUser }, use) => {
    // A build opens on its Overview now (031); these tests are about the list
    // of all runs, as the page opened before, so a build given here opens on
    // All tests unless the test names another tab.
    await use(async (id, buildId, testId, tab = "all") => {
      let url = `${id}`;
      if (buildId) {
        url = url.concat(`?buildId=${buildId}`);
        if (tab !== "overview") {
          url = url.concat(`&tab=${tab}`);
        }
        if (testId) {
          url = url.concat(`&testId=${testId}`);
        }
      }
      await page.goto(url);
      return new ProjectPage(page);
    });
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  openTestVariationListPage: async ({ page, authUser }, use) => {
    await use(async (projectId) => {
      await page.goto(`/variations/${projectId}`);
      return new TestVariationListPage(page);
    });
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  openTestVariationDetailsPage: async ({ page, authUser }, use) => {
    await use(async (id) => {
      await page.goto(`/variations/details/${id}`);
      return new TestVariationDetailsPage(page);
    });
  },
  // Seeded before the app's own scripts, so a test can open its page straight
  // away instead of loading "/" first just to reach localStorage. Only once per
  // tab: a 401 logs out and reloads, and seeding again would loop it.
  authUser: async ({ page, userRole, userJiraToken }, use) => {
    await page.addInitScript(
      (user) => {
        if (!window.sessionStorage.getItem("authUserSeeded")) {
          window.localStorage.setItem("user", user);
          window.sessionStorage.setItem("authUserSeeded", "1");
        }
      },
      JSON.stringify({
        ...AUTH_USER,
        role: userRole,
        jiraTokenSet: userJiraToken,
      }),
    );

    await use();
  },
});
