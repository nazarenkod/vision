import {
  baselineTreesLocation,
  counterpart,
  historyLocation,
  pairCard,
  pairOutlines,
  readHistoryPlace,
} from "./baselineTrees.helper";
import { InspectorNode } from "../types/insights";

const node = (
  index: number,
  key: string,
  attributes: Array<[string, string]>,
  extra: Partial<InspectorNode> = {},
): InspectorNode => ({
  index,
  parent: index ? 0 : null,
  key,
  className: "android.widget.TextView",
  name: "TextView",
  id: "",
  text: "",
  attributes,
  bounds: { x: 10, y: 20, width: 100, height: 40 },
  clickable: false,
  wrapper: false,
  ...extra,
});

describe("baseline history trees (079)", () => {
  const selected = [
    node(0, "root", []),
    node(1, "title", [
      ["text", "Change your PIN"],
      ["content-desc", ""],
    ]),
    node(2, "button", [["text", "Change PIN"]]),
  ];
  const previous = [
    node(0, "root", []),
    node(1, "title", [
      ["text", "Declined"],
      ["content-desc", ""],
      ["hint", "old"],
    ]),
  ];

  it("finds the same element in the other version by its key", () => {
    expect(counterpart(previous, "title")?.index).toBe(1);
    expect(counterpart(previous, "button")).toBeUndefined();
    expect(counterpart(previous, undefined)).toBeUndefined();
    expect(counterpart(undefined, "title")).toBeUndefined();
  });

  it("lays the attributes of both versions side by side with a dash for empty", () => {
    expect(pairCard(selected[1], previous[1])).toEqual([
      { name: "text", selected: "Change your PIN", previous: "Declined" },
      { name: "content-desc", selected: "—", previous: "—" },
      { name: "hint", selected: "—", previous: "old" },
    ]);
    // an element only one version has: the other column is empty, not a dash
    expect(pairCard(selected[2], undefined)).toEqual([
      { name: "text", selected: "Change PIN", previous: null },
    ]);
  });

  it("outlines the chosen element solid and the pointed one dashed where the version has them", () => {
    expect(
      pairOutlines(previous, "title", "root").map((o) => [o.id, o.dashed]),
    ).toEqual([
      ["pair:pointed", true],
      ["pair:chosen", false],
    ]);
    expect(pairOutlines(previous, "button", undefined)).toEqual([]);
    expect(pairOutlines(selected, "title", "title").map((o) => o.id)).toEqual([
      "pair:chosen",
    ]);
  });

  it("keeps the version and the element in the full screen address", () => {
    const place = { baseline: "b2", view: "tree" as const, node: "a/b c" };
    const full = baselineTreesLocation("v1", place);
    expect(full).toBe("/variations/details/v1/trees?baseline=b2&node=a%2Fb+c");
    expect(readHistoryPlace(full.split("?")[1])).toEqual({
      baseline: "b2",
      view: "screens",
      node: "a/b c",
    });
    const back = historyLocation("v1", place);
    expect(back).toBe(
      "/variations/details/v1?baseline=b2&view=tree&node=a%2Fb+c",
    );
    expect(readHistoryPlace(back.split("?")[1])).toEqual(place);
  });

  it("opens on the screenshots when the address names no view", () => {
    expect(readHistoryPlace("")).toEqual({ view: "screens" });
    expect(historyLocation("v1", { view: "screens" })).toBe(
      "/variations/details/v1",
    );
  });
});
