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
import { LanguageProvider } from "../../i18n";
import { STORAGE_KEY } from "../../i18n/translate";

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
  clickable: false,
  wrapper: false,
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

// 0 Application ─ 1 Other ─ 2 Other ─┬ 3 StaticText "Кредити" (resized)
//                                    ├ 4 Button #scan#PbButton (a11y)
//                                    └ 5 Image
const deep: InspectorTree = {
  ...current,
  nodes: [
    node(0, null, "Application", { text: "Bank" }),
    node(1, 0, "Other", { wrapper: true }),
    node(2, 1, "Other", { wrapper: true }),
    node(3, 2, "StaticText", {
      key: "k3",
      text: "Кредити\nВкладка 2 з 5",
      selector: "text:Кредити",
      attributes: [
        ["label", "Кредити"],
        ["value", ""],
      ],
    }),
    node(4, 2, "Button", {
      key: "k4",
      id: "scan#PbButton",
      clickable: true,
      selector: "id:scan#PbButton",
    }),
    node(5, 2, "Image", {}),
  ],
};
const deepStructure = {
  changes: [
    {
      kind: "resized" as const,
      key: "k3",
      element: "StaticText",
      resourceId: "",
      bounds: { x: 0, y: 0, width: 1, height: 1 },
    },
  ],
  invisible: [],
} as unknown as React.ComponentProps<typeof ElementsTab>["structure"];
const deepReport = {
  violations: [{ id: "v", nodeKey: "k4", title: "Small", message: "38 dp" }],
} as unknown as React.ComponentProps<typeof ElementsTab>["report"];

const rowsShown = () =>
  screen.getAllByTestId("treeRow").map((row) => row.dataset.index);
const rowOf = (index: number) =>
  screen
    .getAllByTestId("treeRow")
    .find((row) => row.dataset.index === String(index)) as HTMLElement;

function deepTab(
  props: Partial<React.ComponentProps<typeof ElementsTab>> = {},
) {
  return tab({
    trees: ready(deep, null),
    structure: deepStructure,
    report: deepReport,
    ...props,
  });
}

describe("ElementsTab: a readable tree (063)", () => {
  beforeEach(() => {
    getLocators.mockReset();
    getLocators.mockResolvedValue({ vision: [], test: [] });
    window.localStorage.clear();
  });

  it("shows wrappers when asked, hidden by default", () => {
    deepTab();
    expect(rowsShown()).toEqual(["0", "3", "4", "5"]);
    fireEvent.click(
      screen.getByTestId("treeWrappers").querySelector("input") as HTMLElement,
    );
    expect(rowsShown()).toEqual(["0", "1", "2", "3", "4", "5"]);
  });

  it("keeps rows free of hidden-wrapper counts and accessibility marks", () => {
    deepTab();
    expect(screen.queryByTestId("treeSkipped")).toBeNull();
    expect(rowOf(3).textContent).not.toContain("+2");
    expect(rowOf(4).textContent).not.toContain("a11y");
  });

  it("shows a line break as ↵, the component apart and each kind's icon", () => {
    deepTab();
    expect(rowOf(3).textContent).toContain("“Кредити ↵ Вкладка 2 з 5”");
    expect(within(rowOf(4)).getByTestId("treeComponent").textContent).toBe(
      "PbButton",
    );
    expect(rowOf(4).textContent).toContain("#scan");
    const kinds = [3, 4, 5].map((i) =>
      rowOf(i).querySelector("[data-kind]")?.getAttribute("data-kind"),
    );
    expect(kinds).toEqual(["text", "button", "image"]);
  });

  it("counts the children of a folded node", () => {
    deepTab();
    fireEvent.click(screen.getByTestId("treeCollapseAll"));
    expect(rowsShown()).toEqual(["0"]);
    expect(rowOf(0).textContent).toContain("3");
    fireEvent.click(screen.getByTestId("treeExpandAll"));
    expect(rowsShown()).toEqual(["0", "3", "4", "5"]);
  });

  it("marks search matches and steps through them with Enter", () => {
    const { onChoose } = deepTab();
    const search = screen.getByTestId("treeSearch");
    fireEvent.change(search, { target: { value: "кред" } });
    expect(rowOf(3).querySelector("mark")?.textContent).toBe("Кред");
    expect(screen.getByTestId("treeHits").textContent).toBe("1 of 1");
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChoose).toHaveBeenLastCalledWith(3);
  });

  it("clears the search with Esc without closing the comparison", () => {
    const outside = jest.fn();
    deepTab();
    document.addEventListener("keydown", outside);
    const search = screen.getByTestId("treeSearch");
    fireEvent.change(search, { target: { value: "scan" } });
    fireEvent.keyDown(search, { key: "Escape" });
    expect((search as HTMLInputElement).value).toBe("");
    expect(outside).not.toHaveBeenCalled();
    document.removeEventListener("keydown", outside);
  });

  it("filters by a chip with its count", () => {
    deepTab();
    const changed = screen.getByTestId("treeChip-changed");
    expect(changed.textContent).toContain("1");
    fireEvent.click(changed);
    expect(rowsShown()).toEqual(["0", "3"]);
    fireEvent.click(screen.getByTestId("treeChip-clickable"));
    expect(rowsShown()).toEqual(["0", "4"]);
  });

  it("goes to the next change with N and with the button", () => {
    const { onChoose } = deepTab({ chosen: 3 });
    fireEvent.keyDown(screen.getByTestId("tree"), { key: "n" });
    expect(onChoose).toHaveBeenLastCalledWith(4);
    fireEvent.click(screen.getByTestId("treeNextChange"));
    expect(onChoose).toHaveBeenLastCalledWith(4);
  });

  it("copies the rule's selector from the row and with C", () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    deepTab({ chosen: 4 });
    fireEvent.click(within(rowOf(3)).getByTestId("rowCopy"));
    expect(writeText).toHaveBeenLastCalledWith("text:Кредити");
    fireEvent.keyDown(screen.getByTestId("tree"), { key: "c" });
    expect(writeText).toHaveBeenLastCalledWith("id:scan#PbButton");
  });

  it("answers / and * in the tree", () => {
    deepTab({ chosen: 0 });
    fireEvent.click(screen.getByTestId("treeCollapseAll"));
    fireEvent.keyDown(screen.getByTestId("tree"), { key: "*" });
    expect(rowsShown()).toEqual(["0", "3", "4", "5"]);
    fireEvent.keyDown(screen.getByTestId("tree"), { key: "/" });
    expect(document.activeElement).toBe(screen.getByTestId("treeSearch"));
  });

  it("keeps the tree height it is given", () => {
    const { unmount } = deepTab();
    const handle = screen.getByTestId("treeResize");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(handle.getAttribute("aria-valuenow")).toBe("384");
    unmount();
    deepTab();
    expect(screen.getByTestId("treeResize").getAttribute("aria-valuenow")).toBe(
      "384",
    );
  });

  it("hides empty attributes until asked", async () => {
    deepTab({ chosen: 3 });
    const attributes = await screen.findByTestId("nodeAttributes");
    expect(attributes.textContent).not.toContain("value");
    fireEvent.click(
      screen
        .getByTestId("treeOnlyFilled")
        .querySelector("input") as HTMLElement,
    );
    expect(screen.getByTestId("nodeAttributes").textContent).toContain("value");
  });

  it("shows the wrappers when a link names one", () => {
    deepTab({ chosen: 1 });
    expect(rowsShown()).toContain("1");
  });
});

describe("ElementsTab: accessibility findings", () => {
  afterEach(() => window.localStorage.removeItem(STORAGE_KEY));

  it("shows an element's finding in the interface language", () => {
    window.localStorage.setItem(STORAGE_KEY, "uk");
    getLocators.mockResolvedValue({ vision: [], test: [] });
    render(
      <LanguageProvider>
        <ElementsTab
          hasTree
          testRunId="r1"
          trees={ready(deep, null)}
          structure={undefined}
          report={
            {
              violations: [
                {
                  id: "v",
                  rule: "duplicate-label",
                  nodeKey: "k4",
                  title: "Same label on several controls",
                  message:
                    '2 controls are announced as "історія"; users cannot tell them apart.',
                },
              ],
            } as unknown as React.ComponentProps<typeof ElementsTab>["report"]
          }
          side="current"
          chosen={4}
          onSideChange={jest.fn()}
          onChoose={jest.fn()}
          onPoint={jest.fn()}
        />
      </LanguageProvider>,
    );
    const text = document.body.textContent ?? "";
    expect(text).toContain("Однаковий підпис у кількох елементів");
    expect(text).toContain("озвучуються як «історія»");
    expect(text).not.toContain("users cannot tell them apart");
  });
});
