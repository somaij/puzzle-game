const VERSION = "8f7148da74d6";
const PRECACHE = ["./","_expo/static/js/web/index-53f9cfae25cab00093ed0ee6f6d78986.js","assets/assets/fonts/ShantellSans_700Bold.79d988fe6936f2624a54323ae32e3786.ttf","assets/assets/fonts/ShantellSans_800ExtraBold.1afd0340753702f1e08b7280441ca581.ttf","assets/assets/fonts/VarelaRound_400Regular.76b03771cc96ecc229dcf2e463d34eff.ttf","favicon.ico","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","manifest.json"];
const PHOTOS = ["assets/assets/puzzles/0001.3e10a45076728f4526d2bc9e0f464c6f.jpg","assets/assets/puzzles/0002.164bd2d80b8d673e4c69be5da18dfe9a.jpg","assets/assets/puzzles/0003.15f80e8a35e4187733e315c1595f439e.jpg","assets/assets/puzzles/0004.59149e42e2e139b92f47037351fc6acc.jpg","assets/assets/puzzles/0005.13420bff93033af0b24bbda5c4c743ae.jpg","assets/assets/puzzles/0006.7266a5ee447cd043c8ef58257ffddf01.jpg","assets/assets/puzzles/0007.733df529b8134bed91ba995c0c10c1a7.jpg","assets/assets/puzzles/0008.a523d64e7e53aca7e9d3570411b71d62.jpg","assets/assets/puzzles/0009.12599e6e89b9bc1b7f302efbbe1d0882.jpg","assets/assets/puzzles/0010.65b9109bc6bc596387efb806263ecc06.jpg","assets/assets/puzzles/0011.33c7e86a3ff01eb0ec89fe8cfe722855.jpg","assets/assets/puzzles/0012.a80b3b084680439d24de7888e6bfedc0.jpg","assets/assets/puzzles/0013.9ddb2642f07ded2c29d98351edf3c9d6.jpg","assets/assets/puzzles/0014.a5fd309a429f87f2350c1a5c69737a58.jpg","assets/assets/puzzles/0015.2433b7df3a5b00dc36862aa905332b25.jpg","assets/assets/puzzles/0016.18f0c7534961f27ecf1b9ab44540a0f3.jpg"];
/* global VERSION, PRECACHE, PHOTOS */
// The service worker's logic. scripts/build-service-worker.mjs puts VERSION, PRECACHE and PHOTOS in
// front of this and writes the result to dist/sw.js. It only ever talks to this site.

const SHELL_CACHE = `shell-${VERSION}`;
const PHOTO_CACHE = 'photos';
const INDEX = new URL('./', self.location).href;
// How long to wait for a fresh page before opening the saved one.
const NETWORK_MS = 3000;

self.addEventListener('install', (event) => {
  // `reload` skips the browser's HTTP cache, so the saved page always matches the saved bundle.
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith('shell-') && n !== SHELL_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/**
 * The page comes from the network when it can, so a deploy reaches players on their next open. The
 * response is deliberately not saved: the saved page must stay the one that matches the saved bundle.
 */
async function openPage(request) {
  const saved = await caches.match(INDEX);
  if (!saved) return fetch(request);
  const tooSlow = new Promise((resolve) => setTimeout(resolve, NETWORK_MS, saved));
  return Promise.race([fetch(request).catch(() => saved), tooSlow]);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(openPage(request));
    return;
  }
  // Everything else has its content hash in its name, so a saved copy is never out of date.
  event.respondWith(caches.match(request).then((saved) => saved ?? fetch(request)));
});

/** Keep only the photos the page asked for (today's and the next few), so the cache can't grow. */
async function keepPhotos(indexes) {
  const cache = await caches.open(PHOTO_CACHE);
  const wanted = indexes.map((i) => PHOTOS[i]).filter(Boolean).map((path) => new URL(path, self.location).href);
  for (const request of await cache.keys()) {
    if (!wanted.includes(request.url)) await cache.delete(request);
  }
  // A photo that fails now is simply tried again on the next visit.
  await Promise.all(wanted.map(async (url) => (await cache.match(url)) ?? cache.add(url).catch(() => undefined)));
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'keep-photos') event.waitUntil(keepPhotos(event.data.indexes));
});
