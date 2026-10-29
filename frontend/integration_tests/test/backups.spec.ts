import { expect, Page } from "@playwright/test";
import { test } from "fixtures";
import { TEST_PROJECT } from "~client/_test/test.data.helper";
import { API_URL, mockGetProjects } from "utils/mocks";
import type { BackupsOverview } from "~client/types";

const overview = (changes: Partial<BackupsOverview> = {}): BackupsOverview => ({
  configured: false,
  lastSuccessAt: null,
  warning: null,
  available: true,
  lastAttemptAt: null,
  lastError: null,
  pendingUploads: 0,
  runningSince: null,
  backupRequestedAt: null,
  drive: { connected: false, email: null, folderName: null },
  settings: { time: "03:17", keep: 7 },
  remote: null,
  ...changes,
});

const mockOverview = (page: Page, value: () => BackupsOverview) =>
  page.route(`${API_URL}/backups`, (route) =>
    route.fulfill({ body: JSON.stringify(value()) }),
  );

const connected = overview({
  configured: true,
  lastSuccessAt: "2026-10-27T03:18:00Z",
  drive: {
    connected: true,
    email: "qa@privatbank.ua",
    folderName: "vision-backups",
  },
  remote: {
    backups: [
      {
        name: "vision-20261027T031700Z.tar",
        size: 1048576,
        modifiedTime: "2026-10-27T03:18:00Z",
      },
    ],
    error: null,
  },
});

test.beforeEach(async ({ page }) => {
  await mockGetProjects(page, [TEST_PROJECT]);
  await page.route(`${API_URL}/backups/status`, (route) =>
    route.fulfill({
      body: JSON.stringify({
        configured: false,
        lastSuccessAt: null,
        warning: null,
      }),
    }),
  );
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test("connects Google Drive with a device code", async ({ page, authUser }) => {
  let state = overview();
  await mockOverview(page, () => state);
  await page.route(`${API_URL}/backups/drive/connect`, (route) =>
    route.fulfill({
      body: JSON.stringify({
        userCode: "ABC-DEF-GHI",
        verificationUrl: "https://www.google.com/device",
        expiresAt: "2099-01-01T00:00:00Z",
        interval: 1,
      }),
    }),
  );
  let polls = 0;
  await page.route(`${API_URL}/backups/drive/poll`, (route) => {
    polls += 1;
    if (polls < 2) {
      return route.fulfill({ body: JSON.stringify({ state: "pending" }) });
    }
    state = connected;
    return route.fulfill({
      body: JSON.stringify({ state: "connected", email: "qa@privatbank.ua" }),
    });
  });
  await page.goto("/backups");

  await page
    .getByTestId("driveClientId")
    .fill("cid.apps.googleusercontent.com");
  await page.getByTestId("driveClientSecret").fill("client-secret");
  const [request] = await Promise.all([
    page.waitForRequest(`${API_URL}/backups/drive/connect`),
    page.getByTestId("driveConnect").click(),
  ]);
  expect(request.postDataJSON()).toEqual({
    clientId: "cid.apps.googleusercontent.com",
    clientSecret: "client-secret",
  });

  await expect(page.getByTestId("driveUserCode")).toHaveText("ABC-DEF-GHI");
  await expect(page.getByTestId("driveConnected")).toContainText(
    "qa@privatbank.ua",
    { timeout: 10000 },
  );
  await expect(page.getByTestId("backupRow")).toHaveCount(1);
});

test("offers to start again when Google refuses", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await mockOverview(page, () => overview());
  await page.route(`${API_URL}/backups/drive/connect`, (route) =>
    route.fulfill({
      body: JSON.stringify({
        userCode: "ABC",
        verificationUrl: "https://www.google.com/device",
        expiresAt: "2099-01-01T00:00:00Z",
        interval: 1,
      }),
    }),
  );
  await page.route(`${API_URL}/backups/drive/poll`, (route) =>
    route.fulfill({
      body: JSON.stringify({
        state: "failed",
        error: "Access was denied in Google.",
      }),
    }),
  );
  await page.goto("/backups");
  await page.getByTestId("driveClientId").fill("cid");
  await page.getByTestId("driveClientSecret").fill("secret");
  await page.getByTestId("driveConnect").click();

  await expect(page.getByTestId("driveError")).toHaveText(
    "Access was denied in Google.",
    { timeout: 10000 },
  );
  await expect(page.getByTestId("driveConnect")).toHaveText("Start again");
});

test("asks the server for a backup and saves the schedule", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  let state = connected;
  await mockOverview(page, () => state);
  await page.route(`${API_URL}/backups/run`, (route) => {
    state = { ...connected, backupRequestedAt: "2026-10-27T12:00:00Z" };
    return route.fulfill({
      body: JSON.stringify({ backupRequestedAt: "2026-10-27T12:00:00Z" }),
    });
  });
  await page.route(`${API_URL}/backups/settings`, (route) =>
    route.fulfill({ body: route.request().postData() ?? "{}" }),
  );
  await page.goto("/backups");

  await page.getByTestId("backupNow").click();
  await expect(page.getByTestId("backupRequested")).toBeVisible();
  await expect(page.getByTestId("backupNow")).toBeDisabled();

  // nothing to save until the schedule changes
  await expect(page.getByTestId("saveBackupSettings")).toBeDisabled();
  await page.getByTestId("backupTime").fill("02:30");
  await page.getByTestId("backupKeep").fill("10");
  const [request] = await Promise.all([
    page.waitForRequest(`${API_URL}/backups/settings`),
    page.getByTestId("saveBackupSettings").click(),
  ]);
  expect(request.method()).toBe("PUT");
  expect(request.postDataJSON()).toEqual({ time: "02:30", keep: 10 });
});
