// Draws the screens the Playwright tests show as baseline, current and diff: flat boxes of a
// made-up app, 1280×720, so the tests carry no screenshot of anyone else's product.
//
//   node integration_tests/images/generate.mjs
//
// Node only (zlib), no packages. Same output every run.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const WIDTH = 1280;
const HEIGHT = 720;
const here = dirname(fileURLToPath(import.meta.url));

function canvas(background) {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set(background, i);
  return pixels;
}

function box(pixels, x, y, w, h, rgba) {
  for (let row = y; row < Math.min(HEIGHT, y + h); row++) {
    for (let col = x; col < Math.min(WIDTH, x + w); col++)
      pixels.set(rgba, (row * WIDTH + col) * 4);
  }
}

function png(pixels) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const rows = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
  for (let row = 0; row < HEIGHT; row++) {
    pixels.copy(
      rows,
      row * (WIDTH * 4 + 1) + 1,
      row * WIDTH * 4,
      (row + 1) * WIDTH * 4,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// a payment screen: top bar, a card, two fields, a button
function screen(buttonColour) {
  const pixels = canvas([246, 247, 249, 255]);
  box(pixels, 0, 0, WIDTH, 72, [33, 102, 69, 255]);
  box(pixels, 24, 22, 160, 28, [255, 255, 255, 255]);
  box(pixels, 340, 120, 600, 480, [255, 255, 255, 255]);
  box(pixels, 380, 160, 300, 28, [60, 64, 72, 255]);
  box(pixels, 380, 230, 520, 56, [228, 231, 236, 255]);
  box(pixels, 380, 310, 520, 56, [228, 231, 236, 255]);
  box(pixels, 380, 400, 240, 20, [150, 156, 166, 255]);
  box(pixels, 380, 500, 520, 64, buttonColour);
  return pixels;
}

const baseline = screen([33, 102, 69, 255]);
const current = screen([196, 62, 48, 255]);
// as pixelmatch draws one: the baseline faded to grey, the changed pixels red, no transparency
const diff = Buffer.from(baseline);
for (let i = 0; i < diff.length; i += 4) {
  const grey = Math.round(
    255 - (255 - (diff[i] + diff[i + 1] + diff[i + 2]) / 3) * 0.1,
  );
  diff.set([grey, grey, grey, 255], i);
}
box(diff, 380, 500, 520, 64, [255, 0, 0, 255]);

for (const [name, pixels] of [
  ["baseline.png", baseline],
  ["baseline1.png", baseline],
  ["baseline2.png", baseline],
  ["image.png", current],
  ["diff.png", diff],
]) {
  writeFileSync(join(here, name), png(pixels));
}
