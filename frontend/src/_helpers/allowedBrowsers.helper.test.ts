import {
  allowedBrowsersOf,
  browserAllowed,
  invalidAllowedBrowser,
  normalizeViewport,
  sameBrowser,
  savedBrowser,
} from "./allowedBrowsers.helper";

const allowed = [
  { browser: "Chrome", version: "131.*", viewport: "1280x720" },
  { browser: "Firefox", version: "", viewport: "" },
];

describe("allowed browsers", () => {
  it("reads browser, version and window size entries", () => {
    expect(
      allowedBrowsersOf(
        JSON.stringify({
          allowedBrowsers: [
            ...allowed,
            // no version or size: any
            { browser: "Safari" },
            { version: "131" },
            { browser: "Edge", version: 131 },
          ],
        }),
      ),
    ).toEqual([...allowed, { browser: "Safari", version: "", viewport: "" }]);
    expect(allowedBrowsersOf(null)).toEqual([]);
    expect(allowedBrowsersOf("not json")).toEqual([]);
    expect(
      allowedBrowsersOf(JSON.stringify({ allowedBrowsers: "Chrome" })),
    ).toEqual([]);
  });

  it("needs a browser and takes * only as a trailing .* of the version", () => {
    for (const entry of allowed)
      expect(invalidAllowedBrowser(entry)).toBeNull();
    expect(
      invalidAllowedBrowser({ browser: " ", version: "131", viewport: "" }),
    ).toBe("missing");
    for (const entry of [
      { browser: "Chrome*", version: "", viewport: "" },
      { browser: "Chrome", version: "*", viewport: "" },
      { browser: "Chrome", version: ".*", viewport: "" },
      { browser: "Chrome", version: "13*.1", viewport: "" },
      { browser: "Chrome", version: "", viewport: "1280x*" },
    ]) {
      expect(invalidAllowedBrowser(entry)).toBe("wildcard");
    }
  });

  it("takes a window size as width x height, with x or ×", () => {
    for (const viewport of ["1280x720", "1280×720", "1280 × 720", "1280X720"]) {
      expect(
        invalidAllowedBrowser({ browser: "Chrome", version: "", viewport }),
      ).toBeNull();
      expect(normalizeViewport(viewport)).toBe("1280x720");
    }
    expect(
      invalidAllowedBrowser({
        browser: "Chrome",
        version: "",
        viewport: "wide",
      }),
    ).toBe("viewport");
    expect(
      savedBrowser({
        browser: " Chrome ",
        version: " 131 ",
        viewport: "1280 × 720",
      }),
    ).toEqual({ browser: "Chrome", version: "131", viewport: "1280x720" });
  });

  it("treats an empty version or window size as any", () => {
    expect(browserAllowed(allowed, "firefox", "133.0", "1920x1080")).toBe(true);
    expect(browserAllowed(allowed, "chrome", "131.0.6778", "1280×720")).toBe(
      true,
    );
    expect(browserAllowed(allowed, "Chrome", "132.0", "1280x720")).toBe(false);
    expect(browserAllowed(allowed, "Chrome", "131.0", "1920x1080")).toBe(false);
    expect(browserAllowed(allowed, "Safari", "18", "")).toBe(false);
  });

  it("tells the same entry apart from case, spaces and ×", () => {
    expect(
      sameBrowser(allowed[0], {
        browser: " chrome",
        version: "131.*",
        viewport: "1280 × 720",
      }),
    ).toBe(true);
    expect(sameBrowser(allowed[0], allowed[1])).toBe(false);
  });
});
