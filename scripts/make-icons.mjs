// Draws the app icons: the game in one picture, a photo in interlocking pieces with one piece being
// dropped into its gap. Run with `node scripts/make-icons.mjs`.
import sharp from 'sharp';

const BACKGROUND = '#1f2442';
const BOARD = '#14182e';
const SEAM = '#1f2442';
const LEMON = '#f0f465';
const MAGENTA = '#d690ff';
const SEA = '#5563b0';
const WHITE = '#ffffff';

// The cut from src/engine/geometry.ts, with slightly deeper tabs so they read at small sizes.
const CELL = 100;
const SIZE = 2;
const DEPTH = 20;
const HANDLE = DEPTH * 0.5523;

function knob(ax, ay, bx, by, ox, oy, isTab) {
  const nx = isTab ? ox : -ox;
  const ny = isTab ? oy : -oy;
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

function pathFor({ t, r, b, l }) {
  let d = 'M 0 0 ';
  d += t === 0 ? 'L 100 0 ' : 'L 35 0 ' + knob(35, 0, 65, 0, 0, -1, t > 0) + 'L 100 0 ';
  d += r === 0 ? 'L 100 100 ' : 'L 100 35 ' + knob(100, 35, 100, 65, 1, 0, r > 0) + 'L 100 100 ';
  d += b === 0 ? 'L 0 100 ' : 'L 65 100 ' + knob(65, 100, 35, 100, 0, 1, b > 0) + 'L 0 100 ';
  d += l === 0 ? 'L 0 0 ' : 'L 0 65 ' + knob(0, 65, 0, 35, -1, 0, l > 0) + 'L 0 0 ';
  return d + 'Z';
}

// Neighbouring pieces share each edge: one's tab is the other's notch.
const rightEdge = (row, col) => (col === SIZE - 1 ? 0 : (row + col) % 2 ? -1 : 1);
const bottomEdge = (row, col) => (row === SIZE - 1 ? 0 : (row + col) % 2 ? 1 : -1);
const cutAt = (row, col) => ({
  t: row === 0 ? 0 : -bottomEdge(row - 1, col),
  r: rightEdge(row, col),
  b: bottomEdge(row, col),
  l: col === 0 ? 0 : -rightEdge(row, col - 1),
});

// The piece on its way in: it holds part of the sun, so it's clear where it goes.
const LIFTED = { row: 0, col: 1 };
const LIFT = { x: 30, y: -30 };
const ART = { x: 0, y: LIFT.y, width: CELL * SIZE + LIFT.x, height: CELL * SIZE - LIFT.y };

// Flat shapes only: anything finer disappears on a home screen.
const PICTURE = `
  <rect x="-40" y="-40" width="300" height="175" fill="${MAGENTA}"/>
  <circle cx="116" cy="88" r="56" fill="${LEMON}"/>
  <rect x="-40" y="135" width="300" height="105" fill="${SEA}"/>`;

function art(seam) {
  let defs = '';
  let body = `<rect width="${CELL * SIZE}" height="${CELL * SIZE}" fill="${BOARD}"/>`;
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (row === LIFTED.row && col === LIFTED.col) continue;
      const d = pathFor(cutAt(row, col));
      const at = `translate(${col * CELL} ${row * CELL})`;
      defs += `<clipPath id="p${row}${col}"><path d="${d}" transform="${at}"/></clipPath>`;
      body += `<g clip-path="url(#p${row}${col})">${PICTURE}</g>`;
      body += `<path d="${d}" transform="${at}" fill="none" stroke="${SEAM}" stroke-width="${seam}"/>`;
    }
  }
  const d = pathFor(cutAt(LIFTED.row, LIFTED.col));
  const home = `translate(${LIFTED.col * CELL} ${LIFTED.row * CELL})`;
  const lifted = `translate(${LIFT.x} ${LIFT.y})`;
  defs += `<clipPath id="lifted"><path d="${d}" transform="${home}"/></clipPath>`;
  // Its shadow, then the piece with its own slice of the photo and the white selection border.
  body += `<g transform="translate(${LIFT.x - 4} ${LIFT.y + 10})"><path d="${d}" transform="${home}" fill="${BOARD}" opacity="0.55"/></g>`;
  body += `<g transform="${lifted}"><g clip-path="url(#lifted)">${PICTURE}</g><path d="${d}" transform="${home}" fill="none" stroke="${WHITE}" stroke-width="${seam + 4}" stroke-linejoin="round"/></g>`;
  return { defs, body };
}

/** `fill` is the share of the canvas the artwork spans; `corner` rounds the background (0 = full bleed). */
function icon({ fill, corner, seam = 3 }) {
  const size = 1024;
  const scale = (fill * size) / ART.width;
  const x = size / 2 - (ART.x + ART.width / 2) * scale;
  const y = size / 2 - (ART.y + ART.height / 2) * scale;
  const { defs, body } = art(seam);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><defs>${defs}</defs>` +
      `<rect width="${size}" height="${size}" rx="${corner * size}" fill="${BACKGROUND}"/>` +
      `<g transform="translate(${x} ${y}) scale(${scale})">${body}</g>` +
      `</svg>`,
  );
}

const png = (svg, size, file) => sharp(svg, { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);

const rounded = icon({ fill: 0.74, corner: 0.22 });
await Promise.all([
  png(rounded, 192, 'public/icons/icon-192.png'),
  png(rounded, 512, 'public/icons/icon-512.png'),
  // Android crops maskable icons to as little as a circle 80% wide, so this art stays inside it.
  png(icon({ fill: 0.57, corner: 0 }), 512, 'public/icons/maskable-512.png'),
  // iOS rounds the corners itself and shows transparency as black.
  png(icon({ fill: 0.72, corner: 0 }), 180, 'public/icons/apple-touch-icon.png'),
  png(icon({ fill: 0.86, corner: 0.16, seam: 4 }), 48, 'assets/favicon.png'),
]);
