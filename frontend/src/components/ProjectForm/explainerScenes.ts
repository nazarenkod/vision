/**
 * What the four Compare… and Ignore… options do, as schematic screens (049, US-3).
 * A scene is shapes only — bars, blocks, letters — never a real screenshot
 * (REQ-049-23), so it costs no request and works in both themes.
 */
export type ExplainedOption =
  "moves" | "diffDimensions" | "antialiasing" | "caret";

export const EXPLAINED_OPTIONS: ReadonlyArray<ExplainedOption> = [
  "moves",
  "diffDimensions",
  "antialiasing",
  "caret",
];

/** Colour roles, not colours: the component maps them to theme tokens (REQ-049-27). */
export type Tone = "frame" | "bar" | "block" | "accent" | "ink" | "soft";

export interface Shape {
  kind: "rect" | "text" | "line";
  x: number;
  y: number;
  w: number;
  h: number;
  tone: Tone;
  text?: string;
  /** Only in the "after" frame: it comes in. */
  appears?: boolean;
  /** Only in the "before" frame: it goes. */
  vanishes?: boolean;
  /** Moves down by this much from "before" to "after". */
  dy?: number;
  /** Grows by this much in height from "before" to "after". */
  dh?: number;
}

export interface Scene {
  shapes: Shape[];
  /** Places Vision marks as a change in the "after" frame (REQ-049-22). */
  marks: Array<Pick<Shape, "x" | "y" | "w" | "h">>;
}

export const SCENE_SIZE = { width: 120, height: 200 } as const;

const screen: Shape = {
  kind: "rect",
  x: 0,
  y: 0,
  w: 120,
  h: 200,
  tone: "frame",
};
const header: Shape = { kind: "rect", x: 0, y: 0, w: 120, h: 22, tone: "bar" };
const row = (y: number, dy?: number): Shape => ({
  kind: "rect",
  x: 10,
  y,
  w: 100,
  h: 22,
  tone: "block",
  dy,
});

/** The scene of an option, in the state the switch is in now. */
export function explainerScene(option: ExplainedOption, on: boolean): Scene {
  switch (option) {
    case "moves": {
      // a banner comes in on top and pushes the list down
      const banner: Shape = {
        kind: "rect",
        x: 10,
        y: 30,
        w: 100,
        h: 26,
        tone: "accent",
        appears: true,
      };
      const list = [row(30, 34), row(60, 34), row(90, 34), row(120, 34)];
      const bannerMark = { x: banner.x, y: banner.y, w: banner.w, h: banner.h };
      // with the option on, only the banner is new; off, every moved row is a change too
      const moved = list.map((shape) => ({
        x: shape.x,
        y: shape.y + (shape.dy ?? 0),
        w: shape.w,
        h: shape.h,
      }));
      return {
        shapes: [screen, header, ...list, banner],
        marks: on ? [bannerMark] : [bannerMark, ...moved],
      };
    }
    case "diffDimensions": {
      // the same screen comes in 16 px taller, from a device with another size
      const taller: Shape = { ...screen, dh: 16 };
      const shapes = [taller, header, row(34), row(64), row(94)];
      return { shapes, marks: on ? [] : [{ x: 0, y: 0, w: 120, h: 216 }] };
    }
    case "antialiasing": {
      // the letter's edge comes out a shade off on another run
      const letter: Shape = {
        kind: "text",
        x: 32,
        y: 60,
        w: 56,
        h: 80,
        tone: "ink",
        text: "A",
      };
      const edges: Shape[] = [
        {
          kind: "rect",
          x: 38,
          y: 126,
          w: 9,
          h: 9,
          tone: "soft",
          appears: true,
        },
        {
          kind: "rect",
          x: 73,
          y: 126,
          w: 9,
          h: 9,
          tone: "soft",
          appears: true,
        },
        { kind: "rect", x: 56, y: 72, w: 9, h: 9, tone: "soft", appears: true },
      ];
      return {
        shapes: [screen, header, letter, ...edges],
        marks: on
          ? []
          : edges.map(({ x, y, w, h }) => ({
              x: x - 2,
              y: y - 2,
              w: w + 4,
              h: h + 4,
            })),
      };
    }
    case "caret": {
      // the text caret blinks: in the field on one shot, gone on the next
      const field: Shape = {
        kind: "rect",
        x: 10,
        y: 80,
        w: 100,
        h: 30,
        tone: "block",
      };
      const value: Shape = {
        kind: "text",
        x: 18,
        y: 101,
        w: 40,
        h: 14,
        tone: "ink",
        text: "Vision",
      };
      const caret: Shape = {
        kind: "line",
        x: 62,
        y: 86,
        w: 0,
        h: 18,
        tone: "accent",
        vanishes: true,
      };
      return {
        shapes: [screen, header, field, value, caret],
        marks: on ? [] : [{ x: 58, y: 84, w: 8, h: 22 }],
      };
    }
  }
}

/** Shapes of one still frame, for reduced motion (REQ-049-25). */
export function stillFrame(scene: Scene, frame: "before" | "after"): Shape[] {
  return scene.shapes
    .filter((shape) => (frame === "before" ? !shape.appears : !shape.vanishes))
    .map((shape) =>
      frame === "after"
        ? {
            ...shape,
            y: shape.y + (shape.dy ?? 0),
            h: shape.h + (shape.dh ?? 0),
          }
        : shape,
    );
}
