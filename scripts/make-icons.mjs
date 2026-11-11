// Draws the app icons from the brand (see "Brand" in CLAUDE.md): a dark lowercase j on lemon, with
// a jigsaw piece for its dot. The j's outline comes from scripts/icon-j.json, traced from the
// bundled font by scripts/make-wordmark.py. The browser-tab icon is too small for the j, so it's
// the piece alone. Run with `node scripts/make-icons.mjs`.
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const LEMON = '#f0f465';
const INK = '#141834';

const J = JSON.parse(readFileSync(new URL('./icon-j.json', import.meta.url), 'utf8'));

// The piece outline from src/engine/geometry.ts (TAB_DEPTH 14), tabs out on top and to the right.
const DEPTH = 14;
const HANDLE = DEPTH * 0.5523;
function knob(ax, ay, bx, by, nx, ny) {
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const apx = (ax + bx) / 2 + nx * DEPTH;
  const apy = (ay + by) / 2 + ny * DEPTH;
  return (
    `C ${ax + nx * HANDLE} ${ay + ny * HANDLE} ${apx - ux * HANDLE} ${apy - uy * HANDLE} ${apx} ${apy} ` +
    `C ${apx + ux * HANDLE} ${apy + uy * HANDLE} ${bx + nx * HANDLE} ${by + ny * HANDLE} ${bx} ${by} `
  );
}
const PIECE = `M 0 0 L 35 0 ${knob(35, 0, 65, 0, 0, -1)}L 100 0 L 100 35 ${knob(100, 35, 100, 65, 1, 0)}L 100 100 L 0 100 Z`;
/** The middle of the piece including its tabs, which reach 14 past the box on top and right. */
const PIECE_CENTRE = { x: 57, y: 43 };

/** The j and its piece, as one group in font units, with its bounding box. */
function letter() {
  const scale = (J.dot.size * 1.25) / 100;
  const piece = `<g transform="translate(${J.dot.cx - PIECE_CENTRE.x * scale} ${J.dot.cy - PIECE_CENTRE.y * scale}) scale(${scale})"><path d="${PIECE}" fill="${INK}"/></g>`;
  const top = J.dot.cy - (PIECE_CENTRE.y + DEPTH) * scale;
  const [x0, , x1, y1] = J.bounds;
  const right = Math.max(x1, J.dot.cx + (114 - PIECE_CENTRE.x) * scale);
  return { body: `<path d="${J.path}" fill="${INK}"/>${piece}`, box: { x: x0, y: top, width: right - x0, height: y1 - top } };
}

/** `fill` is the share of the canvas the j's height spans; `corner` rounds the background (0 = full bleed). */
function icon({ fill, corner }) {
  const size = 1024;
  const { body, box } = letter();
  const scale = (fill * size) / box.height;
  const x = size / 2 - (box.x + box.width / 2) * scale;
  const y = size / 2 - (box.y + box.height / 2) * scale;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" rx="${corner * size}" fill="${LEMON}"/>` +
      `<g transform="translate(${x} ${y}) scale(${scale})">${body}</g></svg>`,
  );
}

/** Just the piece, big: at 16–48 px the j's dot would blur into a blob. */
function tabIcon() {
  const size = 1024;
  const scale = 7;
  const x = size / 2 - PIECE_CENTRE.x * scale;
  const y = size / 2 - PIECE_CENTRE.y * scale;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" rx="${0.22 * size}" fill="${LEMON}"/>` +
      `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${PIECE}" fill="${INK}"/></g></svg>`,
  );
}

const png = (svg, size, file) => sharp(svg, { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);

const rounded = icon({ fill: 0.7, corner: 0.22 });
await Promise.all([
  png(rounded, 192, 'public/icons/icon-192.png'),
  png(rounded, 512, 'public/icons/icon-512.png'),
  // Android crops maskable icons to as little as a circle 80% wide, so the j stays inside it.
  png(icon({ fill: 0.56, corner: 0 }), 512, 'public/icons/maskable-512.png'),
  // iOS rounds the corners itself and shows transparency as black.
  png(icon({ fill: 0.68, corner: 0 }), 180, 'public/icons/apple-touch-icon.png'),
  png(tabIcon(), 48, 'assets/favicon.png'),
]);
