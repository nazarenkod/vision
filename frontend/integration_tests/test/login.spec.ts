import { test } from "fixtures";
import { expect } from "@playwright/test";

test("renders", async ({ loginPage }) => {
  await expect(loginPage.page).toHaveScreenshot("login-page.png");
});

test("can login", async ({ loginPage }) => {
  await loginPage.email.type("email@google.com");
  await loginPage.password.type("123456");

  const [request] = await Promise.all([
    loginPage.page.waitForRequest("**/login"),
    loginPage.loginBtn.click(),
  ]);

  expect(request.postDataJSON()).toEqual({
    email: "email@google.com",
    password: "123456",
  });
});

test("show and hide password", async ({ loginPage }) => {
  await loginPage.password.type("123456");

  await loginPage.showPasswordBtn.click();
  expect(await loginPage.password.getAttribute("type")).toBe("text");

  await loginPage.showPasswordBtn.click();
  expect(await loginPage.password.getAttribute("type")).toBe("password");
});

test("offers no way to sign up", async ({ loginPage }) => {
  await expect(
    loginPage.page.getByText("No account? Ask an admin to create one."),
  ).toBeVisible();
  await expect(
    loginPage.page.getByRole("link", { name: /create/i }),
  ).toHaveCount(0);
  await expect(loginPage.page.locator('a[href="/register"]')).toHaveCount(0);
});

test("an old sign-up link opens the sign-in page", async ({ page }) => {
  await page.goto("/register");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId("loginBtn")).toBeVisible();
});

test("an old sign-up link opens the start page once signed in", async ({
  page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authUser,
}) => {
  await page.goto("/register");
  await expect(page).not.toHaveURL(/\/(register|login)$/);
});

test("offers SSO and the local sign-in together", async ({ page }) => {
  await page.route("**/users/oidc/enabled", (route) =>
    route.fulfill({ body: "true" }),
  );
  await page.goto("/login");

  // corporate sign-in first and primary, a local account below it (045, REQ-046-51)
  const sso = page.getByTestId("oidcLoginBtn");
  const local = page.getByTestId("loginBtn");
  await expect(sso).toBeVisible();
  await expect(sso).toHaveClass(/MuiButton-contained/);
  await expect(page.getByRole("separator")).toHaveText(
    "or with a local account",
  );
  await expect(local).toHaveClass(/MuiButton-outlined/);
  await expect(local).toHaveAttribute("data-variant", "secondary");
  const [ssoBox, separatorBox, localBox] = await Promise.all([
    sso.boundingBox(),
    page.getByRole("separator").boundingBox(),
    local.boundingBox(),
  ]);
  expect(ssoBox!.y).toBeLessThan(separatorBox!.y);
  expect(separatorBox!.y).toBeLessThan(localBox!.y);
  await page.getByTestId("email").fill("contractor@bank.test");
  await page.getByTestId("password").fill("their-password");
  const [request] = await Promise.all([
    page.waitForRequest("**/users/login"),
    page.getByTestId("loginBtn").click(),
  ]);
  expect(request.postDataJSON()).toEqual({
    email: "contractor@bank.test",
    password: "their-password",
  });
});

test("signs in locally with the primary button when there is no SSO", async ({
  loginPage,
}) => {
  await expect(loginPage.loginBtn).toHaveClass(/MuiButton-contained/);
  await expect(loginPage.page.getByTestId("oidcLoginBtn")).toHaveCount(0);
  await expect(loginPage.page.getByRole("separator")).toHaveCount(0);
});

test("keeps language and theme in the corner of the sign-in page", async ({
  loginPage,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const corner = page.getByTestId("authCorner");
  const language = corner.getByTestId("languageSwitch");
  const theme = corner.getByTestId("themeToggle");
  await expect(language).toBeVisible();
  await expect(theme).toBeVisible();

  // top right of the form half, above the form
  const box = (await corner.boundingBox())!;
  const side = (await page.getByTestId("authFormSide").boundingBox())!;
  const switchBox = (await language.boundingBox())!;
  expect(box.y - side.y).toBeLessThan(48);
  expect(side.x + side.width - (box.x + box.width)).toBeLessThan(48);
  expect(switchBox.x).toBeGreaterThan(side.x + side.width / 2);
  const form = (await loginPage.loginForm.boundingBox())!;
  expect(box.y + box.height).toBeLessThan(form.y);

  // both work before signing in
  await theme.click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe("dark");
  await language.getByRole("button", { name: "Українська" }).click();
  await expect(loginPage.loginBtn).toHaveText("Увійти");
});

test("shows the brand and the form side by side with one logo", async ({
  loginPage,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const layout = page.getByTestId("authLayout");
  const brand = page.getByTestId("authBrand");
  const form = page.getByTestId("authFormSide");

  await expect(layout.getByTestId("brandMark")).toHaveCount(1);
  await expect(brand.getByTestId("brandMark")).toBeVisible();
  await expect(brand).toContainText(
    "Doesn't just see screens. Understands them.",
  );
  await expect(form.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(loginPage.loginForm).toBeVisible();

  // two halves: the brand on the left, the form on the right, at one height
  const [brandBox, formBox] = [
    (await brand.boundingBox())!,
    (await form.boundingBox())!,
  ];
  expect(Math.round(brandBox.y)).toBe(Math.round(formBox.y));
  expect(brandBox.x + brandBox.width).toBeLessThanOrEqual(formBox.x + 1);
  expect(Math.abs(brandBox.width - formBox.width)).toBeLessThan(4);

  // one above the other on a phone
  await page.setViewportSize({ width: 390, height: 844 });
  const [narrowBrand, narrowForm] = [
    (await brand.boundingBox())!,
    (await form.boundingBox())!,
  ];
  expect(narrowBrand.y + narrowBrand.height).toBeLessThanOrEqual(
    narrowForm.y + 1,
  );
});

test("brings back the grid and the stray pixel without leaving a square", async ({
  loginPage,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId("authFormGrid")).toBeAttached();

  // the pixel plays once as a difference and fades into the grid (REQ-046-57)
  const pixel = page.getByTestId("authStrayPixel");
  const animation = await pixel.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      name: style.animationName,
      count: style.animationIterationCount,
    };
  });
  expect(animation).toEqual({ name: "v-stray-auth", count: "1" });
  await expect
    .poll(() => pixel.evaluate((el) => getComputedStyle(el).opacity), {
      timeout: 5000,
    })
    .toBe("0");
  await expect(loginPage.loginForm).toBeVisible();
});

test("shows the end of the sign-in motion at once with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const pixel = page.getByTestId("authStrayPixel");
  await expect
    .poll(() => pixel.evaluate((el) => getComputedStyle(el).opacity), {
      timeout: 500,
    })
    .toBe("0");
});

test("the comparison drawing rests on its finished state with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const style = (testId: string, property: "opacity" | "transform") =>
    page
      .getByTestId(testId)
      .evaluate((node, name) => getComputedStyle(node)[name], property);

  await expect.poll(() => style("authScanLine", "opacity")).toBe("0");
  await expect.poll(() => style("authVariableClock", "opacity")).toBe("0");
  await expect.poll(() => style("authMovedButton", "transform")).toBe("none");
});

// A sign-in through SSO counts only in the tab that started it (052, REQ-052-07)
test.describe("signing in after SSO", () => {
  const nonce = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5";
  const user = {
    id: "u1",
    email: "ann@bank.test",
    firstName: "Ann",
    lastName: "B",
    role: "editor",
  };

  test("starts SSO with a value this tab keeps", async ({ page }) => {
    await page.route("**/users/oidc/enabled", (route) =>
      route.fulfill({ body: "true" }),
    );
    // 204 to the way to the provider: the browser stays on Vision, so the tab can be read
    await page.route("**/users/oidc/login*", (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto("/login");
    // an explicit sign-out keeps the page from going to the provider by itself
    await page.evaluate(() => sessionStorage.setItem("oidcLoggedOut", "true"));
    await page.reload();

    const [request] = await Promise.all([
      page.waitForRequest("**/users/oidc/login*"),
      // the navigation the 204 answers never finishes: nothing to wait for
      page.getByTestId("oidcLoginBtn").click({ noWaitAfter: true }),
    ]);
    const sent = new URL(request.url()).searchParams.get("nonce");
    expect(sent).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(await page.evaluate(() => sessionStorage.getItem("oidcNonce"))).toBe(
      sent,
    );
  });

  // a tile of the provider or a bookmark of the API's address lands on /login?sso (found in review)
  test("starts SSO from the tab when a sign-in began outside Vision", async ({
    page,
  }) => {
    await page.route("**/users/oidc/enabled", (route) =>
      route.fulfill({ body: "true" }),
    );
    await page.route("**/users/oidc/login*", (route) =>
      route.fulfill({ status: 204 }),
    );

    const [request] = await Promise.all([
      page.waitForRequest("**/users/oidc/login*"),
      page.goto("/login?sso"),
    ]);

    const sent = new URL(request.url()).searchParams.get("nonce");
    expect(sent).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(await page.evaluate(() => sessionStorage.getItem("oidcNonce"))).toBe(
      sent,
    );
  });

  test("signs in when the token comes back to the tab that started it", async ({
    page,
  }) => {
    let asked = 0;
    await page.route("**/users/me", (route) => {
      asked++;
      return route.fulfill({ body: JSON.stringify(user) });
    });
    await page.route("**/projects", (route) => route.fulfill({ body: "[]" }));
    await page.goto("/login");
    await page.evaluate(
      (value) => sessionStorage.setItem("oidcNonce", value),
      nonce,
    );
    // away and back, as the provider sends the tab: a new fragment alone loads nothing
    await page.goto("about:blank");

    await page.goto(`/login#token=the-token&nonce=${nonce}`);

    await expect(page).not.toHaveURL(/\/login/);
    expect(asked).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("user") ?? "{}").token,
      ),
    ).toBe("the-token");
    // the value is used once
    expect(
      await page.evaluate(() => sessionStorage.getItem("oidcNonce")),
    ).toBeNull();
  });

  test("does not sign in from a link the browser did not start", async ({
    page,
  }) => {
    let asked = 0;
    await page.route("**/users/me", (route) => {
      asked++;
      return route.fulfill({ body: JSON.stringify(user) });
    });

    await page.goto(`/login#token=someone-elses-token&nonce=${nonce}`);

    await expect(
      page.getByText(
        "This sign-in was not started in this browser. Sign in again.",
      ),
    ).toBeVisible();
    expect(page.url()).not.toContain("token");
    expect(asked).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem("user"))).toBeNull();

    // the same with a link that carries no value at all, as links before 052 did
    await page.goto("about:blank");
    await page.goto("/login#token=someone-elses-token");
    await expect(
      page.getByText(
        "This sign-in was not started in this browser. Sign in again.",
      ),
    ).toBeVisible();
    expect(asked).toBe(0);
  });
});
