import {
  clampPanelWidth,
  PANEL_WIDTH,
  readPanelWidth,
} from "./panelWidth.helper";

describe("clampPanelWidth", () => {
  it("keeps a width between the minimum and half the window", () => {
    expect(clampPanelWidth(500, 1512)).toBe(500);
    expect(clampPanelWidth(200, 1512)).toBe(PANEL_WIDTH.min);
    expect(clampPanelWidth(1200, 1512)).toBe(756);
  });

  it("gives the minimum even when half a narrow window is less", () => {
    expect(clampPanelWidth(500, 500)).toBe(PANEL_WIDTH.min);
  });
});

describe("readPanelWidth", () => {
  it("starts from the default when nothing is remembered", () => {
    expect(readPanelWidth(null, 1512)).toBe(PANEL_WIDTH.default);
    expect(readPanelWidth("wide", 1512)).toBe(PANEL_WIDTH.default);
  });

  it("takes the remembered width, fitted to this window", () => {
    expect(readPanelWidth("560", 1512)).toBe(560);
    expect(readPanelWidth("900", 1280)).toBe(640);
  });
});
