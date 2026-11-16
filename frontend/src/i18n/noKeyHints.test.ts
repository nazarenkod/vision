import { en } from "./en";
import { uk } from "./uk";

// the interface names no keys (REQ-061-21): the keys still work, but no text
// tells about them
const KEY_HINT = /hotkey|shortcut|клавіш|гаряч/i;

const texts = (dictionary: object): Array<[string, string]> =>
  Object.entries(dictionary).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[key, value]]
      : Object.values(value as object).map(
          (form) => [key, String(form)] as [string, string],
        ),
  );

describe("dictionaries", () => {
  it("names no keys in any text", () => {
    const hints = [...texts(en), ...texts(uk)]
      .filter(([, text]) => KEY_HINT.test(text))
      .map(([key]) => key);
    expect(hints).toEqual([]);
  });
});
