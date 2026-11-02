import { expect } from "@playwright/test";
import { test } from "fixtures";
import { TEST_PROJECT } from "~client/_test/test.data.helper";
import type { ProjectInsights } from "~client/types";
import { API_URL, mockGetProjects } from "utils/mocks";

const INSIGHTS: ProjectInsights = {
  days: 90,
  windowStart: "2026-07-27T12:00:00.000Z",
  historyStart: "2026-07-27T12:00:00.000Z",
  partialHistory: false,
  summary: {
    baselines: 40,
    unused: 2,
    checks: 20,
    runs: 300,
    changedPercent: 12.5,
    flips: 3,
    a11yIssues: 17,
    waiting: 4,
    medianDecisionHours: 2.5,
  },
  unused: [
    {
      id: "old-1",
      name: "Old promo",
      customTags: "",
      branchName: "master",
      device: "Pixel 7 · Android 15",
      profile: {
        os: "Android 15",
        device: "Pixel 7",
        browser: "",
        viewport: "",
      },
      hasBaseline: true,
      lastUsedAt: "2026-04-08T12:00:00.000Z",
      idleDays: 200,
    },
    {
      id: "old-2",
      name: "Onboarding v1",
      customTags: "",
      branchName: "master",
      device: "Galaxy S23 · Android 14",
      hasBaseline: false,
      lastUsedAt: "2026-05-08T12:00:00.000Z",
      idleDays: 170,
    },
  ],
  unstable: [
    {
      name: "Login",
      customTags: "",
      devices: ["Pixel 7 · Android 15"],
      profiles: [
        { os: "Android 15", device: "Pixel 7", browser: "", viewport: "" },
      ],
      runs: 11,
      changedPercent: 72.7,
      rejected: 0,
      flips: 3,
      baselineChanges: 1,
      lastChangeAt: "2026-10-25T10:00:00.000Z",
    },
  ],
  a11yScreens: [
    {
      name: "Payment",
      customTags: "",
      issues: 6,
      newIssues: 1,
      reported: 2,
      ignored: 1,
    },
  ],
  a11yRules: [{ rule: "Touch target too small", count: 20 }],
  noise: [{ name: "Login", customTags: "", tinyApproved: 4, runs: 11 }],
  captureIssues: [{ name: "Cards", customTags: "", hidden: 4, runs: 8 }],
  coverage: [
    {
      device: "Galaxy S23 · Android 14",
      profile: {
        os: "Android 14",
        device: "Galaxy S23",
        browser: "",
        viewport: "",
      },
      checks: 3,
      missingCount: 1,
      missing: [{ name: "Profile", customTags: "" }],
    },
  ],
};

const openInsights = async (page, insights: ProjectInsights = INSIGHTS) => {
  await mockGetProjects(page, [TEST_PROJECT]);
  const requests: string[] = [];
  await page.route(
    `${API_URL}/analytics/${TEST_PROJECT.id}?days=*`,
    (route, request) => {
      requests.push(new URL(request.url()).searchParams.get("days"));
      return route.fulfill({ body: JSON.stringify(insights) });
    },
  );
  await page.goto(`/insights/${TEST_PROJECT.id}`);
  return requests;
};

test("shows what the project history says", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await openInsights(page);

  await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
  await expect(page.getByTestId("insightsTile-unused")).toBeVisible();
  await expect(page.getByRole("row", { name: /Old promo/ })).toContainText(
    "200",
  );
  await expect(page.getByRole("row", { name: /Onboarding v1/ })).toContainText(
    "never approved",
  );
  await expect(page.getByRole("row", { name: /^Login/ })).toContainText(
    "72.7%",
  );
  await expect(page.getByRole("row", { name: /^Payment/ })).toContainText("6");
  await expect(page.getByText("Touch target too small")).toBeVisible();
  await expect(
    page.getByText("4 tiny changes approved in 11 screens"),
  ).toBeVisible();
  await expect(
    page.getByText("4 with hidden changes of 8 screens"),
  ).toBeVisible();
  await expect(page.getByText(/taken while loading/)).toHaveCount(0);
  await expect(page.getByTestId("insightsCoverage")).toContainText(
    "1 missing of 4",
  );
});

test("shows each device as tags, OS first", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await openInsights(page);

  const tags = (row: string) =>
    page.getByRole("row", { name: row }).getByTestId("deviceTag");
  await expect(tags("Old promo")).toHaveText(["Android 15", "Pixel 7"]);
  await expect(tags("Login")).toHaveText(["Android 15", "Pixel 7"]);
  // a server from before the tags sends one line: one tag, not a broken row
  await expect(tags("Onboarding v1")).toHaveText(["Galaxy S23 · Android 14"]);
  await expect(
    page.getByTestId("insightsCoverage").getByTestId("deviceTag"),
  ).toHaveText(["Android 14", "Galaxy S23"]);
});

test("says from when the history is kept in one line by the period", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await openInsights(page, { ...INSIGHTS, partialHistory: true });

  const from = page.getByTestId("insightsHistoryFrom");
  await expect(from).toHaveText(/^History from /);
  await expect(from).toHaveAttribute("title", /build limit/);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("asks for the period it shows", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  const requests = await openInsights(page);
  await expect(page.getByTestId("insightsTile-unused")).toBeVisible();

  await page.getByTestId("insightsPeriod").click();
  await page.getByRole("option", { name: "Last 30 days" }).click();

  await expect.poll(() => requests).toEqual(["90", "30"]);
});

test("deletes the selected unused baselines after confirming", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await openInsights(page);
  const deleted: string[] = [];
  await page.route(`${API_URL}/test-variations/*`, (route, request) => {
    if (request.method() !== "DELETE") return route.fallback();
    deleted.push(new URL(request.url()).pathname.split("/").pop());
    return route.fulfill({ body: JSON.stringify({ id: "x", name: "x" }) });
  });

  await page.getByRole("checkbox", { name: "Select Old promo" }).check();
  await page.getByRole("button", { name: "Delete 1" }).click();
  await expect(page.getByRole("dialog")).toContainText("Delete 1 baselines?");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();

  await expect.poll(() => deleted).toEqual(["old-1"]);
});
