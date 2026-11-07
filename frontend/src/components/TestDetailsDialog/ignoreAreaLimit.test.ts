import { ignoreAreasOverLimit, MAX_IGNORE_AREAS } from "./ignoreAreaLimit";
import { en } from "../../i18n/en";
import { uk } from "../../i18n/uk";

describe("ignore area limit (051)", () => {
  it("keeps the areas and names the limit when there are too many", () => {
    expect(MAX_IGNORE_AREAS).toBe(20);
    expect(ignoreAreasOverLimit(20)).toBeNull();
    expect(ignoreAreasOverLimit(0)).toBeNull();
    expect(ignoreAreasOverLimit(23)).toBe(3);
    // the message names the limit and how many to remove, in both languages
    for (const dictionary of [en, uk]) {
      expect(dictionary["review.ignoreLimit"]).toContain("{limit}");
      expect(dictionary["review.ignoreLimit"]).toContain("{extra}");
    }
  });
});
