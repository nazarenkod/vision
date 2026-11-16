import type { Viewer } from "../types";

/** The colleagues on one screen: never the person looking (REQ-056-03). */
export const viewersOn = (
  viewers: Viewer[],
  testRunId: string,
  selfId: string | undefined,
): Viewer[] =>
  viewers.filter(
    (viewer) => viewer.testRunId === testRunId && viewer.userId !== selfId,
  );

/** «OK» for «Olena K.»: what fits in a 20 px circle. */
export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
