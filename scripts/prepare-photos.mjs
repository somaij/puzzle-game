// Turns your own photos into daily puzzle images. Usage and workflow: photos-inbox/README.md.
//
//   node scripts/prepare-photos.mjs review   contact sheet of what each photo will look like
//   node scripts/prepare-photos.mjs add      add the inbox photos to the game
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
// A crop keeping less of the photo than this is flagged, so you can check what was lost.
const MIN_KEPT_SHARE = 0.75;

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

/**
 * Crops a photo to 3:2 around `focus` (0 = top/left edge, 1 = bottom/right, 0.5 = centre),
 * resizes it and strips all metadata. Returns the JPEG plus what the review needs.
 */
async function prepare(file, focus = 0.5) {
  const input = await readFile(file); // own the bytes; sharp never holds the path open

  const meta = await sharp(input).metadata();
  // EXIF orientations 5–8 are stored sideways: the displayed width is the stored height.
  const sideways = (meta.orientation ?? 1) >= 5;
  const width = sideways ? meta.height : meta.width;
  const height = sideways ? meta.width : meta.height;
  if (height > width) return { skip: `portrait (${width}×${height}); only landscape photos fit the board` };

  const ratio = COLS / ROWS;
  const f = Math.min(1, Math.max(0, Number(focus)));
  const crop =
    width / height > ratio
      ? { width: Math.round(height * ratio), height, top: 0 }
      : { width, height: Math.round(width / ratio), left: 0 };
  crop.left ??= Math.round((width - crop.width) * f);
  crop.top ??= Math.round((height - crop.height) * f);

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

  return { jpeg, original: { width, height }, crop, kept, cellDetail, blankCells, flags };
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
      }
      results.push({ name, ...p });
    } catch (e) {
      results.push({ name, skip: `couldn't read it (${e.message.split('\n')[0]}); convert it to JPEG` });
    }
  }
  for (const name of unsupported) results.push({ name, skip: 'not a supported image type; convert it to JPEG' });

  await writeFile(REVIEW_PAGE, reviewPage(results, crops));
  const ready = results.filter((r) => !r.skip && r.flags.length === 0).length;
  const flagged = results.filter((r) => !r.skip && r.flags.length > 0);
  const skipped = results.filter((r) => r.skip);
  console.log(`${results.length} files: ${ready} ready, ${flagged.length} flagged, ${skipped.length} can't be used.`);
  for (const r of flagged) console.log(`  flagged  ${r.name}: ${r.flags.join('; ')}`);
  for (const r of skipped) console.log(`  skipped  ${r.name}: ${r.skip}`);
  console.log(`\nOpen ${pathToFileURL(REVIEW_PAGE).href}`);
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

  const credits = [];
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

    const file = `${String(next).padStart(4, '0')}.jpg`;

    // Write the processed image first; only claim the number and move the
    // original once that succeeds, so a mid-run failure can't desync them.
    try {
      await writeFile(path.join(PUZZLES_DIR, file), p.jpeg);
      await moveFile(src, path.join(ADDED_DIR, name));
    } catch (e) {
      console.log(`  skipped  ${name}: couldn't save/move it (${e.message.split('\n')[0]})`);
      continue;
    }

    next++;
    credits.push(`| ${file} | Own photo (${name}) | ${author} | © ${author}, all rights reserved |`);
    console.log(`  added    ${name} → assets/puzzles/${file}${p.flags.length ? `  (note: ${p.flags.join('; ')})` : ''}`);
  }

  for (const name of unsupported) {
    console.log(`  skipped  ${name}: not a supported image type; convert it to JPEG`);
  }
  if (credits.length === 0) return;

  const creditsText = await readFile(CREDITS_FILE, 'utf8');
  await writeFile(CREDITS_FILE, creditsText.trimEnd() + '\n' + credits.join('\n') + '\n');
  const total = await writeImageList();
  console.log(`\nAdded ${credits.length}; the game now has ${total} daily images. Commit, push and \`npm run deploy\` to publish.`);
}

/** Rebuilds src/puzzleImages.ts from assets/puzzles/NNNN.jpg, in number order (= day order). */
async function writeImageList() {
  const files = (await readdir(PUZZLES_DIR)).filter((f) => /^\d{4}\.jpg$/.test(f)).sort();
  const lines = files.map((f) => `  require('../assets/puzzles/${f}'),`).join('\n');
  await writeFile(
    IMAGE_LIST_FILE,
    `// Generated by scripts/prepare-photos.mjs from assets/puzzles/NNNN.jpg. Add images with \`npm run photos:add\`.
import type { ImageSourcePropType } from 'react-native';

/** Daily images, used in order and then repeated. All are 3:2. Credits: assets/puzzles/CREDITS.md. */
export const PUZZLE_IMAGES: ImageSourcePropType[] = [
${lines}
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
      const cropNote =
        r.kept > 0.999
          ? 'Fits 3:2 exactly.'
          : `Crop keeps ${Math.round(r.kept * 100)}% (focus ${crops[r.name] ?? 0.5}; set it in crops.json).`;
      const status = r.flags.length ? `<p class="bad">${r.flags.map(escape).join('<br>')}</p>` : '<p class="good">Ready.</p>';
      return `<article class="card${r.flags.length ? ' flagged' : ''}">
  <div class="frame"><img src="${escape(r.thumb)}" alt=""><div class="grid">${cells}</div></div>
  <h2>${escape(r.name)}</h2>
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
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
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
Red areas have almost no detail (plain sky, snow, water, fog), so their pieces are close to guesswork. Delete photos you don't want, then run <code>npm run photos:add</code>.</p>
<div class="cards">
${cards}
</div>
`;
}

const mode = process.argv[2];
if (mode === 'review') await review();
else if (mode === 'add') await add();
else {
  console.log('Usage: node scripts/prepare-photos.mjs review|add   (see photos-inbox/README.md)');
  process.exitCode = 1;
}
