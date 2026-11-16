import { insightsService } from "./insights.service";

jest.mock("../_config/env.config", () => ({ API_URL: "http://api" }));

describe("insights service", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("reads an empty answer as no report, so the review does not crash", async () => {
    // what the API sends for a report file that is gone: 200 and no body
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      }),
    ) as unknown as typeof fetch;
    await expect(insightsService.getA11y("run")).resolves.toBeNull();
    await expect(insightsService.getStructure("run")).resolves.toBeNull();
  });
});
