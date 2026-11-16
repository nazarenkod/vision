import { readFileSync } from 'fs';
import { join } from 'path';
import { test, expect, Page } from '@playwright/test';
import { VisionPlaywright, collectorScript } from '../dist';
import { MockVision, field, unpackTree } from './mockServer';

test('uses the very script the Java SDK uses', () => {
  const shared = readFileSync(join(__dirname, '..', '..', 'web-tree', 'collect-tree.js'));
  const bundled = readFileSync(join(__dirname, '..', 'dist', 'collect-tree.js'));
  expect(bundled.equals(shared)).toBe(true);
  expect(Buffer.from(collectorScript(), 'utf8').equals(shared)).toBe(true);
});

test('collects the tree in the page right before the screenshot', async ({ page }) => {
  const server = new MockVision();
  const apiUrl = await server.listen();
  try {
    await page.setContent('<!DOCTYPE html><html><body><p id="state">before</p></body></html>');
    const calls: string[] = [];
    // the real page, recording what the SDK asks of it and in which order
    const watched = {
      viewportSize: () => page.viewportSize(),
      context: () => page.context(),
      evaluate: async (script: string) => {
        calls.push('tree');
        return page.evaluate(script);
      },
      screenshot: async (options?: Parameters<Page['screenshot']>[0]) => {
        calls.push('screenshot');
        return page.screenshot(options);
      },
    } as unknown as Page;
    await page.evaluate(() => {
      document.getElementById('state')!.textContent = 'after';
      window.scrollTo(0, 0);
    });

    const vision = new VisionPlaywright('chromium', { apiUrl, project: 'Web', apiKey: 'KEY', branchName: 'main' });
    await vision.start();
    await vision.trackPage(watched, 'state');

    expect(calls).toEqual(['tree', 'screenshot']);
    const tree = unpackTree(field(server.testRuns()[0], 'uiTree')!);
    expect(tree).toContain('>after</p>');
    expect(tree).not.toContain('before');
    const viewport = page.viewportSize()!;
    expect(tree).toContain(`data-vision-viewport="${viewport.width},${viewport.height}"`);
  } finally {
    await server.close();
  }
});
