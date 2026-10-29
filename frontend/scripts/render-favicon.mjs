// Renders public/favicon.svg to the PNG fallback (browsers without SVG icons,
// bookmarks, chat previews). Run after changing the mark:
//   node scripts/render-favicon.mjs
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../public/", import.meta.url);
const svg = await readFile(new URL("favicon.svg", root), "utf8");
const browser = await chromium.launch();
try {
  for (const [name, size] of [["favicon.png", 64], ["apple-touch-icon.png", 180]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
    );
    await page.screenshot({ path: fileURLToPath(new URL(name, root)), omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
