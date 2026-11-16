import { fittingTagCount } from "./tagOverflow.helper";

describe("fittingTagCount", () => {
  it("keeps every tag when they all fit", () => {
    expect(fittingTagCount([50, 50, 50], 160, 4, 30)).toBe(3);
  });

  it("keeps every tag when they fit exactly, with no room for +N", () => {
    expect(fittingTagCount([50, 50], 104, 4, 30)).toBe(2);
  });

  it("leaves room for +N beside the tags it keeps", () => {
    // 50 + 4 + 50 + 4 + 30 = 138 fits, a third tag would not
    expect(fittingTagCount([50, 50, 50, 50, 50], 150, 4, 30)).toBe(2);
  });

  it("keeps the first tag even when nothing else fits", () => {
    expect(fittingTagCount([120, 50], 100, 4, 30)).toBe(1);
  });

  it("keeps every tag while the line has not been laid out", () => {
    expect(fittingTagCount([50, 50], 0, 4, 30)).toBe(2);
  });

  it("has nothing to keep without tags", () => {
    expect(fittingTagCount([], 100, 4, 30)).toBe(0);
  });
});
