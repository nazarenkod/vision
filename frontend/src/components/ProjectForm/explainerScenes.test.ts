import {
  EXPLAINED_OPTIONS,
  explainerScene,
  sceneHeight,
  stillFrame,
  Verdict,
} from "./explainerScenes";

describe("explainerScene", () => {
  it("marks the change only when the option lets it through", () => {
    // a failed check is worse than any number of changes
    const weight = (verdict: Verdict) =>
      verdict.kind === "fails"
        ? Infinity
        : verdict.kind === "changes"
          ? verdict.count
          : 0;
    for (const option of EXPLAINED_OPTIONS) {
      const { off, on } = explainerScene(option).outcome;
      expect({
        option,
        betterWhenOn: weight(on.verdict) < weight(off.verdict),
      }).toEqual({ option, betterWhenOn: true });
    }
    // a new banner is a change either way; the rows it pushed are not, with the option on
    const moves = explainerScene("moves").outcome;
    expect(moves.off.verdict).toEqual({ kind: "changes", count: 5 });
    expect(moves.on.verdict).toEqual({ kind: "changes", count: 1 });
    // a screen of another size fails without the option and is compared with it
    const sizes = explainerScene("diffDimensions").outcome;
    expect(sizes.off.verdict).toEqual({ kind: "fails" });
    expect(sizes.on.verdict).toEqual({ kind: "changes", count: 1 });
    expect(explainerScene("caret").outcome.on.verdict).toEqual({
      kind: "none",
    });
  });

  it("draws every scene from shapes alone", () => {
    for (const option of EXPLAINED_OPTIONS) {
      for (const shape of explainerScene(option).shapes) {
        expect(["rect", "text", "line"]).toContain(shape.kind);
        expect(JSON.stringify(shape)).not.toMatch(/https?:|data:|\.png/);
      }
    }
  });

  it("splits a scene into the baseline and the current screen", () => {
    const scene = explainerScene("moves");
    const before = stillFrame(scene, "before");
    const after = stillFrame(scene, "after");
    // the banner and its label are new on the current screen
    expect(after.length - before.length).toBe(2);
    expect(after.find((shape) => shape.dy)?.y).toBe(80);
    expect(stillFrame(explainerScene("caret"), "after")).toHaveLength(
      stillFrame(explainerScene("caret"), "before").length - 1,
    );
    expect(sceneHeight(explainerScene("diffDimensions"))).toBe(224);
    // the edge pixels change their shade, not their place
    const edge = stillFrame(explainerScene("antialiasing"), "after").find(
      (shape) => shape.toneAfter,
    );
    expect(edge?.tone).toBe("softer");
  });
});
