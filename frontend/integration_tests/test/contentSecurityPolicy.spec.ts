import { expect, test } from "@playwright/test";

// The content security policy itself (052, REQ-052-08): this file uses the plain test, without
// the fixture that fails a test on a blocked resource, because blocking is what it checks.
test("answers with a content security policy for Vision's own scripts and API", async ({
  page,
}) => {
  const response = await page.goto("/login");
  const policy = response!.headers()["content-security-policy"] ?? "";

  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toMatch(
    /connect-src 'self' http:\/\/localhost:4200 ws:\/\/localhost:4200/,
  );
});

test("runs no script put into the page from elsewhere", async ({ page }) => {
  const blocked: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text()))
      blocked.push(message.text());
  });
  await page.goto("/login");

  await page
    .addScriptTag({ content: "window.__injected = true;" })
    .catch(() => undefined);
  await page
    .addScriptTag({ url: "https://example.com/evil.js" })
    .catch(() => undefined);

  expect(
    await page.evaluate(
      () => (window as unknown as { __injected?: boolean }).__injected,
    ),
  ).toBeUndefined();
  expect(blocked.length).toBeGreaterThan(0);
});
