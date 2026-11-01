import { sincePrevious } from "./previousBuild.helper";
import { DICTIONARIES } from "../i18n/dictionaries";
import { translate } from "../i18n/translate";
import { Text } from "../i18n";

const ukrainian: Text = (key, params) =>
  translate(DICTIONARIES, "uk", key, params);

describe("since the previous build", () => {
  it("says what changed since the previous build, leaving out zeros", () => {
    expect(sincePrevious({ number: 1, changed: 4, added: 2, gone: 0 })).toBe(
      "Since #1: 4 changed, 2 new",
    );
    expect(
      sincePrevious({ number: 1, changed: 4, added: 2, gone: 0 }, ukrainian),
    ).toBe("Від #1: 4 змінено, 2 нові");
    expect(
      sincePrevious({ number: 7, changed: 0, added: 0, gone: 1 }, ukrainian),
    ).toBe("Від #7: 1 зник");
    expect(sincePrevious({ number: 7, changed: 0, added: 0, gone: 0 })).toBe(
      "Since #7: nothing new",
    );
  });
});
