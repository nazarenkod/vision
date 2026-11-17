import { wordDiff } from "./wordDiff.helper";

const changed = (pieces: { text: string; changed: boolean }[]) =>
  pieces.filter((piece) => piece.changed).map((piece) => piece.text);

describe("wordDiff", () => {
  it("marks only the words that differ", () => {
    const diff = wordDiff(
      "Зі своєї картки *8353 +5.00 UAH 11 серпня, 11:25",
      "Зі своєї картки *8352 +3.00 UAH 11 серпня, 11:25",
    );
    expect(changed(diff.before)).toEqual(["*8353", "+5.00"]);
    expect(changed(diff.after)).toEqual(["*8352", "+3.00"]);
  });

  it("reads back each text exactly as it was", () => {
    const diff = wordDiff("a  b c", "a b  d");
    expect(diff.before.map((piece) => piece.text).join("")).toBe("a  b c");
    expect(diff.after.map((piece) => piece.text).join("")).toBe("a b  d");
  });

  it("marks the whole word when one character in it changed", () => {
    const diff = wordDiff("серпня, 11:25", "серпня, 11:26");
    expect(changed(diff.before)).toEqual(["11:25"]);
    expect(changed(diff.after)).toEqual(["11:26"]);
  });

  it("marks everything when nothing is shared", () => {
    const diff = wordDiff("Pay now", "Later");
    expect(changed(diff.before)).toEqual(["Pay", "now"]);
    expect(changed(diff.after)).toEqual(["Later"]);
  });

  it("marks the other side whole when one side is empty", () => {
    const diff = wordDiff("", "New label");
    expect(diff.before).toEqual([]);
    expect(changed(diff.after)).toEqual(["New", "label"]);
  });
});
