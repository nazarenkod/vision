import {
  countBySelector,
  elementAt,
  ruleFor,
  stepDown,
  stepUp,
  toggleSelection,
} from "./elementPicking.helper";
import { PickableElement } from "../types/insights";

const card: PickableElement = {
  index: 1,
  parent: null,
  selector: "id:card",
  element: "Balance card",
  bounds: { x: 0, y: 0, width: 300, height: 120 },
};
const amount: PickableElement = {
  index: 2,
  parent: 1,
  selector: "id:amount",
  element: "Balance amount",
  bounds: { x: 16, y: 30, width: 160, height: 36 },
};
const row = (i: number): PickableElement => ({
  index: 10 + i,
  parent: null,
  selector: "id:row",
  element: `Row ${i}`,
  bounds: { x: 0, y: 200 + i * 50, width: 300, height: 50 },
});
const elements = [card, amount, row(0), row(1), row(2)];

describe("elementPicking", () => {
  it("picks the smallest element under the pointer on either screenshot", () => {
    expect(elementAt({ x: 20, y: 40 }, elements)).toBe(amount);
    expect(elementAt({ x: 250, y: 100 }, elements)).toBe(card);
    expect(elementAt({ x: 250, y: 900 }, elements)).toBeUndefined();
    expect(elementAt(null, elements)).toBeUndefined();
    // the baseline has its own elements, picked the same way
    const moved = { ...amount, bounds: { ...amount.bounds, y: 80 } };
    expect(elementAt({ x: 20, y: 90 }, [card, moved])).toBe(moved);
  });

  it("steps to the parent and back", () => {
    const up = stepUp({ element: amount, trail: [] }, elements);
    expect(up?.element).toBe(card);
    // the card has no pickable parent
    expect(stepUp(up!, elements)).toBeNull();
    expect(stepDown(up!)?.element).toBe(amount);
    expect(stepDown({ element: amount, trail: [] })).toBeNull();
  });

  it("adds elements to the selection with Shift", () => {
    let selected = toggleSelection([], amount, false);
    selected = toggleSelection(selected, row(1), true);
    expect(selected).toEqual([amount, row(1)]);
    // Shift on a selected one takes it back out
    expect(toggleSelection(selected, amount, true)).toEqual([row(1)]);
    // a plain click starts over
    expect(toggleSelection(selected, card, false)).toEqual([card]);
  });

  it("counts what a selector takes on the screenshot", () => {
    expect(countBySelector("id:row", elements)).toBe(3);
    expect(countBySelector("id:card", elements)).toBe(1);
  });

  it("finds the rule an element is already under", () => {
    const rule = {
      id: "r",
      selector: "text:/\\d+/",
      action: "ignore" as const,
      scope: "screen" as const,
      matches: 1,
      found: { current: [amount.bounds], baseline: [] },
    };
    expect(ruleFor(amount, [rule], "current")).toBe(rule);
    expect(ruleFor(amount, [rule], "baseline")).toBeUndefined();
    expect(ruleFor(card, [rule], "current")).toBeUndefined();
  });
});
