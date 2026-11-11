// The game moved to https://jigsup.fun. This replaces the old offline copy: it clears what the old
// one saved and removes itself, so the address only ever forwards.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((windows) => windows.forEach((w) => w.navigate(w.url))),
  );
});
