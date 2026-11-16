// Collects trees of pages/ in Chromium with collect-tree.js, for the backend tests (spec 050).
// node web-tree/make-fixtures.cjs  — rerun when the script or the pages change.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const script = fs.readFileSync(path.join(__dirname, 'collect-tree.js'), 'utf8');
const out = path.join(__dirname, '..', 'backend', 'src', 'ui-tree', '__fixtures__', 'web');
const page = (name) => 'file://' + path.join(__dirname, 'pages', name);

const shots = [
  { name: 'shop', url: page('shop.html'), dpr: 1 },
  { name: 'shop-banner', url: page('shop.html') + '?banner=1', dpr: 1 },
  { name: 'shop-dpr2', url: page('shop.html'), dpr: 2 },
  { name: 'shop-scrolled', url: page('shop.html'), dpr: 1, scrollY: 200 },
  { name: 'shop-full', url: page('shop.html'), dpr: 1, scrollY: 200, fullPage: true },
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const shot of shots) {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: shot.dpr });
    const tab = await context.newPage();
    await tab.goto(shot.url);
    if (shot.scrollY) await tab.evaluate((y) => window.scrollTo(0, y), shot.scrollY);
    const started = Date.now();
    const tree = await tab.evaluate(`(${script})(${JSON.stringify({ capture: shot.fullPage ? 'page' : 'viewport' })})`);
    const took = Date.now() - started;
    const png = await tab.screenshot({ fullPage: !!shot.fullPage });
    const size = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    fs.writeFileSync(path.join(out, `${shot.name}.html`), tree);
    fs.writeFileSync(path.join(out, `${shot.name}.json`), JSON.stringify(size) + '\n');
    console.log(shot.name, size, `${tree.length} chars, ${took} ms`);
    await context.close();
  }
  // a plain Selenium-like page source: what the browser holds, without the script
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const tab = await context.newPage();
  await tab.goto(page('shop.html'));
  fs.writeFileSync(path.join(out, 'shop-page-source.html'), await tab.content());
  await browser.close();
})();
