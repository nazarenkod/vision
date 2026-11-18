import { authHeader, handleResponse, storedToken } from "./service.helpers";
import { fileSignature } from "./fileSignatures";
import { usersService } from "../services";

jest.mock("../_config/env.config", () => ({ API_URL: "http://api" }));
jest.mock("../services", () => ({ usersService: { logout: jest.fn() } }));

const response = (status: number, body: string, statusText = "Status") =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(body),
  }) as Response;

/*
 * Every API answer goes through handleResponse: a decision table over ok / status / body.
 * What matters is what the screen shows (data or the server's message) and that only a 401
 * signs the person out.
 */
describe("handleResponse", () => {
  // jsdom cannot fake location; the page reload itself is covered by Playwright (errors.spec)
  const at = (pathname: string) => window.history.pushState({}, "", pathname);
  const consoleError = jest.spyOn(console, "error");
  beforeEach(() => consoleError.mockImplementation(() => undefined));
  afterEach(() => {
    jest.clearAllMocks();
    at("/");
  });

  it("gives the parsed body of a successful answer", async () => {
    await expect(handleResponse(response(200, '{"id":"b1"}'))).resolves.toEqual(
      { id: "b1" },
    );
  });

  it("gives an empty string for a successful answer without a body", async () => {
    // 204 after delete: callers check truthiness, so it must not be parsed
    await expect(handleResponse(response(204, ""))).resolves.toBe("");
  });

  it("remembers the image signatures a successful answer carries", async () => {
    await handleResponse(
      response(
        200,
        JSON.stringify([{ fileSignatures: { "shot-1.png": "sig-1" } }]),
      ),
    );
    expect(fileSignature("shot-1.png")).toBe("sig-1");
  });

  it("rejects with the server's own message", async () => {
    await expect(
      handleResponse(
        response(409, '{"statusCode":409,"message":"Changed by Anna"}'),
      ),
    ).rejects.toBe("Changed by Anna");
  });

  it("rejects with the status text when the server gave no message", async () => {
    await expect(handleResponse(response(502, "", "Bad Gateway"))).rejects.toBe(
      "Bad Gateway",
    );
    await expect(
      handleResponse(response(500, '{"statusCode":500}', "Server Error")),
    ).rejects.toBe("Server Error");
  });

  it("signs out on 401 anywhere", async () => {
    at("/projects");
    await expect(
      handleResponse(response(401, '{"message":"Unauthorized"}')),
    ).rejects.toBe("Unauthorized");
    expect(usersService.logout).toHaveBeenCalledTimes(1);
  });

  it("gives the login page the message of a wrong password, which answers 401 too", async () => {
    at("/login");
    await expect(
      handleResponse(response(401, '{"message":"Wrong password"}')),
    ).rejects.toBe("Wrong password");
    expect(usersService.logout).toHaveBeenCalledTimes(1);
  });

  it("keeps the person signed in on 403: no access to a project is not a lost session", async () => {
    at("/projects");
    await expect(
      handleResponse(response(403, '{"message":"Forbidden"}')),
    ).rejects.toBe("Forbidden");
    expect(usersService.logout).not.toHaveBeenCalled();
  });
});

describe("authHeader", () => {
  afterEach(() => localStorage.clear());

  it("sends the token of whoever signed in last", () => {
    localStorage.setItem("user", JSON.stringify({ token: "first" }));
    expect(authHeader()).toEqual({ Authorization: "Bearer first" });
    // read fresh on every call: a new sign-in in the same tab takes effect at once
    localStorage.setItem("user", JSON.stringify({ token: "second" }));
    expect(authHeader()).toEqual({ Authorization: "Bearer second" });
  });

  it.each([
    ["nobody signed in", null],
    ["a stored user without a token", JSON.stringify({ email: "a@b.c" })],
    ["an empty token", JSON.stringify({ token: "" })],
  ])("sends no Authorization for %s", (_case, stored) => {
    if (stored !== null) localStorage.setItem("user", stored);
    expect(storedToken()).toBeUndefined();
    expect(authHeader()).not.toHaveProperty("Authorization");
  });
});
