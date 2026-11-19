import { testRunReducer } from "./testRun.context";
import { buildReducer } from "./build.context";
import { run } from "../_helpers/testRun.fixture";
import { Build } from "../types";

jest.mock("../_config/env.config", () => ({ API_URL: "http://api" }));

/*
 * The screen lists change from two sides: a fetch and live socket events that may repeat what
 * the fetch already brought. Transitions of the list state, with the reference checks that
 * keep a grid of thousands of runs from re-rendering on events about other runs.
 */
type RunState = Parameters<typeof testRunReducer>[0];
const runs = (state: RunState) => state.testRuns.map((t) => t.id);
const loaded = (ids: string[], extra: Partial<RunState> = {}): RunState => ({
  testRuns: ids.map((id) => run({ id })),
  touched: false,
  loading: false,
  ...extra,
});

describe("screens of a build", () => {
  it("shows the loading state from request until the answer or a failure", () => {
    const requested = testRunReducer(loaded(["a"]), { type: "request" });
    expect(requested).toMatchObject({ loading: true, testRuns: [] });

    expect(
      testRunReducer(requested, { type: "get", payload: [run({ id: "b" })] }),
    ).toMatchObject({ loading: false });
    // a failed fetch must end loading too, or the progress bar stays forever
    expect(
      testRunReducer(requested, { type: "failure" } as never),
    ).toMatchObject({ loading: false });
  });

  it("adds a live screen once, even when the fetch already brought it", () => {
    const state = loaded(["a"]);

    const next = testRunReducer(state, {
      type: "add",
      payload: [run({ id: "a" }), run({ id: "b" })],
    });

    expect(runs(next)).toEqual(["a", "b"]);
  });

  it("keeps the same state when a live add brings nothing new", () => {
    const state = loaded(["a"]);
    expect(
      testRunReducer(state, { type: "add", payload: [run({ id: "a" })] }),
    ).toBe(state);
  });

  it("replaces updated screens in place and keeps the order", () => {
    const state = loaded(["a", "b", "c"]);

    const next = testRunReducer(state, {
      type: "update",
      payload: [run({ id: "b", diffPercent: 42 })],
    });

    expect(runs(next)).toEqual(["a", "b", "c"]);
    expect(next.testRuns[1].diffPercent).toBe(42);
    expect(next.testRuns[0]).toBe(state.testRuns[0]);
  });

  it("updates the open screen even when it is outside the loaded list", () => {
    // the open comparison can come from a link while the list shows another filter
    const state = loaded(["a"], { selectedTestRun: run({ id: "z" }) });

    const next = testRunReducer(state, {
      type: "update",
      payload: [run({ id: "z", diffPercent: 7 })],
    });

    expect(next.selectedTestRun?.diffPercent).toBe(7);
    expect(runs(next)).toEqual(["a"]);
  });

  it("keeps the same state when an update is about screens not on the page", () => {
    const state = loaded(["a"], { selectedTestRun: run({ id: "a" }) });
    expect(
      testRunReducer(state, { type: "update", payload: [run({ id: "x" })] }),
    ).toBe(state);
  });

  it("removes deleted screens and ignores ids it does not have", () => {
    const next = testRunReducer(loaded(["a", "b", "c"]), {
      type: "delete",
      payload: ["b", "nope"],
    });
    expect(runs(next)).toEqual(["a", "c"]);
  });

  it("keeps the same order array when the grid republishes the same order", () => {
    const state = loaded(["a"], { filteredSortedTestRunIds: ["a", "b"] });

    expect(
      testRunReducer(state, { type: "filterSort", payload: ["a", "b"] }),
    ).toBe(state);
    // boundaries of "same": another order, a shorter one, none at all
    expect(
      testRunReducer(state, { type: "filterSort", payload: ["b", "a"] })
        .filteredSortedTestRunIds,
    ).toEqual(["b", "a"]);
    expect(
      testRunReducer(state, { type: "filterSort", payload: ["a"] })
        .filteredSortedTestRunIds,
    ).toEqual(["a"]);
    expect(
      testRunReducer(state, { type: "filterSort", payload: undefined } as never)
        .filteredSortedTestRunIds,
    ).toBeUndefined();
  });

  it("forgets unsaved changes when another screen opens", () => {
    const state = loaded(["a"], { touched: true });
    expect(
      testRunReducer(state, { type: "select", payload: run({ id: "b" }) }),
    ).toMatchObject({ touched: false, selectedTestRun: { id: "b" } });
  });
});

type BuildState = Parameters<typeof buildReducer>[0];
const build = (id: string, extra: Partial<Build> = {}) =>
  ({ id, number: 1, projectId: "p", ...extra }) as Build;
const builds = (state: BuildState) => state.buildList.map((b) => b.id);
const page = (ids: string[], extra: Partial<BuildState> = {}): BuildState =>
  ({
    buildList: ids.map((id) => build(id)),
    take: 10,
    skip: 0,
    total: ids.length,
    loading: false,
    ...extra,
  }) as BuildState;

describe("builds of a project", () => {
  it("keeps the builds on screen while refetching, and clears them on reset", () => {
    // a refetch must not flash skeletons; a project switch must not show the old project's builds
    const state = page(["b1"], { error: "old" } as Partial<BuildState>);

    expect(builds(buildReducer(state, { type: "request" }))).toEqual(["b1"]);
    expect(buildReducer(state, { type: "request" })).toMatchObject({
      loading: true,
      error: undefined,
    });
    expect(buildReducer(state, { type: "reset" } as never)).toMatchObject({
      buildList: [],
      total: 0,
      loading: true,
    });
  });

  it("puts a new live build first", () => {
    const next = buildReducer(page(["b1"]), {
      type: "add",
      payload: build("b2"),
    });
    expect(builds(next)).toEqual(["b2", "b1"]);
  });

  it("updates listed builds and the open one", () => {
    const state = page(["b1", "b2"], { selectedBuild: build("b2") });

    const next = buildReducer(state, {
      type: "update",
      payload: [build("b2", { number: 9 })],
    });

    expect(next.buildList[1].number).toBe(9);
    expect(next.selectedBuild?.number).toBe(9);
    expect(next.buildList[0]).toBe(state.buildList[0]);
  });

  it("keeps the open build when an update is about others", () => {
    const open = build("b1");
    const next = buildReducer(page(["b1"], { selectedBuild: open }), {
      type: "update",
      payload: [build("b3")],
    });
    expect(next.selectedBuild).toBe(open);
  });

  it("ends loading with the error of a failed fetch", () => {
    expect(
      buildReducer(page([], { loading: true }), {
        type: "failure",
        payload: "offline",
      } as never),
    ).toMatchObject({ loading: false, error: "offline" });
  });
});
