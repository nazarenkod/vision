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
