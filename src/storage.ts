// A tiny local, per-browser key/value store: for "has this player seen X" flags and, from
// checkpoint 4, stats/streaks (see CLAUDE.md). Only web has a store today; on native (no
// `window`) these quietly no-op, which just means such prompts always show until that's built.
//
// One narrow wrapper so there's a single place to swap the backend later (e.g. AsyncStorage for
// the native app), and so every call site doesn't repeat the same try/catch.

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // Throws in some private-browsing modes.
    return null;
  }
}

export function getStoredFlag(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function setStoredFlag(key: string, value: string): void {
  try {
    store()?.setItem(key, value);
  } catch {
    // Storage full or blocked: the flag just won't persist, which only means it may re-show.
  }
}
