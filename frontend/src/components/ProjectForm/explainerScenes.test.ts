import {
  EXPLAINED_OPTIONS,
  explainerScene,
  stillFrame,
} from "./explainerScenes";

describe("explainerScene", () => {
  it("marks the change only when the option lets it through", () => {
    for (const option of EXPLAINED_OPTIONS) {
      const on = explainerScene(option, true).marks.length;
      const off = explainerScene(option, false).marks.length;
      expect({ option, fewerWhenOn: on < off }).toEqual({
        option,
        fewerWhenOn: true,
      });
    }
    // a new banner is a change either way; the rows it pushed are not, with the option on
    expect(explainerScene("moves", true).marks).toHaveLength(1);
    expect(explainerScene("moves", false).marks).toHaveLength(5);
  });

  it("draws every scene from shapes alone", () => {
    for (const option of EXPLAINED_OPTIONS) {
      for (const shape of explainerScene(option, true).shapes) {
        expect(["rect", "text", "line"]).toContain(shape.kind);
        expect(JSON.stringify(shape)).not.toMatch(/https?:|data:|\.png/);
      }
    }
  });

  it("splits a scene into a before and an after frame", () => {
    const scene = explainerScene("moves", true);
    const before = stillFrame(scene, "before");
    const after = stillFrame(scene, "after");
    expect(before).toHaveLength(scene.shapes.length - 1);
    expect(after).toHaveLength(scene.shapes.length);
    expect(after.find((shape) => shape.dy)?.y).toBe(64);
    expect(stillFrame(explainerScene("caret", true), "after")).toHaveLength(4);
  });
});
