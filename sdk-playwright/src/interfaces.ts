// Ported from Visual Regression Tracker agent-playwright 6.0.0 (src/playwright.interfaces.ts),
// Apache-2.0; see ../NOTICE. Vision adds featureName and uiTree.
import type { Page, ElementHandle } from '@playwright/test';
import { IgnoreArea } from './types';

export interface Agent {
  os?: string;
  device?: string;
  viewport?: string;
}

interface BaseTrackOptions {
  diffTollerancePercent?: number;
  ignoreAreas?: IgnoreArea[];
  agent?: Agent;
  customTags?: string;
  comment?: string;
  /** Feature the screen belongs to; names bugs filed from the review. Not part of the check */
  featureName?: string;
}

export interface PageTrackOptions extends BaseTrackOptions {
  screenshotOptions?: Parameters<Page['screenshot']>[0];
  /**
   * The UI tree sent with the screenshot. By default (true) it is collected for what the
   * screenshot shows: the whole page with `screenshotOptions.fullPage`, else the viewport.
   * 'viewport' or 'page' says it explicitly; false sends the screenshot without a tree.
   */
  uiTree?: boolean | 'viewport' | 'page';
}

export interface ElementHandleTrackOptions extends BaseTrackOptions {
  screenshotOptions?: Parameters<ElementHandle['screenshot']>[0];
}
