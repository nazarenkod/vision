import React from "react";
import { render, screen } from "@testing-library/react";
import { ComparedMap } from "./ComparedMap";
import { overview } from "../../_helpers/whatsCompared.helper";

const size = { width: 1000, height: 2000 };

describe("ComparedMap", () => {
  it("draws the compared, ignored, tolerated and changed parts to scale", () => {
    const pay = { x: 0, y: 1800, width: 1000, height: 100 };
    const result = overview(
      {
        rules: [
          {
            id: "timer",
            selector: "id:timer",
            action: "ignore",
            scope: "screen",
            matches: 1,
            found: {
              current: [{ x: 800, y: 1820, width: 100, height: 40 }],
              baseline: [],
            },
          },
          {
            id: "map",
            selector: "id:map",
            action: "tolerate",
            maxDiffPercent: 5,
            scope: "screen",
            matches: 1,
            found: {
              current: [{ x: 0, y: 1850, width: 500, height: 50 }],
              baseline: [],
            },
          },
        ],
        compareOnly: {
          active: true,
          keep: [pay],
          problems: [],
          compared: [{ ruleId: "pay", element: 'Button "Pay"', bounds: pay }],
        },
        systemBars: [],
        systemBarsFrom: null,
        regions: [],
      },
      [],
      [],
    );
    render(
      <ComparedMap
        size={size}
        overview={result}
        changes={[{ x: 100, y: 1810, width: 50, height: 20 }]}
        label="Screen map: Only 1 element"
      />,
    );

    const map = screen.getByRole("img", { name: "Screen map: Only 1 element" });
    // 86 wide, so twice as tall for a 1000 × 2000 screenshot
    expect(map).toHaveStyle({ width: "86px", height: "172px" });
    const layer = (kind: string) =>
      Array.from(
        map.querySelectorAll(`[data-layer='${kind}']`),
      ) as HTMLElement[];
    expect(layer("keep")).toHaveLength(1);
    expect(layer("keep")[0]).toHaveStyle({ top: "90%", height: "5%" });
    expect(layer("ignore")[0]).toHaveStyle({ left: "80%", width: "10%" });
    expect(layer("tolerate")).toHaveLength(1);
    expect(layer("change")).toHaveLength(1);
  });

  it("draws nothing without the screenshot's size", () => {
    const { container } = render(
      <ComparedMap
        size={{ width: 0, height: 0 }}
        overview={overview(
          { rules: [], systemBars: [], systemBarsFrom: null, regions: [] },
          [],
          [],
        )}
        changes={[]}
        label="map"
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});
