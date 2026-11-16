import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ElementsTab } from "./ElementsTab";
import { InspectorTrees } from "./useInspectorTrees";
import { insightsService } from "../../services";
import { InspectorNode, InspectorTree } from "../../types/insights";

jest.mock("../../services", () => ({
  insightsService: { getLocators: jest.fn() },
}));

const getLocators = insightsService.getLocators as jest.Mock;

const node = (
  index: number,
  parent: number | null,
  name: string,
  extra: Partial<InspectorNode> = {},
): InspectorNode => ({
  index,
  parent,
  key: extra.key ?? `k${index}`,
  className: `android.widget.${name}`,
  name,
  id: "",
  text: "",
  attributes: [["class", `android.widget.${name}`]],
  bounds: { x: 0, y: 0, width: 1080, height: 2400 },
  ...extra,
});

const current: InspectorTree = {
  format: "appium-android",
  positioned: true,
  width: 1080,
  height: 2400,
  nodes: [
    node(0, null, "FrameLayout"),
    node(1, 0, "TextView", {
      key: "id:welcome",
      id: "welcome",
      text: "Welcome back",
      attributes: [
        ["class", "android.widget.TextView"],
        ["text", "Welcome back"],
      ],
      bounds: { x: 120, y: 700, width: 840, height: 100 },
    }),
    node(2, 0, "View", { bounds: null, hidden: "invisible" }),
  ],
};
const baseline: InspectorTree = {
  ...current,
  nodes: [
    node(0, null, "FrameLayout"),
    node(1, 0, "TextView", {
      key: "id:welcome",
      id: "welcome",
      text: "Hello again",
      attributes: [
        ["class", "android.widget.TextView"],
        ["text", "Hello again"],
      ],
    }),
  ],
};

const ready = (
  now: InspectorTree | null,
  was: InspectorTree | null = baseline,
): InspectorTrees => ({
  current: { status: "ready", tree: now },
  baseline: { status: "ready", tree: was },
  retry: jest.fn(),
});

function tab(props: Partial<React.ComponentProps<typeof ElementsTab>> = {}) {
  const onChoose = jest.fn();
  const onSideChange = jest.fn();
  const view = render(
    <ElementsTab
      hasTree
      testRunId="r1"
      trees={ready(current)}
      structure={undefined}
      report={undefined}
      side="current"
      onSideChange={onSideChange}
      onChoose={onChoose}
      onPoint={jest.fn()}
      {...props}
    />,
  );
  return { onChoose, onSideChange, ...view };
}

describe("ElementsTab (062)", () => {
  beforeEach(() => {
    getLocators.mockReset();
    getLocators.mockResolvedValue({
      vision: [{ kind: "id", value: "id:welcome", matches: 1 }],
      test: [
        { kind: "id", value: "com.shop:id/welcome", matches: 1 },
        { kind: "xpath", value: "//android.widget.TextView", matches: 3 },
      ],
    });
  });

  it("shows each node with its short class, id and text", () => {
    tab();
    const row = screen
      .getAllByTestId("treeRow")
      .find((item) => item.dataset.index === "1") as HTMLElement;
    expect(row.textContent).toContain("TextView");
    expect(row.textContent).toContain("#welcome");
    expect(row.textContent).toContain("“Welcome back”");
  });

  it("explains a check without a UI tree", () => {
    tab({ hasTree: false, trees: ready(null, null) });
    expect(screen.getByTestId("treeNone").textContent).toContain(
      "VisionOptions.uiTree",
    );
    expect(screen.queryByTestId("tree")).toBeNull();
  });

  it("shows that the tree is loading", () => {
    tab({
      trees: {
        current: { status: "loading" },
        baseline: { status: "loading" },
        retry: jest.fn(),
      },
    });
    expect(screen.getByTestId("treeLoading")).toBeTruthy();
  });

  it("offers Try again when the tree cannot be loaded", () => {
    const retry = jest.fn();
    tab({
      trees: {
        current: { status: "error" },
        baseline: { status: "idle" },
        retry,
      },
    });
    fireEvent.click(
      within(screen.getByTestId("treeFailed")).getByRole("button", {
        name: "Try again",
      }),
    );
    expect(retry).toHaveBeenCalled();
  });

  it("dims a node without a position and says why", async () => {
    tab({ chosen: 2 });
    expect((await screen.findByTestId("nodeHidden")).textContent).toMatch(
      /Not displayed/,
    );
  });

  it("warns that a tree without positions is not drawn on the screenshot", () => {
    tab({
      trees: ready({ ...current, format: "web", positioned: false }),
    });
    expect(screen.getByTestId("treeUnpositioned")).toBeTruthy();
  });

  it("switches to the baseline tree", () => {
    const { onSideChange } = tab();
    fireEvent.click(screen.getByTestId("treeBaseline"));
    expect(onSideChange).toHaveBeenCalledWith("baseline");
  });

  it("gives the baseline value beside the chosen node's attribute", async () => {
    tab({ chosen: 1 });
    const attributes = await screen.findByTestId("nodeAttributes");
    expect(attributes.textContent).toContain("baseline: Hello again");
  });

  it("copies a locator and says Copied", async () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    try {
      tab({ chosen: 1 });
      const tests = await screen.findByTestId("testLocators");
      // a locator that finds more than one says how many
      expect(tests.textContent).toContain("matches: 3");
      const [copy] = within(tests).getAllByTestId("copyLocator");
      fireEvent.click(copy);
      expect(writeText).toHaveBeenCalledWith("com.shop:id/welcome");
      expect(copy.textContent).toBe("Copied");
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(copy.textContent).toBe("Copy");
    } finally {
      jest.useRealTimers();
    }
  });

  it("offers the element actions to those who can edit", async () => {
    const onActions = jest.fn();
    tab({ chosen: 1, canActOn: () => true, onActions });
    fireEvent.click(await screen.findByTestId("nodeActions"));
    expect(onActions).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it("leaves the actions out for those who cannot edit", async () => {
    tab({ chosen: 1, onActions: jest.fn() });
    await screen.findByTestId("testLocators");
    expect(screen.queryByTestId("nodeActions")).toBeNull();
  });

  it("says the element from the link is not found", () => {
    tab({ notFound: true });
    expect(screen.getByTestId("treeNotFound")).toBeTruthy();
  });

  it("chooses a node with a click and steps with the arrow keys", async () => {
    const { onChoose } = tab({ chosen: 1 });
    fireEvent.click(
      screen
        .getAllByTestId("treeRow")
        .find((item) => item.dataset.index === "0") as HTMLElement,
    );
    expect(onChoose).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(screen.getByTestId("tree"), { key: "ArrowDown" });
    expect(onChoose).toHaveBeenLastCalledWith(2);
    await waitFor(() => expect(getLocators).toHaveBeenCalled());
  });
});
