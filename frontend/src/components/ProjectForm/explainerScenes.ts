/**
 * What the four Compare… and Ignore… options do, as schematic screens (049, US-3).
 * A scene is a baseline, the current screen, and what Vision makes of the pair
 * with the option off and on. Shapes only — bars, blocks, letters — never a
 * real screenshot (REQ-049-23), so it costs no request and works in both themes.
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
export type Tone =
  | "frame"
  | "bar"
  | "block"
  | "accent"
  | "onAccent"
  | "ink"
  | "line"
  | "soft"
  | "softer";

export interface Shape {
  kind: "rect" | "text" | "line";
  x: number;
  y: number;
  w: number;
  h: number;
  tone: Tone;
  text?: string;
  /** Only on the current screen: it came in. */
  appears?: boolean;
  /** Only on the baseline: it went. */
  vanishes?: boolean;
  /** Moved down by this much on the current screen. */
  dy?: number;
  /** Grew by this much in height on the current screen. */
  dh?: number;
  /** Another tone on the current screen. */
  toneAfter?: Tone;
}

export type Mark = Pick<Shape, "x" | "y" | "w" | "h">;

/** How the comparison ends: nothing, some changes, or a failed check. */
export type Verdict =
  { kind: "none" } | { kind: "changes"; count: number } | { kind: "fails" };

export interface Outcome {
  /** Places Vision marks as a change on the current screen. */
  marks: Mark[];
  verdict: Verdict;
}

export interface Scene {
  shapes: Shape[];
  /** What the comparison shows with the option off and on (REQ-049-22). */
  outcome: Record<"off" | "on", Outcome>;
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
// a status bar with the clock, and the app's title bar under it
const chrome: Shape[] = [
  { kind: "text", x: 8, y: 3, w: 20, h: 9, tone: "ink", text: "9:41" },
  { kind: "rect", x: 0, y: 16, w: 120, h: 20, tone: "bar" },
  { kind: "rect", x: 10, y: 24, w: 44, h: 5, tone: "line" },
];

/** A list row: a card with a title line and a shorter line under it. */
const row = (y: number, dy?: number): Shape[] => [
  { kind: "rect", x: 10, y, w: 100, h: 26, tone: "block", dy },
  { kind: "rect", x: 18, y: y + 7, w: 56, h: 5, tone: "line", dy },
  { kind: "rect", x: 18, y: y + 16, w: 38, h: 4, tone: "soft", dy },
];

const markOf = ({ x, y, w, h }: Shape, dy = 0, pad = 0): Mark => ({
  x: x - pad,
  y: y + dy - pad,
  w: w + 2 * pad,
  h: h + 2 * pad,
});

const changes = (marks: Mark[]): Outcome => ({
  marks,
  verdict: marks.length
    ? { kind: "changes", count: marks.length }
    : { kind: "none" },
});

/** The scene of an option: baseline, current screen, and both outcomes. */
export function explainerScene(option: ExplainedOption): Scene {
  switch (option) {
    case "moves": {
      // a banner came in on top and pushed the list down
      const banner: Shape = {
        kind: "rect",
        x: 10,
        y: 44,
        w: 100,
        h: 30,
        tone: "accent",
        appears: true,
      };
      const label: Shape = {
        kind: "text",
        x: 44,
        y: 52,
        w: 32,
        h: 13,
        tone: "onAccent",
        text: "−20%",
        appears: true,
      };
      const rows = [44, 76, 108, 140].map((y) => row(y, 36));
      const cards = rows.map(([card]) => markOf(card, 36));
      return {
        shapes: [screen, ...chrome, ...rows.flat(), banner, label],
        outcome: {
          // every moved row differs pixel by pixel
          off: changes([markOf(banner), ...cards]),
          // the rows are found at their new place: only the banner is new
          on: changes([markOf(banner)]),
        },
      };
    }
    case "diffDimensions": {
      // the same screen from a device 24 px taller
      const taller: Shape = { ...screen, dh: 24 };
      return {
        shapes: [taller, ...chrome, ...row(44), ...row(76), ...row(108)],
        outcome: {
          off: {
            marks: [{ x: 0, y: 0, w: 120, h: 224 }],
            verdict: { kind: "fails" },
          },
          // compared after all: only the extra strip at the bottom differs
          on: changes([{ x: 0, y: 200, w: 120, h: 24 }]),
        },
      };
    }
    case "antialiasing": {
      // a letter's edge, enlarged: the softened pixels come out a shade off
      const cell = 12;
      const at = (
        column: number,
        line: number,
        tone: Tone,
        toneAfter?: Tone,
      ): Shape => ({
        kind: "rect",
        x: 24 + column * cell,
        y: 56 + line * cell,
        w: cell,
        h: cell,
        tone,
        toneAfter,
      });
      // the stroke of a letter, two pixels wide, stepping up to the right
      const stroke = [0, 1, 2, 3, 4, 5].flatMap((line) => [
        at(4 - line, line, "ink"),
        at(5 - line, line, "ink"),
      ]);
      const edges = [1, 3, 5].map((line) =>
        at(6 - line, line, "soft", "softer"),
      );
      const zoom: Shape = {
        kind: "text",
        x: 84,
        y: 136,
        w: 24,
        h: 11,
        tone: "soft",
        text: "×8",
      };
      return {
        shapes: [screen, ...chrome, ...stroke, ...edges, zoom],
        outcome: {
          off: changes(edges.map((edge) => markOf(edge, 0, 1))),
          on: changes([]),
        },
      };
    }
    case "caret": {
      // the text caret blinks: in the field on the baseline, gone on the current screen
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
        y: 88,
        w: 44,
        h: 13,
        tone: "ink",
        text: "Vision",
      };
      const caret: Shape = {
        kind: "line",
        x: 66,
        y: 86,
        w: 0,
        h: 18,
        tone: "accent",
        vanishes: true,
      };
      return {
        shapes: [screen, ...chrome, field, value, caret],
        outcome: {
          off: changes([{ x: 62, y: 84, w: 8, h: 22 }]),
          on: changes([]),
        },
      };
    }
  }
}

/** The baseline or the current screen, as a still picture. */
export function stillFrame(scene: Scene, frame: "before" | "after"): Shape[] {
  return scene.shapes
    .filter((shape) => (frame === "before" ? !shape.appears : !shape.vanishes))
    .map((shape) =>
      frame === "after"
        ? {
            ...shape,
            y: shape.y + (shape.dy ?? 0),
            h: shape.h + (shape.dh ?? 0),
            tone: shape.toneAfter ?? shape.tone,
          }
        : shape,
    );
}

/** The tallest the current screen gets, for the picture's frame. */
export const sceneHeight = (scene: Scene): number =>
  Math.max(...stillFrame(scene, "after").map((shape) => shape.y + shape.h));
