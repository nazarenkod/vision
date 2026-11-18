import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { BaselineTreePair } from "./BaselineTreePair";
import { PairTrees } from "./useBaselineTrees";
import { Baseline } from "../../types/baseline";
import { InspectorNode, InspectorTree } from "../../types/insights";

jest.mock("../../services", () => ({
  insightsService: { getLocators: jest.fn() },
  staticService: { getImage: (name: string) => `/img/${name}` },
}));

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

const tree = (nodes: InspectorNode[]): InspectorTree => ({
  format: "appium-android",
  positioned: true,
  width: 1080,
  height: 2400,
  nodes,
});

const title = (text: string) =>
  node(1, 0, "TextView", {
    key: "id:title",
    id: "title",
    text,
    attributes: [
      ["class", "android.widget.TextView"],
      ["text", text],
    ],
    bounds: { x: 100, y: 700, width: 800, height: 100 },
  });

const selectedTree = tree([
  node(0, null, "FrameLayout"),
  title("Change your PIN"),
  node(2, 0, "Button", {
    key: "id:pin",
    id: "pin",
    text: "Change PIN",
    bounds: { x: 100, y: 900, width: 300, height: 90 },
  }),
  node(3, 0, "View", { key: "id:ghost", bounds: null, hidden: "invisible" }),
]);
const previousTree = tree([node(0, null, "FrameLayout"), title("Declined")]);

const version = (id: string, createdAt: string): Baseline => ({
  id,
  baselineName: `${id}.png`,
  testVariationId: "v1",
  createdAt,
  updatedAt: createdAt,
  uiTreeName: `${id}.json.gz`,
});
const selected = version("b2", "2026-11-18T10:42:00Z");
const previous = version("b1", "2026-11-04T16:05:00Z");

const trees = (over: Partial<PairTrees> = {}): PairTrees => ({
  selected: { status: "ready", tree: selectedTree },
  previous: { status: "ready", tree: previousTree },
  retry: jest.fn(),
  ...over,
});

function pair(
  props: Partial<React.ComponentProps<typeof BaselineTreePair>> = {},
) {
  const onChoose = jest.fn();
  const view = render(
    <BaselineTreePair
      selected={selected}
      previous={previous}
      trees={trees()}
      onChoose={onChoose}
      {...props}
    />,
  );
  // the screenshots know their size once loaded: only then the outlines are drawn
  screen.getAllByRole("img").forEach((img) => {
    Object.defineProperty(img, "naturalWidth", { value: 1080 });
    Object.defineProperty(img, "naturalHeight", { value: 2400 });
    fireEvent.load(img);
  });
  return { onChoose, ...view };
}

const versionBox = (side: "selected" | "previous") =>
  screen.getByTestId(`pairVersion-${side}`);
const rowIn = (side: "selected" | "previous", index: number) =>
  within(versionBox(side))
    .getAllByTestId("treeRow")
    .find((row) => row.dataset.index === String(index)) as HTMLElement;

describe("BaselineTreePair (081)", () => {
  it("explains a version without a tree and shows the other", () => {
    pair({ trees: trees({ previous: { status: "ready", tree: null } }) });
    expect(
      within(versionBox("previous")).getByTestId("treeNone"),
    ).toHaveTextContent("This version was accepted without a UI tree");
    expect(
      within(versionBox("selected")).getAllByTestId("treeRow").length,
    ).toBeGreaterThan(0);
  });

  it("offers Try again for the tree that failed only", () => {
    const retry = jest.fn();
    pair({ trees: trees({ previous: { status: "error" }, retry }) });
    expect(
      within(versionBox("selected")).queryByTestId("treeFailed"),
    ).toBeNull();
    const failed = within(versionBox("previous")).getByTestId("treeFailed");
    fireEvent.click(within(failed).getByRole("button"));
    expect(retry).toHaveBeenCalled();
  });

  it("shows one version and a one-column card for the first baseline", () => {
    pair({ previous: undefined, chosen: "id:title" });
    expect(screen.queryByTestId("pairVersion-previous")).toBeNull();
    expect(screen.getByTestId("pairCardHead-selected")).toBeInTheDocument();
    expect(screen.queryByTestId("pairCardHead-previous")).toBeNull();
  });

  it("outlines the pointed element on both screenshots", () => {
    pair();
    fireEvent.mouseEnter(rowIn("selected", 1));
    expect(
      within(screen.getByTestId("pairScreen-selected")).getByTestId(
        "outlinePointed",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("pairScreen-previous")).getByTestId(
        "outlinePointed",
      ),
    ).toBeInTheDocument();
    expect(rowIn("previous", 1)).toBeInTheDocument();
  });

  it("outlines the chosen element on every screenshot that has it", () => {
    const { onChoose } = pair({ chosen: "id:title" });
    expect(
      within(screen.getByTestId("pairScreen-selected")).getByTestId(
        "outlineChosen",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("pairScreen-previous")).getByTestId(
        "outlineChosen",
      ),
    ).toBeInTheDocument();
    expect(rowIn("previous", 1)).toHaveAttribute("aria-selected", "true");
    // a click in the other tree names the element by its key
    fireEvent.click(rowIn("previous", 0));
    expect(onChoose).toHaveBeenCalledWith("k0");
    const card = screen.getByTestId("pairCard");
    expect(card).toHaveTextContent("Change your PIN");
    expect(card).toHaveTextContent("Declined");
  });

  it("says Not in this version and chooses nothing there", () => {
    pair({ chosen: "id:pin" });
    expect(screen.getByTestId("pairCardAbsent-previous")).toHaveTextContent(
      "Not in this version",
    );
    expect(screen.queryByTestId("pairCardAbsent-selected")).toBeNull();
    expect(
      within(screen.getByTestId("pairScreen-previous")).queryByTestId(
        "outlineChosen",
      ),
    ).toBeNull();
    expect(
      within(versionBox("previous"))
        .getAllByTestId("treeRow")
        .some((row) => row.getAttribute("aria-selected") === "true"),
    ).toBe(false);
  });

  it("dims an element without a position and draws no outline", () => {
    pair({ chosen: "id:ghost" });
    expect(
      within(screen.getByTestId("pairScreen-selected")).queryByTestId(
        "outlineChosen",
      ),
    ).toBeNull();
    expect(screen.getByTestId("pairHidden-selected")).toBeInTheDocument();
  });
});
