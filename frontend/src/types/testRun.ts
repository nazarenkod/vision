import { TestStatus } from "./testStatus";

export interface TestRun {
  id: string;
  buildId: string;
  imageName: string;
  // Null whenever there is nothing to compare — a new run, or one that matched
  // its baseline. It has always arrived as null from the API; the type simply
  // said otherwise, which pushed call sites into casts instead of handling it.
  diffName: string | null;
  // Small copies the API makes at ingest for the card grids to draw. Absent on
  // runs ingested before they existed, and on runs with no saved diff.
  imageThumbnailName?: string | null;
  diffThumbnailName?: string | null;
  diffPercent: number;
  diffTollerancePercent: number;
  status: TestStatus;
  testVariationId: string;
  name: string;
  baselineName: string;
  os: string;
  browser: string;
  viewport: string;
  device: string;
  customTags: string;
  ignoreAreas: string;
  tempIgnoreAreas: string;
  comment?: string;
  branchName: string;
  baselineBranchName: string;
  merge: boolean;
  vlmDescription?: string;
  // set when the screenshot came with an Appium UI tree
  hasUiTree?: boolean;
  // present when the run comes straight from the database (details, socket events)
  uiTreeName?: string | null;
  // accessibility issues nobody has acted on yet / all counted issues
  a11yNewCount?: number | null;
  a11yTotalCount?: number | null;
}

/** Whether the screenshot came with an Appium UI tree, whichever shape the run arrived in. */
export const hasUiTree = (
  testRun: Pick<TestRun, "hasUiTree" | "uiTreeName">,
): boolean => testRun.hasUiTree ?? !!testRun.uiTreeName;
