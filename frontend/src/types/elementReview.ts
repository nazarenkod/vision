import type { Rect } from "./insights";

/** A screen of the build where the element changed (055, beta). */
export interface ElementReviewScreen {
  id: string;
  name: string;
  customTags: string;
  device: string;
  os: string;
  browser: string;
  viewport: string;
  imageName: string;
  baselineName: string;
  merge: boolean;
  // nothing else changed on the screen: one decision may take it
  only: boolean;
  current: Rect | null;
  baseline: Rect | null;
  width: number;
  height: number;
  baselineWidth: number;
  baselineHeight: number;
}

/** An element changed on several screens of a build. */
export interface ReviewedElement {
  key: string;
  name: string;
  screens: number;
  only: number;
  items: ElementReviewScreen[];
}
