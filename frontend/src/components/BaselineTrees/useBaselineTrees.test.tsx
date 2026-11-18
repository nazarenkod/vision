import { act, renderHook, waitFor } from "@testing-library/react";
import { useBaselineTrees } from "./useBaselineTrees";
import { testVariationService } from "../../services";
import { Baseline } from "../../types/baseline";

jest.mock("../../services", () => ({
  testVariationService: { getBaselineUiTree: jest.fn() },
}));

const getTree = testVariationService.getBaselineUiTree as jest.Mock;
const tree = {
  format: "appium-android",
  positioned: true,
  width: 1,
  height: 1,
  nodes: [],
};

const version = (
  id: string,
  uiTreeName: string | null = `${id}.json.gz`,
): Baseline => ({
  id,
  baselineName: `${id}.png`,
  testVariationId: "v1",
  createdAt: "2026-11-18T10:00:00Z",
  updatedAt: "2026-11-18T10:00:00Z",
  uiTreeName,
});

describe("useBaselineTrees (081)", () => {
  beforeEach(() => getTree.mockReset());

  it("loads the trees only once they are wanted", async () => {
    getTree.mockResolvedValue(tree);
    const { result, rerender } = renderHook(
      ({ wanted }) =>
        useBaselineTrees("v1", version("b2"), version("b1"), wanted),
      { initialProps: { wanted: false } },
    );
    expect(getTree).not.toHaveBeenCalled();
    expect(result.current.selected.status).toBe("idle");

    rerender({ wanted: true });
    await waitFor(() => expect(result.current.previous.status).toBe("ready"));
    expect(getTree).toHaveBeenCalledWith("v1", "b2");
    expect(getTree).toHaveBeenCalledWith("v1", "b1");
  });

  it("asks nothing for a version accepted without a tree", async () => {
    getTree.mockResolvedValue(tree);
    const { result } = renderHook(() =>
      useBaselineTrees("v1", version("b2"), version("b1", null), true),
    );
    await waitFor(() => expect(result.current.selected.status).toBe("ready"));
    expect(result.current.previous).toEqual({ status: "ready", tree: null });
    expect(getTree).toHaveBeenCalledTimes(1);
  });

  it("asks again for the failed tree only", async () => {
    getTree.mockImplementation((_, id) =>
      id === "b1" ? Promise.reject("down") : Promise.resolve(tree),
    );
    const { result } = renderHook(() =>
      useBaselineTrees("v1", version("b2"), version("b1"), true),
    );
    await waitFor(() => expect(result.current.previous.status).toBe("error"));
    expect(result.current.selected.status).toBe("ready");

    getTree.mockClear();
    getTree.mockResolvedValue(tree);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.previous.status).toBe("ready"));
    expect(getTree).toHaveBeenCalledTimes(1);
    expect(getTree).toHaveBeenCalledWith("v1", "b1");
  });
});
