import { act, renderHook } from "@testing-library/react";
import { useBuildOverview } from ".";
import { buildOverviewService } from "../../services";
import { useTestRunState } from "../../contexts";
import { run } from "../../_helpers/testRun.fixture";
import { TestStatus } from "../../types/testStatus";

jest.mock("../../contexts", () => ({ useTestRunState: jest.fn() }));
jest.mock("../../services", () => ({
  buildOverviewService: { get: jest.fn() },
}));

const runs = (status: TestStatus) => [
  run({ id: "a", buildId: "b128", status }),
  run({ id: "other-build", buildId: "b127" }),
];

describe("useBuildOverview", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (buildOverviewService.get as jest.Mock).mockResolvedValue({
      verdict: "waiting",
    });
  });
  afterEach(() => jest.useRealTimers());

  it("updates the numbers when a run of the build changes", async () => {
    const state = useTestRunState as jest.Mock;
    state.mockReturnValue({ testRuns: runs(TestStatus.unresolved) });
    const { rerender } = renderHook(() => useBuildOverview("b128"));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(buildOverviewService.get).toHaveBeenCalledTimes(1);

    // a run of another build changing is not this build's news
    state.mockReturnValue({
      testRuns: [
        runs(TestStatus.unresolved)[0],
        run({ id: "other-build", buildId: "b127", status: TestStatus.failed }),
      ],
    });
    rerender();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(buildOverviewService.get).toHaveBeenCalledTimes(1);

    state.mockReturnValue({ testRuns: runs(TestStatus.approved) });
    rerender();
    await act(async () => {
      jest.advanceTimersByTime(399);
    });
    expect(buildOverviewService.get).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    // asked again 400 ms after the change: well inside the 2 s of REQ-031-13
    expect(buildOverviewService.get).toHaveBeenCalledTimes(2);
  });
});
