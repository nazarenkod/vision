import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { test, expect, Page } from '@playwright/test';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { VisionPlaywright, MAX_UI_TREE_BYTES, ServerError } from '../dist';
import { MockVision, field, unpackTree } from './mockServer';

let server: MockVision;
let apiUrl: string;
const savedEnv = { ...process.env };

test.beforeEach(async () => {
  server = new MockVision();
  apiUrl = await server.listen();
});

test.afterEach(async () => {
  await server.close();
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
});

const config = () => ({ apiUrl, project: 'Web', apiKey: 'KEY', branchName: 'main' });

const shop = async (page: Page) => {
  await page.setContent(
    '<!DOCTYPE html><html><body><h1 id="title">Shop</h1><button id="buy">Buy</button></body></html>'
  );
};

test('sends the same request as the VRT agent, with Vision names', async ({ page, browser }) => {
  process.env.VISION_APIURL = apiUrl;
  process.env.VISION_PROJECT = 'Web';
  process.env.VISION_APIKEY = 'KEY';
  process.env.VISION_BRANCHNAME = 'feature/cart';
  process.env.VISION_CIBUILDID = 'ci-42';
  process.env.VISION_SOURCEBRANCH = 'main';
  process.env.VISION_ENABLESOFTASSERT = 'false';
  // the old names are not read at all (ADR-0026)
  process.env.VRT_APIKEY = 'OLD';
  process.env.VRT_PROJECT = 'Old';
  await shop(page);

  const vision = new VisionPlaywright('chromium');
  await vision.start();
  const result = await vision.trackPage(page, 'home', {
    agent: { os: 'Linux', device: 'Desktop' },
    customTags: 'smoke',
    diffTollerancePercent: 1.5,
    ignoreAreas: [{ x: 1, y: 2, width: 3, height: 4 }],
    comment: 'first',
    uiTree: false,
  });
  await vision.stop();

  const [build, run, stop] = server.received;
  for (const got of server.received) {
    expect(got.headers.apikey).toBe('KEY');
    expect(got.headers.project).toBe('Web');
    expect(got.headers.accept).toBe('application/json, text/plain, */*');
  }
  expect([build.method, build.url]).toEqual(['POST', '/builds']);
  expect(build.json).toEqual({ branchName: 'feature/cart', project: 'Web', ciBuildId: 'ci-42' });

  expect([run.method, run.url]).toEqual(['POST', '/test-runs/multipart']);
  // the fields of sdk-js's bufferDtoToFormData in its order; browserVersion is the one Vision adds
  expect(run.form).toEqual([
    ['buildId', 'build-1'],
    ['projectId', 'project-1'],
    ['branchName', 'feature/cart'],
    ['sourceBranch', 'main'],
    ['name', 'home'],
    ['os', 'Linux'],
    ['browser', 'chromium'],
    ['viewport', '1280x720'],
    ['device', 'Desktop'],
    ['customTags', 'smoke'],
    ['ignoreAreas', '[{"x":1,"y":2,"width":3,"height":4}]'],
    ['diffTollerancePercent', '1.5'],
    ['comment', 'first'],
    ['browserVersion', browser.version()],
  ]);
  expect(run.image).toEqual({ name: 'image.png', type: 'image/png', size: expect.any(Number) });
  expect(run.image!.size).toBeGreaterThan(100);

  expect([stop.method, stop.url]).toEqual(['PATCH', '/builds/build-1']);
  expect(stop.json).toEqual({ isRunning: false });
  expect(result.imageUrl).toBe(`${apiUrl}/images/image.png`);
});

test('reads vision.json, not vrt.json', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'vision-config-'));
  writeFileSync(join(dir, 'vision.json'), JSON.stringify({ ...config(), project: 'FromFile', ciBuildId: 'file-1' }));
  writeFileSync(join(dir, 'vrt.json'), JSON.stringify({ ...config(), project: 'Old', apiKey: 'OLD' }));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const vision = new VisionPlaywright('chromium');
    await vision.start();
  } finally {
    process.chdir(cwd);
  }
  expect(server.received[0].json).toEqual({ branchName: 'main', project: 'FromFile', ciBuildId: 'file-1' });
  expect(server.received[0].headers.apikey).toBe('KEY');
});

test('takes the source branch from VISION_SOURCEBRANCH with an explicit config, as the agent', async ({ page }) => {
  process.env.VISION_SOURCEBRANCH = 'release';
  process.env.VISION_PROJECT = 'Ignored';
  await shop(page);
  const vision = new VisionPlaywright('chromium', config());
  await vision.start();
  await vision.trackPage(page, 'home', { uiTree: false });
  expect(field(server.testRuns()[0], 'sourceBranch')).toBe('release');
  expect(server.received[0].json).toEqual({ branchName: 'main', project: 'Web' });
});

test('sends the tree, the format and the feature name with the screenshot', async ({ page, browser }) => {
  await shop(page);
  const vision = new VisionPlaywright('chromium', config());
  await vision.start();
  await vision.trackPage(page, 'home', { featureName: 'Checkout' });

  const [run] = server.testRuns();
  const names = run.form!.map(([key]) => key);
  expect(names.slice(-4)).toEqual(['uiTree', 'uiTreeFormat', 'featureName', 'browserVersion']);
  expect(field(run, 'uiTreeFormat')).toBe('web');
  expect(field(run, 'featureName')).toBe('Checkout');
  expect(field(run, 'browserVersion')).toBe(browser.version());
  const tree = unpackTree(field(run, 'uiTree')!);
  expect(tree.startsWith('<!DOCTYPE html><html data-vision-tree="1" data-vision-capture="viewport"')).toBe(true);
  expect(tree).toContain('id="buy"');
  expect(tree).toMatch(/<button[^>]*data-vision-rect="[\d.]+,[\d.]+,[\d.]+,[\d.]+"[^>]*>Buy<\/button>/);
});

test('collects the tree of the whole page for a full-page screenshot', async ({ page }) => {
  await shop(page);
  const vision = new VisionPlaywright('chromium', config());
  await vision.start();
  await vision.trackPage(page, 'full', { screenshotOptions: { fullPage: true } });
  await vision.trackPage(page, 'forced', { uiTree: 'page' });
  for (const run of server.testRuns()) {
    expect(unpackTree(field(run, 'uiTree')!)).toContain('data-vision-capture="page"');
  }
});

test('sends the screenshot without a tree when collecting fails', async ({ page }) => {
  await shop(page);
  // the collector reads where each element is; a page that breaks that breaks the script
  await page.evaluate(() => {
    Element.prototype.getBoundingClientRect = () => {
      throw new Error('blocked by the page');
    };
  });
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(' '));
  try {
    const vision = new VisionPlaywright('chromium', config());
    await vision.start();
    const result = await vision.trackPage(page, 'home', { featureName: 'Checkout' });
    expect(result.testRunResponse.status).toBe('ok');
  } finally {
    console.warn = warn;
  }
  const [run] = server.testRuns();
  expect(run.image!.size).toBeGreaterThan(100);
  expect(field(run, 'uiTree')).toBeUndefined();
  expect(field(run, 'uiTreeFormat')).toBeUndefined();
  expect(field(run, 'featureName')).toBe('Checkout');
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatch(/^Vision: no UI tree for "home", collecting it failed: .*blocked by the page/);
});

test('sends the screenshot without a tree when the page is closed before it is collected', async ({ page }) => {
  await shop(page);
  const screenshot = await page.screenshot();
  const gone = {
    viewportSize: () => ({ width: 800, height: 600 }),
    evaluate: () => Promise.reject(new Error('Target page, context or browser has been closed')),
    screenshot: async () => screenshot,
  } as unknown as Page;
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => void warnings.push(args.join(' '));
  try {
    const vision = new VisionPlaywright('chromium', config());
    await vision.start();
    await vision.trackPage(gone, 'closed');
  } finally {
    console.warn = warn;
  }
  expect(field(server.testRuns()[0], 'uiTree')).toBeUndefined();
  expect(warnings[0]).toContain('has been closed');
});

test('leaves out a tree larger than 10 MiB', async ({ page }) => {
  await shop(page);
  const screenshot = await page.screenshot();
  const huge = {
    viewportSize: () => ({ width: 800, height: 600 }),
    evaluate: async () => '<html>' + 'x'.repeat(MAX_UI_TREE_BYTES) + '</html>',
    screenshot: async () => screenshot,
  } as unknown as Page;
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => void warnings.push(args.join(' '));
  try {
    const vision = new VisionPlaywright('chromium', config());
    await vision.start();
    await vision.trackPage(huge, 'huge');
  } finally {
    console.warn = warn;
  }
  expect(field(server.testRuns()[0], 'uiTree')).toBeUndefined();
  expect(warnings[0]).toContain('more than 10485760');
});

test('sends an element screenshot without a tree', async ({ page, browser }) => {
  await shop(page);
  const vision = new VisionPlaywright('chromium', config());
  await vision.start();
  await vision.trackElementHandle(page.locator('#buy'), 'buy', {
    agent: { viewport: '1280x720' },
    featureName: 'Checkout',
  });
  await expect(vision.trackElementHandle(null, 'none')).rejects.toThrow('ElementHandle is null');
  expect(server.testRuns()[0].form).toEqual([
    ['buildId', 'build-1'],
    ['projectId', 'project-1'],
    ['branchName', 'main'],
    ['name', 'buy'],
    ['browser', 'chromium'],
    ['viewport', '1280x720'],
    ['featureName', 'Checkout'],
    ['browserVersion', browser.version()],
  ]);
});

test('retries an unresolved screenshot, then fails it as sdk-js does', async ({ page }) => {
  await shop(page);
  const vision = new VisionPlaywright('chromium', config());
  await vision.start();
  server.statuses = ['unresolved', 'unresolved', 'ok'];
  await vision.trackPage(page, 'retried', { uiTree: false });
  expect(server.testRuns()).toHaveLength(3);

  server.statuses = ['unresolved'];
  await expect(vision.trackPage(page, 'diff', { uiTree: false }, 1)).rejects.toThrow(
    'Difference found: http://vision/run-1'
  );
  expect(server.testRuns()).toHaveLength(5);

  server.statuses = ['new'];
  await expect(vision.trackPage(page, 'new', { uiTree: false })).rejects.toThrow('No baseline: http://vision/run-1');

  const soft = new VisionPlaywright('chromium', { ...config(), enableSoftAssert: true });
  await soft.start();
  const error = console.error;
  console.error = () => undefined;
  try {
    const result = await soft.trackPage(page, 'new', { uiTree: false });
    expect(result.testRunResponse.status).toBe('new');
  } finally {
    console.error = error;
  }
});

test('says which request failed and how to fix it, without the key', async () => {
  const closed = new MockVision();
  const closedUrl = await closed.listen();
  await closed.close();
  const offline = new VisionPlaywright('chromium', { ...config(), apiUrl: closedUrl.replace('//', '//user:secret@') });
  const refused = await offline.start().catch((error: Error) => error);
  expect((refused as Error).message).toMatch(
    /^No response from server for POST http:\/\/127\.0\.0\.1:\d+\/builds \(ECONNREFUSED\)/
  );
  expect((refused as Error).message).not.toContain('secret');

  const forbidden = createServer((_, res) => {
    res.statusCode = 401;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: 'Unauthorized', statusCode: 401 }));
  });
  await new Promise<void>((resolve) => forbidden.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(forbidden.address() as AddressInfo).port}`;
  const error = await new VisionPlaywright('chromium', { ...config(), apiUrl: url }).start().catch((e: Error) => e);
  forbidden.close();
  expect(error).toBeInstanceOf(ServerError);
  expect((error as ServerError).message).toBe(`POST ${url}/builds returned 401: Unauthorized. Check apiKey.`);
  expect((error as ServerError).status).toBe(401);

  await expect(new VisionPlaywright('chromium', config()).stop()).rejects.toThrow('Vision has not been started');
  expect(() => new VisionPlaywright('chromium', { ...config(), apiKey: '' })).toThrow('apiKey is not specified');
});

test('sends credentials in the API URL as basic auth, as axios did', async () => {
  const vision = new VisionPlaywright('chromium', { ...config(), apiUrl: apiUrl.replace('//', '//user:se%40cret@') });
  await vision.start();
  expect(server.received[0].headers.authorization).toBe(`Basic ${Buffer.from('user:se@cret').toString('base64')}`);
  expect(server.received[0].url).toBe('/builds');
});
