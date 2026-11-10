// Web only: anonymous game results, sent to our own endpoint (worker/). Live builds only, and nothing
// happens until ENDPOINT is filled in. No cookies, and no player ID is ever sent.

/** The deployed Worker's address, from `npx wrangler@latest deploy`. */
const ENDPOINT = 'https://puzzle-game-analytics.somaij.workers.dev';

/** Best effort: analytics must never affect the game. */
export function trackEvent(event: string, data: Record<string, string | number>) {
  if (__DEV__ || !ENDPOINT || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
  navigator.sendBeacon(ENDPOINT, JSON.stringify({ event, ...data }));
}
