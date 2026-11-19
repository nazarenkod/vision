import { usersService } from "./users.service";

jest.mock("../_config/env.config", () => ({ API_URL: "http://api" }));

describe("signing out (052)", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    localStorage.clear();
  });

  it("asks the server to end this sign-in and forgets the token", () => {
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true, status: 204 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    localStorage.setItem(
      "user",
      JSON.stringify({ email: "ann@bank.test", token: "the-token" }),
    );

    usersService.logout();

    expect(localStorage.getItem("user")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("http://api/users/logout", {
      method: "POST",
      headers: { Authorization: "Bearer the-token" },
      keepalive: true,
    });
  });

  it("forgets the token even when the server cannot be reached", async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error("offline")),
    ) as unknown as typeof fetch;
    localStorage.setItem("user", JSON.stringify({ token: "the-token" }));

    expect(() => usersService.logout()).not.toThrow();
    await Promise.resolve();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("sends nothing when nobody is signed in", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    usersService.logout();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/*
 * Signing in through SSO (052): a token in the address is taken only by the tab that started
 * that sign-in. Otherwise a link with someone else's token signs the victim into the attacker's
 * account (login CSRF).
 */
describe("signing in through SSO (052)", () => {
  // the address the browser goes to, nonce included, is checked by Playwright (login.spec);
  // jsdom only reports that it cannot navigate, so that report is silenced here
  const consoleError = jest.spyOn(console, "error");
  beforeEach(() => consoleError.mockImplementation(() => undefined));
  afterEach(() => {
    consoleError.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });
  const nonceSent = () => sessionStorage.getItem("oidcNonce") as string;

  it("takes the token that comes back with the value this tab started with", () => {
    usersService.startOidcLogin();
    expect(usersService.takesOidcToken(nonceSent())).toBe(true);
  });

  it("takes a returning token only once", () => {
    // a token left in history or a copied link must not sign in a second time
    usersService.startOidcLogin();
    const nonce = nonceSent();

    expect(usersService.takesOidcToken(nonce)).toBe(true);
    expect(usersService.takesOidcToken(nonce)).toBe(false);
  });

  it.each([
    ["another tab's value", "someone-else"],
    ["no value", null],
    ["an empty value", ""],
  ])("refuses a token that comes back with %s", (_case, returned) => {
    usersService.startOidcLogin();
    expect(usersService.takesOidcToken(returned)).toBe(false);
  });

  it("refuses a token when this tab started no sign-in", () => {
    expect(usersService.takesOidcToken("anything")).toBe(false);
    // an empty stored value is no sign-in either
    sessionStorage.setItem("oidcNonce", "");
    expect(usersService.takesOidcToken("")).toBe(false);
  });

  it("makes a new, unguessable, address-safe value every time", () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 20; i++) {
      usersService.startOidcLogin();
      nonces.add(nonceSent());
    }
    expect(nonces.size).toBe(20);
    nonces.forEach((nonce) => expect(nonce).toMatch(/^[A-Za-z0-9_-]{32}$/));
  });

  it("lets the provider sign in again after an explicit sign-out only when asked", () => {
    usersService.markOidcLoggedOut();
    expect(usersService.isOidcLoggedOut()).toBe(true);

    usersService.startOidcLogin();

    expect(usersService.isOidcLoggedOut()).toBe(false);
  });

  it("keeps the returned token with the person, as a password sign-in does", async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"id":"u1","email":"ann@bank.test"}'),
      }),
    );
    const realFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const user = await usersService.completeOidcLogin("sso-token");

      expect(fetchMock).toHaveBeenCalledWith("http://api/users/me", {
        method: "GET",
        headers: { Authorization: "Bearer sso-token" },
      });
      expect(user).toMatchObject({ id: "u1", token: "sso-token" });
      expect(JSON.parse(localStorage.getItem("user") as string)).toMatchObject({
        token: "sso-token",
      });
    } finally {
      global.fetch = realFetch;
    }
  });
});

describe("whether SSO is on", () => {
  // asked once per page: isolate the module so each case starts uncached
  const fresh = (answer: () => Promise<unknown>) => {
    let service!: typeof usersService;
    const fetchMock = jest.fn(answer);
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.isolateModules(() => {
      service = jest.requireActual("./users.service").usersService;
    });
    return { service, fetchMock };
  };
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it.each([
    [
      "the server says true",
      () => Promise.resolve({ ok: true, json: () => Promise.resolve(true) }),
      true,
    ],
    [
      "the server says anything but true",
      () => Promise.resolve({ ok: true, json: () => Promise.resolve("true") }),
      false,
    ],
    [
      "an older server without the endpoint",
      () => Promise.resolve({ ok: false, json: () => Promise.resolve(true) }),
      false,
    ],
    [
      "the server cannot be reached",
      () => Promise.reject(new Error("offline")),
      false,
    ],
  ])("shows SSO only when %s", async (_case, answer, expected) => {
    const { service } = fresh(answer as () => Promise<unknown>);
    await expect(service.isOidcEnabled()).resolves.toBe(expected);
  });

  it("asks the server once per page", async () => {
    const { service, fetchMock } = fresh(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(true) }),
    );
    await service.isOidcEnabled();
    await service.isOidcEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
