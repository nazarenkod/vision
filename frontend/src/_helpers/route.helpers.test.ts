import { buildTestRunLocation, getQueryParams } from "./route.helpers";

describe("build address", () => {
  it("keeps the build tab in the address", () => {
    expect(
      buildTestRunLocation("b", undefined, { tab: "changes" }).search,
    ).toBe("buildId=b&tab=changes");
    // Overview is what a build opens on, so the address does not name it
    expect(
      buildTestRunLocation("b", undefined, { tab: "overview" }).search,
    ).toBe("buildId=b");
    expect(getQueryParams("?buildId=b").tab).toBe("overview");
    expect(getQueryParams("?buildId=b&tab=all").tab).toBe("all");
    expect(getQueryParams("?buildId=b&tab=nonsense").tab).toBe("overview");
  });

  it("keeps build, run and queue in the address", () => {
    const { search } = buildTestRunLocation("b", "r1", {
      tab: "all",
      queue: "device:iPhone 15|iOS 17||",
    });
    expect(search).toBe(
      "buildId=b&tab=all&queue=device%3AiPhone+15%7CiOS+17%7C%7C&testId=r1",
    );
    expect(getQueryParams(`?${search}`)).toEqual({
      buildId: "b",
      testId: "r1",
      tab: "all",
      queue: "device:iPhone 15|iOS 17||",
      status: undefined,
      issue: undefined,
    });
    // closing the review drops the queue and keeps the tab
    expect(
      buildTestRunLocation("b", undefined, { tab: "all", queue: "all" }).search,
    ).toBe("buildId=b&tab=all");
  });

  it("opens a run with the accessibility problem chosen on the Accessibility tab", () => {
    const { search } = buildTestRunLocation("b", "r1", {
      tab: "a11y",
      issue: "touch-target|id:tailBadge",
    });
    expect(search).toBe(
      "buildId=b&tab=a11y&issue=touch-target%7Cid%3AtailBadge&testId=r1",
    );
    expect(getQueryParams(`?${search}`).issue).toBe(
      "touch-target|id:tailBadge",
    );
    // the problem belongs to the run: closing the review drops it
    expect(
      buildTestRunLocation("b", undefined, { tab: "a11y", issue: "x" }).search,
    ).toBe("buildId=b&tab=a11y");
  });
});
