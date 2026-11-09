// Web only: what makes the site work as an installed app. The manifest and icons are in public/, the
// service worker is built by scripts/build-service-worker.mjs.
import { imageIndexFor, puzzleNumber } from './engine/daily';

/** Save today's photo and this many more, so an offline player still has the next few days. */
const PHOTOS_AHEAD = 3;

export function setUpOfflinePlay(photoCount: number) {
  // The dev server has no service worker, and a cached bundle would hide code changes.
  if (__DEV__ || !('serviceWorker' in navigator)) return;
  const today = puzzleNumber(new Date());
  const indexes = Array.from({ length: PHOTOS_AHEAD + 1 }, (_, days) => imageIndexFor(today + days, photoCount));
  // Offline play is an extra: if any of this fails, the game still works online.
  navigator.serviceWorker.register('sw.js').catch(() => undefined);
  navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({ type: 'keep-photos', indexes })).catch(() => undefined);
}

/**
 * An installed app is resumed rather than reopened, so it could still be showing yesterday's puzzle.
 * Move on when the player comes back, never in the middle of a game they're looking at.
 */
export function reloadWhenDayChanges(puzzle: number): () => void {
  const check = () => {
    if (document.visibilityState === 'visible' && puzzleNumber(new Date()) !== puzzle) window.location.reload();
  };
  document.addEventListener('visibilitychange', check);
  return () => document.removeEventListener('visibilitychange', check);
}
