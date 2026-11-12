// Turns your own photos into daily puzzle images: frames each one (chooseCrop) and spreads similar
// ones apart in the day order (orderForVariety). Usage and workflow: photos-inbox/README.md.
//
//   node scripts/prepare-photos.mjs review   contact sheet of what each photo will look like
//   node scripts/prepare-photos.mjs add      add the inbox photos to the game
//   node scripts/prepare-photos.mjs list     rebuild src/puzzleImages.ts (the list and glow colours)
//
// Nothing here ships in the app; it only runs on your machine.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

import { setTimeout as sleep } from 'node:timers/promises';
sharp.cache(false);


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = path.join(ROOT, 'photos-inbox');
const REVIEW_DIR = path.join(INBOX, '.review');
const REVIEW_PAGE = path.join(INBOX, 'review.html');
const ADDED_DIR = path.join(INBOX, 'added');
const CROPS_FILE = path.join(INBOX, 'crops.json');
const PUZZLES_DIR = path.join(ROOT, 'assets', 'puzzles');
const CREDITS_FILE = path.join(PUZZLES_DIR, 'CREDITS.md');
const IMAGE_LIST_FILE = path.join(ROOT, 'src', 'puzzleImages.ts');

// Must match src/engine/constants.ts: a 6×4 board of square cells, so images are 3:2.
const COLS = 6;
const ROWS = 4;
const OUT_WIDTH = 1280;
const OUT_HEIGHT = 853;
const JPEG_QUALITY = 82;

// Detail is the average brightness change between neighbouring pixels in a cell (0–255 scale),
// measured on a small greyscale copy. Below this a cell is "blank": its piece is guesswork.
const BLANK_CELL_DETAIL = 3;
// More blank cells than this and the photo is flagged (it can still be added).
const MAX_BLANK_CELLS = 4;
// A crop keeping less of the photo than this is flagged, so you can check what was lost. A portrait
// photo's landscape slice keeps about half, so it's always flagged for a look.
const MIN_KEPT_SHARE = 0.55;

const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

async function inboxPhotos() {
  const entries = await readdir(INBOX, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name !== 'README.md' && e.name !== 'crops.json' && e.name !== 'review.html');
  const photos = files.filter((e) => SUPPORTED.has(path.extname(e.name).toLowerCase())).map((e) => e.name);
  const unsupported = files.filter((e) => !SUPPORTED.has(path.extname(e.name).toLowerCase())).map((e) => e.name);
  const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true });
  return { photos: photos.sort(byName), unsupported: unsupported.sort(byName) };
}

async function loadCrops() {
  if (!existsSync(CROPS_FILE)) return {};
  try {
    return JSON.parse(await readFile(CROPS_FILE, 'utf8'));
  } catch (e) {
    throw new Error(`photos-inbox/crops.json isn't valid JSON: ${e.message}`);
  }
}

// Automatic framing (see chooseCrop). The crop is searched on a small greyscale copy sized so the
// widest possible 3:2 frame is ANALYSIS_WIDTH pixels: then a full-size frame's cells are 48 px, the
// same scale measureCells uses, so BLANK_CELL_DETAIL means the same thing in both.
const ANALYSIS_WIDTH = COLS * 48;
// How far it may zoom in: 1 is the widest 3:2 frame, 0.78 shows 78% of its width.
const ZOOMS = [1, 0.92, 0.85, 0.78];
// Score weights. Fewer blank pieces matters most (it's what makes a photo playable); the rest keep
// the framing natural: zooming in, drifting off-centre and slicing through strong detail at the
// frame edge each cost something, so the crop only moves or tightens when it clearly pays.
const WEIGHT = { blankCell: 1, interest: 0.6, zoom: 5, offCentre: 2.5, edgeCut: 0.8 };

/** Gradient strength of a small greyscale copy, with a fast mean over any rectangle. */
async function detailMap(input, width, height, frameWidth) {
  const w = Math.max(COLS * 8, Math.round((ANALYSIS_WIDTH * width) / frameWidth));
  const h = Math.max(ROWS * 8, Math.round((w * height) / width));
  const px = await sharp(input).rotate().greyscale().resize(w, h, { fit: 'fill' }).raw().toBuffer();
  // Summed-area table: sum[(y + 1) * (w + 1) + x + 1] is the total gradient in [0, x] × [0, y].
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      row += (x < w - 1 ? Math.abs(px[i + 1] - px[i]) : 0) + (y < h - 1 ? Math.abs(px[i + w] - px[i]) : 0);
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row;
    }
  }
  const at = (x, y) => sum[y * (w + 1) + x];
  const mean = (x0, y0, x1, y1) => {
    const a = Math.max(0, Math.round(x0));
    const b = Math.max(0, Math.round(y0));
    const c = Math.min(w, Math.round(x1));
    const d = Math.min(h, Math.round(y1));
    if (c <= a || d <= b) return 0;
    return (at(c, d) - at(c, b) - at(a, d) + at(a, b)) / ((c - a) * (d - b));
  };
  return { w, h, mean };
}

/**
 * Picks the 3:2 frame that makes the best puzzle without looking cropped: it tries positions across
 * the photo at a few zoom levels and scores each. Returns the frame as fractions of the photo.
 */
async function chooseCrop(input, width, height) {
  const ratio = COLS / ROWS;
  const frameWidth = width / height > ratio ? height * ratio : width; // widest 3:2 frame, photo px
  const map = await detailMap(input, width, height, frameWidth);
  const whole = map.mean(0, 0, map.w, map.h) || 1;
  const baseW = width / height > ratio ? map.h * ratio : map.w;
  let best = null;
  for (const zoom of ZOOMS) {
    // Never zoom so far that the photo has to be enlarged to fill the image.
    if (zoom < 1 && frameWidth * zoom < OUT_WIDTH) continue;
    const fw = baseW * zoom;
    const fh = fw / ratio;
    const stepsX = Math.max(1, Math.round((map.w - fw) / 3));
    const stepsY = Math.max(1, Math.round((map.h - fh) / 3));
    const cw = fw / COLS;
    const ch = fh / ROWS;
    for (let sy = 0; sy <= stepsY; sy++) {
      for (let sx = 0; sx <= stepsX; sx++) {
        const x = Math.max(0, ((map.w - fw) * sx) / stepsX);
        const y = Math.max(0, ((map.h - fh) * sy) / stepsY);
        let blank = 0;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (map.mean(x + c * cw, y + r * ch, x + (c + 1) * cw, y + (r + 1) * ch) < BLANK_CELL_DETAIL) blank++;
          }
        }
        const inside = map.mean(x, y, x + fw, y + fh);
        // Strong detail just outside an edge means the frame slices through something (a peak, a roof).
        const band = Math.max(2, fh / 24);
        const outside = [
          map.mean(x, y - band, x + fw, y),
          map.mean(x, y + fh, x + fw, y + fh + band),
          map.mean(x - band, y, x, y + fh),
          map.mean(x + fw, y, x + fw + band, y + fh),
        ];
        const edgeCut = outside.reduce((t, o) => t + Math.max(0, o - inside), 0) / whole;
        const offCentre = Math.hypot((x + fw / 2) / map.w - 0.5, (y + fh / 2) / map.h - 0.5);
        const score =
          -WEIGHT.blankCell * blank +
          WEIGHT.interest * (inside / whole) -
          WEIGHT.zoom * (1 - zoom) -
          WEIGHT.offCentre * offCentre -
          WEIGHT.edgeCut * edgeCut;
        if (!best || score > best.score) best = { score, x: x / map.w, y: y / map.h, w: fw / map.w, h: fh / map.h, zoom, blank };
      }
    }
  }
  return best;
}

/**
 * Crops a photo to 3:2, resizes it and strips all metadata. The frame is chosen automatically
 * (chooseCrop) unless crops.json gives a number for the photo: then it's the widest 3:2 frame,
 * placed by that number (0 = top/left edge, 1 = bottom/right, 0.5 = centre). Returns the JPEG plus
 * what the review needs.
 */
async function prepare(file, manualFocus) {
  const input = await readFile(file); // own the bytes; sharp never holds the path open

  const meta = await sharp(input).metadata();
  // EXIF orientations 5–8 are stored sideways: the displayed width is the stored height.
  const sideways = (meta.orientation ?? 1) >= 5;
  const width = sideways ? meta.height : meta.width;
  const height = sideways ? meta.width : meta.height;

  const ratio = COLS / ROWS;
  let crop;
  let auto = null;
  if (manualFocus !== undefined) {
    const f = Math.min(1, Math.max(0, Number(manualFocus)));
    crop =
      width / height > ratio
        ? { width: Math.round(height * ratio), height, top: 0 }
        : { width, height: Math.round(width / ratio), left: 0 };
    crop.left ??= Math.round((width - crop.width) * f);
    crop.top ??= Math.round((height - crop.height) * f);
  } else {
    auto = await chooseCrop(input, width, height);
    const cw = Math.min(width, Math.round(auto.w * width));
    const ch = Math.min(height, Math.round(cw / ratio));
    crop = {
      width: cw,
      height: ch,
      left: Math.min(width - cw, Math.max(0, Math.round(auto.x * width))),
      top: Math.min(height - ch, Math.max(0, Math.round(auto.y * height))),
    };
  }

  // rotate() with no angle applies the EXIF orientation first, so the crop is of the photo as seen.
  // sharp drops all metadata (EXIF, GPS, camera details) unless told to keep it.
  const jpeg = await sharp(input)
    .rotate()
    .extract(crop)
    .resize(OUT_WIDTH, OUT_HEIGHT, { fit: 'fill' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  const cellDetail = await measureCells(jpeg);
  const blankCells = cellDetail.map((d, i) => (d < BLANK_CELL_DETAIL ? i : -1)).filter((i) => i >= 0);
  const kept = (crop.width * crop.height) / (width * height);

  const flags = [];
  if (blankCells.length > MAX_BLANK_CELLS) flags.push(`${blankCells.length} of ${COLS * ROWS} areas have almost no detail`);
  if (crop.width < OUT_WIDTH) flags.push(`only ${crop.width}px wide after cropping, so it's upscaled and may look soft`);
  if (kept < MIN_KEPT_SHARE) flags.push(`the crop keeps ${Math.round(kept * 100)}% of the photo`);

  return { input, jpeg, original: { width, height }, crop, kept, auto, cellDetail, blankCells, flags };
}

/** Average neighbour-to-neighbour brightness change in each cell, row by row from the top-left. */
async function measureCells(jpeg) {
  const cellPx = 48;
  const w = COLS * cellPx;
  const h = ROWS * cellPx;
  const px = await sharp(jpeg).greyscale().resize(w, h, { fit: 'fill' }).raw().toBuffer();
  const detail = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let sum = 0;
      let n = 0;
      for (let y = r * cellPx; y < (r + 1) * cellPx - 1; y++) {
        for (let x = c * cellPx; x < (c + 1) * cellPx - 1; x++) {
          const i = y * w + x;
          sum += Math.abs(px[i + 1] - px[i]) + Math.abs(px[i + w] - px[i]);
          n++;
        }
      }
      detail.push(sum / n);
    }
  }
  return detail;
}

// Day order (see orderForVariety). New photos are shuffled so similar ones land far apart: photos
// from the same few days (one trip, one theme) and photos that look alike (all beach, all forest).
// How many days back a new photo is compared with; nearer days count more.
const VARIETY_WINDOW = 10;
// Photos taken this many days apart count as half "the same trip".
const TRIP_HALF_LIFE_DAYS = 4;

/** The date in a file name like PXL_20250903_102318437.jpg or 2015-05-18.jpg, as a day number. */
function dayFromName(name) {
  const m = /(20\d\d|19\d\d)[-_]?(\d\d)[-_]?(\d\d)/.exec(name);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d) / 86_400_000;
}

/** A small description of how a finished puzzle image looks: its layout of colours and its palette. */
async function fingerprint(jpeg) {
  const W = 12;
  const H = 8;
  const px = await sharp(jpeg).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const layout = Array.from(px, (v) => v / 255);
  const hues = new Array(12).fill(0);
  let light = 0;
  for (let i = 0; i < px.length; i += 3) {
    const { h, s, l } = toHsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
    hues[Math.floor(h / 30) % 12] += s;
    light += l;
  }
  const hueTotal = hues.reduce((a, b) => a + b, 0) || 1;
  return { layout, palette: [...hues.map((v) => v / hueTotal), (light / (W * H)) * 2] };
}

const distance = (a, b) => Math.sqrt(a.reduce((t, v, i) => t + (v - b[i]) ** 2, 0) / a.length);

/**
 * How alike each pair of photos is, 0–1: same trip (dates close together) or same look. Visual
 * distances are scaled by their median across the set, so "alike" is judged relative to the batch.
 */
function similarities(items) {
  const n = items.length;
  const look = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      look.push(distance(items[i].print.layout, items[j].print.layout) + distance(items[i].print.palette, items[j].print.palette));
    }
  }
  const sorted = [...look].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const sim = Array.from({ length: n }, () => new Float64Array(n));
  let k = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const visual = Math.pow(0.5, (look[k++] / median) ** 2); // 0.5 at the median distance
      const a = items[i].day;
      const b = items[j].day;
      const trip = a === null || b === null ? 0 : Math.pow(0.5, Math.abs(a - b) / TRIP_HALF_LIFE_DAYS);
      sim[i][j] = sim[j][i] = 1 - (1 - 0.8 * trip) * (1 - visual);
    }
  }
  return sim;
}

/**
 * Orders the new photos for variety. `fixed` are the last few photos already in the game (they
 * keep their days); `fresh` are the new ones. Returns the new ones in day order. Deterministic:
 * the same inbox always gives the same order.
 */
function orderForVariety(fixed, fresh) {
  if (fresh.length < 2) return fresh;
  const items = [...fixed, ...fresh];
  const sim = similarities(items);
  const start = fixed.length;
  // How much a sequence makes players see similar photos close together: lower is better.
  const costAt = (seq, i) => {
    let c = 0;
    for (let k = 1; k <= VARIETY_WINDOW && i - k >= 0; k++) c += sim[seq[i]][seq[i - k]] / k;
    return c;
  };
  const total = (seq) => seq.reduce((t, _, i) => t + (i >= start ? costAt(seq, i) : 0), 0);

  // Greedy first: each day takes the photo least like the days just before it.
  const seq = items.slice(0, start).map((_, i) => i);
  const left = new Set(fresh.map((_, i) => start + i));
  while (left.size) {
    let best = -1;
    let bestCost = Infinity;
    for (const c of left) {
      seq.push(c);
      const cost = costAt(seq, seq.length - 1);
      seq.pop();
      if (cost < bestCost - 1e-12) {
        best = c;
        bestCost = cost;
      }
    }
    seq.push(best);
    left.delete(best);
  }

  // Then tidy up: greedy leaves the hardest photos bunched at the end, so try swapping pairs.
  const random = mulberry32(seq.length * 7919);
  let cost = total(seq);
  const n = seq.length - start;
  for (let step = 0; step < 4000 * Math.max(1, Math.ceil(n / 20)); step++) {
    const i = start + Math.floor(random() * n);
    const j = start + Math.floor(random() * n);
    if (i === j) continue;
    [seq[i], seq[j]] = [seq[j], seq[i]];
    const next = total(seq);
    if (next < cost) cost = next;
    else [seq[i], seq[j]] = [seq[j], seq[i]];
  }
  return seq.slice(start).map((i) => items[i]);
}

/** A small seeded generator, so the order doesn't change between a review and the add. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The last VARIETY_WINDOW photos already in the game, with what the ordering needs. */
async function recentPuzzles() {
  const files = (await readdir(PUZZLES_DIR)).filter((f) => /^\d{4}\.jpg$/.test(f)).sort().slice(-VARIETY_WINDOW);
  const credits = existsSync(CREDITS_FILE) ? await readFile(CREDITS_FILE, 'utf8') : '';
  const out = [];
  for (const file of files) {
    // The credits line keeps the original file name, which carries the date.
    const line = credits.split('\n').find((l) => l.startsWith(`| ${file} |`)) ?? '';
    const original = /\(([^)]+)\)/.exec(line)?.[1] ?? '';
    out.push({ name: file, day: dayFromName(original), print: await fingerprint(await readFile(path.join(PUZZLES_DIR, file))) });
  }
  return out;
}

async function review() {
  const { photos, unsupported } = await inboxPhotos();
  if (photos.length === 0 && unsupported.length === 0) return console.log('The inbox is empty: copy some photos into photos-inbox/ first.');
  const crops = await loadCrops();
  await rm(REVIEW_DIR, { recursive: true, force: true });
  await mkdir(REVIEW_DIR, { recursive: true });

  const results = [];
  for (const name of photos) {
    try {
      const p = await prepare(path.join(INBOX, name), crops[name]);
      if (!p.skip) {
        const thumb = `${path.parse(name).name}.jpg`;
        await sharp(p.jpeg).resize(640).jpeg({ quality: 80 }).toFile(path.join(REVIEW_DIR, thumb));
        p.thumb = `.review/${thumb}`;
        const whole = `${path.parse(name).name}-whole.jpg`;
        await framedOriginal(p).toFile(path.join(REVIEW_DIR, whole));
        p.whole = `.review/${whole}`;
      }
      delete p.input;
      results.push({ name, ...p });
    } catch (e) {
      results.push({ name, skip: `couldn't read it (${e.message.split('\n')[0]}); convert it to JPEG` });
    }
  }
  for (const name of unsupported) results.push({ name, skip: 'not a supported image type; convert it to JPEG' });

  // Show the usable photos in the order `add` will give them, with their day numbers.
  const usable = results.filter((r) => !r.skip);
  for (const r of usable) Object.assign(r, { day: dayFromName(r.name), print: await fingerprint(r.jpeg) });
  const firstDay = (await readdir(PUZZLES_DIR)).filter((f) => /^\d{4}\.jpg$/.test(f)).length + 1;
  const ordered = orderForVariety(await recentPuzzles(), usable);
  ordered.forEach((r, i) => (r.dayNumber = firstDay + i));
  const shown = [...ordered, ...results.filter((r) => r.skip)];

  await writeFile(REVIEW_PAGE, reviewPage(shown, crops));
  const ready = results.filter((r) => !r.skip && r.flags.length === 0).length;
  const flagged = results.filter((r) => !r.skip && r.flags.length > 0);
  const skipped = results.filter((r) => r.skip);
  console.log(`${results.length} files: ${ready} ready, ${flagged.length} flagged, ${skipped.length} can't be used.`);
  for (const r of flagged) console.log(`  flagged  ${r.name}: ${r.flags.join('; ')}`);
  for (const r of skipped) console.log(`  skipped  ${r.name}: ${r.skip}`);
  console.log(`\nOpen ${pathToFileURL(REVIEW_PAGE).href}`);
}

/** The whole photo, small, with the chosen frame outlined and the cut-away parts dimmed. */
function framedOriginal(p) {
  const scale = 320 / Math.max(p.original.width, p.original.height);
  const w = Math.round(p.original.width * scale);
  const h = Math.round(p.original.height * scale);
  const c = { x: p.crop.left * scale, y: p.crop.top * scale, w: p.crop.width * scale, h: p.crop.height * scale };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <path fill="rgba(0,0,0,0.6)" fill-rule="evenodd" d="M0 0H${w}V${h}H0Z M${c.x} ${c.y}h${c.w}v${c.h}h${-c.w}Z"/>
    <rect x="${c.x + 1}" y="${c.y + 1}" width="${c.w - 2}" height="${c.h - 2}" fill="none" stroke="#f0f465" stroke-width="2"/>
  </svg>`;
  return sharp(p.input).rotate().resize(w, h, { fit: 'fill' }).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 78 });
}

async function moveFile(src, dest, { retries = 10, delayMs = 100 } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await rename(src, dest);
      return;
    } catch (err) {
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) throw err;
      if (attempt === retries - 1) {
        await copyFile(src, dest);
        await unlink(src);
        return;
      }
      await sleep(delayMs * (attempt + 1));
    }
  }
}
async function add() {
  const { photos, unsupported } = await inboxPhotos();
  if (photos.length === 0) return console.log('No photos in photos-inbox/ to add.');

  const crops = await loadCrops();
  const existing = (await readdir(PUZZLES_DIR)).filter((f) => /^\d{4}\.jpg$/.test(f));
  let next = existing.reduce((max, f) => Math.max(max, Number(f.slice(0, 4))), 0) + 1;
  const author = process.env.PHOTO_AUTHOR || gitUserName();
  await mkdir(ADDED_DIR, { recursive: true });

  // Prepare every photo first, so the day order can be chosen across the whole batch.
  const ready = [];
  for (const name of photos) {
    const src = path.join(INBOX, name);
    let p;
    try {
      p = await prepare(src, crops[name]);
    } catch (e) {
      console.log(`  skipped  ${name}: couldn't read it (${e.message.split('\n')[0]})`);
      continue;
    }
    if (p.skip) {
      console.log(`  skipped  ${name}: ${p.skip}`);
      continue;
    }
    ready.push({ name, src, jpeg: p.jpeg, flags: p.flags, day: dayFromName(name), print: await fingerprint(p.jpeg) });
  }
  const ordered = orderForVariety(await recentPuzzles(), ready);

  const credits = [];
  for (const { name, src, jpeg, flags } of ordered) {
    const file = `${String(next).padStart(4, '0')}.jpg`;

    // Write the processed image first; only claim the number and move the
    // original once that succeeds, so a mid-run failure can't desync them.
    try {
      await writeFile(path.join(PUZZLES_DIR, file), jpeg);
      await moveFile(src, path.join(ADDED_DIR, name));
    } catch (e) {
      console.log(`  skipped  ${name}: couldn't save/move it (${e.message.split('\n')[0]})`);
      continue;
    }

    next++;
    credits.push(`| ${file} | Own photo (${name}) | ${author} | © ${author}, all rights reserved |`);
    console.log(`  added    ${name} → assets/puzzles/${file}${flags.length ? `  (note: ${flags.join('; ')})` : ''}`);
  }

  for (const name of unsupported) {
    console.log(`  skipped  ${name}: not a supported image type; convert it to JPEG`);
  }
  if (credits.length === 0) return;

  const creditsText = await readFile(CREDITS_FILE, 'utf8');
  await writeFile(CREDITS_FILE, creditsText.trimEnd() + '\n' + credits.join('\n') + '\n');
  const total = await writeImageList();
  console.log(`\nAdded ${credits.length}; the game now has ${total} daily images. Commit and push to main to publish.`);
}

function toHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `${f(0)}, ${f(8)}, ${f(4)}`;
}

const HUE_BINS = 12;
const HUE_WIDTH = 360 / HUE_BINS;
// Glows must stay colourful whatever the photo, or a pale beach gives a grey background.
const GLOW_SATURATION = { min: 0.6, max: 0.9 };
const GLOW_LIGHTNESS = 0.58;
// Used when a photo has almost no colour in it.
const FALLBACK_HUES = [255, 220, 290];

/** The photo's three main colours, strongest first, each as "r, g, b". Only colour: no layout. */
async function glowColours(file) {
  const px = await sharp(file).resize(48, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const bins = Array.from({ length: HUE_BINS }, (_, bin) => ({ bin, weight: 0, x: 0, y: 0, s: 0 }));
  for (let i = 0; i < px.length; i += 3) {
    const { h, s, l } = toHsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
    if (s < 0.12 || l < 0.1 || l > 0.92) continue;
    const b = bins[Math.floor(h / HUE_WIDTH) % HUE_BINS];
    b.weight += s;
    b.s += s * s;
    b.x += s * Math.cos((h * Math.PI) / 180);
    b.y += s * Math.sin((h * Math.PI) / 180);
  }
  const found = [];
  for (const b of bins.filter((b) => b.weight > 0).sort((p, q) => q.weight - p.weight || p.bin - q.bin)) {
    const apart = (o) => Math.min((b.bin - o.bin + HUE_BINS) % HUE_BINS, (o.bin - b.bin + HUE_BINS) % HUE_BINS) >= 2;
    if (found.length < 3 && found.every(apart)) found.push(b);
  }
  const colours = found.map((b) => {
    const s = Math.min(GLOW_SATURATION.max, Math.max(GLOW_SATURATION.min, (b.s / b.weight) * 1.3));
    return { h: ((Math.atan2(b.y, b.x) * 180) / Math.PI + 360) % 360, s };
  });
  if (colours.length === 0) return FALLBACK_HUES.map((h) => hslToRgb(h, GLOW_SATURATION.min, GLOW_LIGHTNESS));
  // One-colour photos (blue sky and white cloud) get neighbours of that colour.
  const base = colours[0];
  while (colours.length < 3) colours.push({ h: (base.h + (colours.length === 1 ? 35 : 325)) % 360, s: base.s });
  return colours.map((c) => hslToRgb(c.h, c.s, GLOW_LIGHTNESS));
}

/** Rebuilds src/puzzleImages.ts from assets/puzzles/NNNN.jpg, in number order (= day order). */
async function writeImageList() {
  const files = (await readdir(PUZZLES_DIR)).filter((f) => /^\d{4}\.jpg$/.test(f)).sort();
  const lines = files.map((f) => `  require('../assets/puzzles/${f}'),`).join('\n');
  const glowLines = [];
  for (const f of files) {
    const glows = await glowColours(path.join(PUZZLES_DIR, f));
    glowLines.push(`  [${glows.map((g) => `'${g}'`).join(', ')}],`);
  }
  await writeFile(
    IMAGE_LIST_FILE,
    `// Generated by scripts/prepare-photos.mjs from assets/puzzles/NNNN.jpg. Add images with \`npm run photos:add\`.
import type { ImageSourcePropType } from 'react-native';

/** Daily images, used in order and then repeated. All are 3:2. Credits: assets/puzzles/CREDITS.md. */
export const PUZZLE_IMAGES: ImageSourcePropType[] = [
${lines}
];

/** The background glows for each image above, as "r, g, b": its three main colours. */
export const PUZZLE_GLOWS: [string, string, string][] = [
${glowLines.join('\n')}
];
`,
  );
  return files.length;
}

function gitUserName() {
  try {
    return execSync('git config user.name', { cwd: ROOT }).toString().trim() || 'the owner';
  } catch {
    return 'the owner';
  }
}

const escape = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

function reviewPage(results, crops) {
  const cards = results
    .map((r) => {
      if (r.skip) return `<article class="card skip"><h2>${escape(r.name)}</h2><p class="bad">Can't be used: ${escape(r.skip)}</p></article>`;
      const cells = r.cellDetail
        .map((d, i) => `<span class="${r.blankCells.includes(i) ? 'blank' : ''}" title="detail ${d.toFixed(1)}"></span>`)
        .join('');
      const how = crops[r.name] !== undefined ? `your crops.json focus ${crops[r.name]}` : r.auto && r.auto.zoom < 1 ? `auto, zoomed to ${Math.round(r.auto.zoom * 100)}%` : 'auto';
      const cropNote = r.kept > 0.999 ? 'Fits 3:2 exactly.' : `Crop keeps ${Math.round(r.kept * 100)}% (${how}).`;
      const status = r.flags.length ? `<p class="bad">${r.flags.map(escape).join('<br>')}</p>` : '<p class="good">Ready.</p>';
      return `<article class="card${r.flags.length ? ' flagged' : ''}">
  <div class="pair"><div class="whole"><img src="${escape(r.whole)}" alt="The whole photo with the crop outlined"></div>
  <div class="frame"><img src="${escape(r.thumb)}" alt=""><div class="grid">${cells}</div></div></div>
  <h2>Day ${r.dayNumber} · ${escape(r.name)}</h2>
  <p>${r.original.width}×${r.original.height} · ${cropNote} · ${r.blankCells.length} blank area${r.blankCells.length === 1 ? '' : 's'}</p>
  ${status}
</article>`;
    })
    .join('\n');
  const flagged = results.filter((r) => !r.skip && r.flags.length).length;
  const skipped = results.filter((r) => r.skip).length;
  return `<!doctype html>
<meta charset="utf-8">
<title>Photo review</title>
<style>
  body { margin: 0; padding: 24px; background: #0e141c; color: #e9eef4; font: 14px/1.45 system-ui, sans-serif; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .summary { color: #8797a8; margin: 0 0 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(460px, 1fr)); gap: 16px; }
  .pair { display: grid; grid-template-columns: 2fr 3fr; gap: 8px; align-items: center; }
  .whole img { width: 100%; display: block; border-radius: 6px; }
  .card { background: #17212e; border: 1px solid #2a3a4d; border-radius: 12px; padding: 12px; }
  .card.flagged { border-color: #c9791a; }
  .card.skip { border-color: #ff5f6b; }
  .frame { position: relative; aspect-ratio: 3 / 2; border-radius: 6px; overflow: hidden; background: #111a24; }
  .frame img { width: 100%; height: 100%; display: block; }
  .grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(${COLS}, 1fr); grid-template-rows: repeat(${ROWS}, 1fr); }
  .grid span { box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.45); }
  .grid span.blank { background: rgba(255, 95, 107, 0.4); box-shadow: inset 0 0 0 1.5px #ff5f6b; }
  h2 { font-size: 14px; margin: 10px 0 2px; word-break: break-all; }
  p { margin: 2px 0; color: #8797a8; }
  .good { color: #5fd08a; }
  .bad { color: #ff9aa2; }
</style>
<h1>Photo review</h1>
<p class="summary">${results.length} files · ${results.length - flagged - skipped} ready · ${flagged} flagged · ${skipped} can't be used.
Photos are in the order they'll be added, shuffled so similar ones (same trip, same look) are far apart; the day numbers count from the first day of the photo list. Left: the whole photo, with the chosen frame outlined. Right: the puzzle as it will look. The frame is picked automatically to leave the fewest blank pieces while keeping the framing natural.
Red areas have almost no detail (plain sky, snow, water, fog), so their pieces are close to guesswork. To place a frame yourself, put the photo in <code>crops.json</code> (0 = top or left, 1 = bottom or right). Delete photos you don't want, then run <code>npm run photos:add</code>.</p>
<div class="cards">
${cards}
</div>
`;
}

const mode = process.argv[2];
if (mode === 'review') await review();
else if (mode === 'add') await add();
else if (mode === 'list') console.log(`${await writeImageList()} images listed.`);
else {
  console.log('Usage: node scripts/prepare-photos.mjs review|add|list   (see photos-inbox/README.md)');
  process.exitCode = 1;
}
