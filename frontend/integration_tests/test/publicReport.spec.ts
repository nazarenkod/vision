import { expect } from "@playwright/test";
import { test } from "fixtures";
import { PublicReport } from "~client/types/buildOverview";
import { API_URL, mockImage } from "utils/mocks";

const report = (waiting: number): PublicReport => ({
  state: "ok",
  language: "en",
  sections: ["sum", "chg", "bugs"],
  createdBy: "Anna Petrenko",
  overview: {
    verdict: waiting ? "waiting" : "passed",
    counts: {
      total: 47,
      changed: waiting,
      new: 0,
      rejected: 0,
      passed: 47 - waiting,
      waiting,
      a11yNew: 0,
      bugs: 0,
    },
    progress: { decided: 6 - waiting, needed: 6, people: [] },
    devices: [],
    features: [],
    quietFeatures: { count: 0, screens: 0 },
    bugs: [],
    previous: null,
    build: {
      id: "b",
      number: 128,
      branchName: "release/7.4",
      ciBuildId: null,
      projectId: "p",
      projectName: "Mobile Shop",
      createdAt: "2026-10-31T10:42:00Z",
      updatedAt: "2026-10-31T10:48:00Z",
    },
    asOf: "2026-10-31T11:05:00Z",
  },
  changes: [],
  moreChanges: 0,
  a11y: [],
});

test.beforeEach(async ({ page }) => {
  await mockImage(page, "image.png");
});

test("updates the open page within 10 s", async ({ page }) => {
  let waiting = 5;
  await page.route(`${API_URL}/public/reports/tok-123`, (route) =>
    route.fulfill({ json: report(waiting), headers: { ETag: `"${waiting}"` } }),
  );
  await page.goto("/r/tok-123");

  const summary = page.getByTestId("reportSection-sum");
  await expect(summary).toContainText("5Waiting");
  await expect(page.getByTestId("reportLive")).toContainText("Live");
  // a page without an account sees the report and nothing of the app around it
  await expect(page.getByRole("navigation")).toHaveCount(0);

  waiting = 0;
  await expect(page.getByTestId("reportDocument")).toContainText("Passed", {
    timeout: 10_000,
  });
});

test("says when the link expired or the build is gone", async ({ page }) => {
  await page.route(`${API_URL}/public/reports/old`, (route) =>
    route.fulfill({ json: { state: "expired" } }),
  );
  await page.route(`${API_URL}/public/reports/gone`, (route) =>
    route.fulfill({ json: { state: "gone" } }),
  );

  await page.goto("/r/old");
  await expect(page.getByTestId("reportUnavailable")).toContainText(
    "Link expired",
  );
  await expect(page.getByTestId("reportDocument")).toHaveCount(0);

  await page.goto("/r/gone");
  await expect(page.getByTestId("reportUnavailable")).toContainText(
    "This build no longer exists",
  );
});
