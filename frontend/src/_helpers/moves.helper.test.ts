import { DICTIONARIES, Text } from "../i18n/dictionaries";
import { translate } from "../i18n/translate";
import type { MovedElement } from "../types";
import {
  moveMarkId,
  moveMarks,
  moveName,
  movedBy,
  shownMove,
} from "./moves.helper";

const form: MovedElement = {
  key: "path:0/1",
  element: "View",
  dxDp: 0,
  dyDp: 54,
  from: { x: 42, y: 290, width: 1324, height: 1530 },
  to: { x: 42, y: 479, width: 1324, height: 1530 },
  around: ["IBAN", "Сканер"],
};
const button: MovedElement = {
  key: "id/pay",
  element: 'Button "Pay" (id/pay)',
  dxDp: -8,
  dyDp: 0,
  from: { x: 0, y: 0, width: 10, height: 10 },
  to: { x: 0, y: 0, width: 10, height: 10 },
};
const options = { single: false, color: "#f79009" };

describe("moves on the screenshots (spec 079)", () => {
  it("outlines where the element was on the baseline, dashed and named was", () => {
    expect(moveMarks(form, "baseline", options)).toEqual([
      {
        id: "move:path:0/1:was",
        ...form.from,
        color: "#f79009",
        dashed: true,
        label: "was",
      },
    ]);
  });

  it("outlines where the element is now on the current screenshot with the move", () => {
    expect(moveMarks(form, "current", options)).toEqual([
      {
        id: "move:path:0/1:now",
        ...form.to,
        color: "#f79009",
        label: "↓ 54 dp",
      },
    ]);
    expect(moveMarks({ ...form, dxDp: 8 }, "current", options)[0].label).toBe(
      "↓ 54 dp, → 8 dp",
    );
  });

  it("draws both outlines on the one screenshot in overlay and fade views", () => {
    const marks = moveMarks(form, "current", { ...options, single: true });
    expect(marks.map((mark) => mark.id)).toEqual([
      "move:path:0/1:was",
      "move:path:0/1:now",
    ]);
    expect(marks[0]).toMatchObject({ ...form.from, dashed: true });
  });

  it("draws nothing for a move without its bounds", () => {
    expect(moveMarks({ ...form, from: undefined }, "current", options)).toEqual(
      [],
    );
  });

  it("shows the hovered move over the pinned one, and the pinned one after", () => {
    const moves = [form, button];
    const pinned = moveMarkId(form.key);
    expect(shownMove(moves, moveMarkId(button.key), pinned)).toBe(button);
    expect(shownMove(moves, undefined, pinned)).toBe(form);
    // something else under the pointer: that one is shown, not the pin
    expect(shownMove(moves, "rule:1", pinned)).toBeUndefined();
    expect(shownMove(moves, undefined, "testArea:0")).toBeUndefined();
  });
});

describe("moved element's row (spec 079)", () => {
  const uk: Text = (key, params) => translate(DICTIONARIES, "uk", key, params);

  it("names a nameless element by the texts inside it", () => {
    expect(moveName(form)).toBe('View · ancestor of "IBAN", "Сканер"');
    expect(moveName(form, uk)).toBe("View · навколо «IBAN», «Сканер»");
  });

  it("keeps the name of an element with an id or a text of its own", () => {
    expect(moveName(button, uk)).toBe('Button "Pay" (id/pay)');
    expect(moveName({ ...form, around: undefined })).toBe("View");
  });

  it("says how far it moved, each axis once", () => {
    expect(movedBy(form, uk)).toBe("вниз на 54 dp");
    expect(movedBy({ ...form, dxDp: -8, dyDp: -3 })).toBe("up 3 dp, left 8 dp");
  });
});
