// Ported from Visual Regression Tracker sdk-js 5.9.0 (src/types), Apache-2.0; see ../NOTICE.

export interface Config {
  apiUrl: string;
  branchName: string;
  sourceBranch?: string;
  project: string;
  apiKey: string;
  enableSoftAssert?: boolean;
  ciBuildId?: string;
  /** Read timeout per request; 0 means no limit. Default 360 */
  httpTimeoutInSeconds?: number;
}

export interface IgnoreArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum TestStatus {
  failed = 'failed',
  new = 'new',
  ok = 'ok',
  unresolved = 'unresolved',
  approved = 'approved',
  autoApproved = 'autoApproved',
}

export interface BuildResponse {
  id: string;
  projectId: string;
  ciBuildId?: string;
}

export interface TestRunResponse {
  id: string;
  imageName: string;
  diffName?: string;
  baselineName?: string;
  diffPercent: number;
  diffTollerancePercent?: number;
  pixelMisMatchCount?: number;
  status: TestStatus;
  url: string;
  merge: boolean;
}

/** What the SDK sends for one screenshot, as sdk-js's TestRunBuffer plus Vision's fields. */
export interface TestRunBuffer {
  name: string;
  imageBuffer: Buffer;
  os?: string;
  browser?: string;
  viewport?: string;
  device?: string;
  customTags?: string;
  diffTollerancePercent?: number;
  ignoreAreas?: IgnoreArea[];
  comment?: string;
  merge?: boolean;
  /** base64 of the gzipped tree */
  uiTree?: string;
  uiTreeFormat?: 'web';
  featureName?: string;
  browserVersion?: string;
}

export class TestRunResult {
  testRunResponse: TestRunResponse;
  imageUrl: string;
  diffUrl?: string;
  baselineUrl?: string;

  constructor(testRunResponse: TestRunResponse, apiUrl: string) {
    const imageUrl = (name: string) => `${apiUrl}/images/${name}`;
    this.testRunResponse = testRunResponse;
    this.imageUrl = imageUrl(testRunResponse.imageName);
    this.diffUrl = testRunResponse.diffName && imageUrl(testRunResponse.diffName);
    this.baselineUrl = testRunResponse.baselineName && imageUrl(testRunResponse.baselineName);
  }
}
