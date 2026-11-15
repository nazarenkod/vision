import type { Rect } from "./insights";

/** One device of a found check: its baseline, or its screen in a build (053). */
export interface ScreenSearchItem {
  id: string;
  testVariationId: string | null;
  device: string;
  os: string;
  browser: string;
  viewport: string;
  imageName: string | null;
  imageThumbnailName: string | null;
  width: number;
  height: number;
  boxes: Rect[];
  keys: string[];
}

export interface ScreenSearchRow {
  name: string;
  customTags: string;
  screen: string;
  matches: number;
  where: Array<"text" | "label" | "selector">;
  items: ScreenSearchItem[];
}

export interface ScreenSearchResult {
  problem?: string;
  scanned: number;
  withoutTree: number;
  total: number;
  page: number;
  rows: ScreenSearchRow[];
}
