// Ported from Visual Regression Tracker agent-playwright 6.0.0
// (src/playwrightVisualRegressionTracker.ts), Apache-2.0; see ../NOTICE.
// Vision adds the page's UI tree, featureName and browserVersion to the same request (spec 050).
import type { Page, ElementHandle, Locator } from '@playwright/test';
import { VisionClient } from './client';
import { ElementHandleTrackOptions, PageTrackOptions } from './interfaces';
import { BuildResponse, Config, TestRunResult } from './types';
import { UiTreeCapture, uiTreeFor } from './uiTree';

/** The page as trackPage uses it; evaluate and context are optional for a page stand-in. */
export type TrackedPage = Pick<Page, 'viewportSize' | 'screenshot'> & Partial<Pick<Page, 'evaluate' | 'context'>>;

const browserVersionOf = (page: TrackedPage): string | undefined => {
  try {
    return page.context?.().browser()?.version() || undefined;
  } catch {
    return undefined;
  }
};

const captureOf = (options?: PageTrackOptions): UiTreeCapture | undefined => {
  const wanted = options?.uiTree ?? true;
  if (wanted === false) return undefined;
  if (wanted === 'viewport' || wanted === 'page') return wanted;
  return options?.screenshotOptions?.fullPage ? 'page' : 'viewport';
};

export class VisionPlaywright {
  private vision: VisionClient;
  private browser: string;

  constructor(browserName: string, config?: Config) {
    // an explicit config skips VISION_* variables, but the source branch still comes from CI
    this.vision = new VisionClient(
      config && { ...config, sourceBranch: config.sourceBranch || process.env.VISION_SOURCEBRANCH }
    );
    this.browser = browserName;
  }

  async start(): Promise<BuildResponse> {
    return this.vision.start();
  }

  async stop(): Promise<void> {
    return this.vision.stop();
  }

  async trackPage(page: TrackedPage, name: string, options?: PageTrackOptions, retryCount = 2): Promise<TestRunResult> {
    const viewportSize = page.viewportSize();
    const capture = captureOf(options);
    // right before the screenshot, in the same page, so the tree is what the screenshot shows
    const uiTree =
      capture && page.evaluate ? await uiTreeFor(page as Pick<Page, 'evaluate'>, capture, name) : undefined;
    const imageBuffer = await page.screenshot(options?.screenshotOptions);
    return this.vision.track(
      {
        name,
        imageBuffer,
        browser: this.browser,
        viewport: viewportSize ? `${viewportSize.width}x${viewportSize.height}` : undefined,
        os: options?.agent?.os,
        device: options?.agent?.device,
        customTags: options?.customTags,
        diffTollerancePercent: options?.diffTollerancePercent,
        ignoreAreas: options?.ignoreAreas,
        comment: options?.comment,
        uiTree,
        uiTreeFormat: uiTree ? 'web' : undefined,
        featureName: options?.featureName,
        browserVersion: browserVersionOf(page),
      },
      retryCount
    );
  }

  /** An element screenshot goes without a tree: its pixels do not map to page coordinates. */
  async trackElementHandle(
    elementHandle: ElementHandle | Locator | null,
    name: string,
    options?: ElementHandleTrackOptions,
    retryCount = 2
  ): Promise<TestRunResult> {
    if (!elementHandle) throw new Error('ElementHandle is null');
    return this.vision.track(
      {
        name,
        imageBuffer: await elementHandle.screenshot(options?.screenshotOptions),
        browser: this.browser,
        viewport: options?.agent?.viewport,
        os: options?.agent?.os,
        device: options?.agent?.device,
        customTags: options?.customTags,
        diffTollerancePercent: options?.diffTollerancePercent,
        ignoreAreas: options?.ignoreAreas,
        comment: options?.comment,
        featureName: options?.featureName,
        browserVersion: browserVersionOf(elementPage(elementHandle)),
      },
      retryCount
    );
  }
}

// a Locator knows its page; an ElementHandle does not, so its browser version is not sent
const elementPage = (element: ElementHandle | Locator): TrackedPage =>
  ('page' in element && typeof element.page === 'function' ? element.page() : {}) as TrackedPage;
