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
