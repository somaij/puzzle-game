// Draws the link-preview image (public/og-image.png, 1200×630): the card LinkedIn, iMessage,
// WhatsApp and others show when someone posts a jigsup.fun link. The Jigsup wordmark (paths from
// src/ui/wordmarkPaths.ts) and the tagline on the game's indigo, with a few jigsaw pieces around
// it. Run with `node scripts/make-share-image.mjs`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const W = 1200;
const H = 630;
const BACKGROUND = '#1f2442';
const SURFACE = '#313b72';
const TEXT = '#eff1fb';
const LEMON = '#f0f465';
const TAGLINE = 'One jigsaw a day. Miss twelve and the jig is up.';

const file = (relative) => fileURLToPath(new URL(relative, import.meta.url));

// The wordmark's generated paths, read from the TypeScript module the game uses.
const source = readFileSync(file('../src/ui/wordmarkPaths.ts'), 'utf8');
const field = (name) => new RegExp(`${name}: '([^']+)'`).exec(source)[1];
const number = (name) => Number(new RegExp(`${name}: (\\d+)`).exec(source)[1]);
const WORDMARK = {
  width: number('width'),
  jigs: field('jigs'),
  up: field('up'),
  dot: { cx: number('cx'), cy: number('cy'), size: number('size') },
};

// The piece outline from src/engine/geometry.ts (TAB_DEPTH 14).
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

/** A piece in a 100 box. `tabs` is each side's tab, 1 out, -1 in, 0 flat: top, right, bottom, left. */
function piecePath([top, right, bottom, left]) {
  const side = (ax, ay, bx, by, nx, ny, t) => {
    if (!t) return `L ${bx} ${by} `;
    const x = (k) => ax + (bx - ax) * k;
    const y = (k) => ay + (by - ay) * k;
    return `L ${x(0.35)} ${y(0.35)} ${knob(x(0.35), y(0.35), x(0.65), y(0.65), nx * t, ny * t)}L ${bx} ${by} `;
  };
  return (
    'M 0 0 ' +
    side(0, 0, 100, 0, 0, -1, top) +
    side(100, 0, 100, 100, 1, 0, right) +
    side(100, 100, 0, 100, 0, 1, bottom) +
    side(0, 100, 0, 0, -1, 0, left) +
    'Z'
  );
}

/** A piece centred on (x, y), `size` px across its body, turned `angle` degrees. */
function piece(x, y, size, angle, tabs, fill) {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${size / 100}) translate(-50 -50)">` +
    `<path d="${piecePath(tabs)}" fill="${fill}"/></g>`
  );
}

// The wordmark, as the game draws it (Wordmark.tsx): its letters span y 170–1280 in font units.
const VIEW = { x: 0, y: 170, width: WORDMARK.width + 20, height: 1110 };
const MARK_WIDTH = 760;
const MARK_TOP = 150;
const markScale = MARK_WIDTH / VIEW.width;
const markHeight = VIEW.height * markScale;
const PIECE_CENTRE = { x: 57, y: 43 };
const dotScale = (WORDMARK.dot.size * 1.15) / 100;
const mark =
  `<g transform="translate(${(W - MARK_WIDTH) / 2 - VIEW.x * markScale} ${MARK_TOP - VIEW.y * markScale}) scale(${markScale})">` +
  `<path d="${WORDMARK.jigs}" fill="${TEXT}"/><path d="${WORDMARK.up}" fill="${LEMON}"/>` +
  `<g transform="translate(${WORDMARK.dot.cx - PIECE_CENTRE.x * dotScale} ${WORDMARK.dot.cy - PIECE_CENTRE.y * dotScale}) scale(${dotScale})">` +
  `<path d="${piecePath([1, 1, 0, 0])}" fill="${LEMON}"/></g></g>`;

// Loose pieces around the edges, as if tipped out of the box: quiet, so the name leads.
const scatter = [
  [80, 95, 120, -14, [1, -1, 1, 0]],
  [120, 575, 140, 10, [-1, 1, 0, 1]],
  [45, 350, 95, 28, [0, 1, -1, 1]],
  [1115, 110, 135, 18, [1, 0, -1, 1]],
  [1000, 545, 115, -22, [1, 1, -1, -1]],
  [1160, 375, 100, -8, [-1, 1, 1, 0]],
]
  .map(([x, y, size, angle, tabs]) => piece(x, y, size, angle, tabs, SURFACE))
  .join('');

const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${BACKGROUND}"/>${scatter}${mark}</svg>`,
);

// The tagline in the game's body font, Varela Round, from the bundled file.
const tagline = await sharp({
  text: {
    text: `<span foreground="${TEXT}">${TAGLINE}</span>`,
    font: 'Varela Round 30',
    fontfile: file('../assets/fonts/VarelaRound_400Regular.ttf'),
    rgba: true,
    dpi: 96,
  },
})
  .png()
  .toBuffer();
const { width: tw } = await sharp(tagline).metadata();

await sharp(svg)
  .composite([{ input: tagline, left: Math.round((W - tw) / 2), top: Math.round(MARK_TOP + markHeight + 50) }])
  .png({ compressionLevel: 9 })
  .toFile(file('../public/og-image.png'));
console.log(`public/og-image.png: ${W}×${H}`);
