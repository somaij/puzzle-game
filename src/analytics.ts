// Web only: anonymous game results, sent to our own endpoint (worker/). Live builds only. No cookies,
// and no player ID is ever sent.

/**
 * On the game's own site, not a separate address: privacy blockers drop background posts to other
 * sites (EasyPrivacy's `$ping,third-party`), and results are only accepted from jigsup.fun.
 */
const ENDPOINT = '/api/results';

/** Best effort: analytics must never affect the game. */
export function trackEvent(event: string, data: Record<string, string | number>) {
  if (__DEV__ || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
  navigator.sendBeacon(ENDPOINT, JSON.stringify({ event, ...data }));
}
