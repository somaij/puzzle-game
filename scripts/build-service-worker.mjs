// Runs after `expo export`: writes dist/sw.js with the exact files of this build, because their
// names carry content hashes. The photos are listed separately: the app saves only a few of them
// (see src/pwa.ts), so opening a link doesn't download the whole library.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const PHOTO_DIR = 'assets/assets/puzzles/';
const NOT_SAVED = new Set(['index.html', 'metadata.json', 'sw.js']);

const files = readdirSync(DIST, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(DIST, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .filter((path) => !NOT_SAVED.has(path))
  .sort();

// Sorted by name, so position N is the photo the app calls image N (NNNN.jpg, append-only).
const photos = files.filter((path) => path.startsWith(PHOTO_DIR));
const shell = ['./', ...files.filter((path) => !path.startsWith(PHOTO_DIR))];

const hash = createHash('sha256');
for (const path of [...files, 'index.html']) hash.update(path).update(readFileSync(join(DIST, path)));
const version = hash.digest('hex').slice(0, 12);

const code = readFileSync('scripts/service-worker.js', 'utf8');
writeFileSync(
  join(DIST, 'sw.js'),
  `const VERSION = ${JSON.stringify(version)};\nconst PRECACHE = ${JSON.stringify(shell)};\nconst PHOTOS = ${JSON.stringify(photos)};\n${code}`,
);
console.log(`dist/sw.js: version ${version}, ${shell.length} files saved up front, ${photos.length} photos available`);
