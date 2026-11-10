export type EventRow = {
  event: string;
  puzzle: number;
  result: string | null;
  score: number | null;
  misses: number | null;
  top_speed: number | null;
  seconds_per_piece: number | null;
  islands: number | null;
  streak: number | null;
};

const isNumberIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isIntIn = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && isNumberIn(v, min, max);

/**
 * Turn a posted body into a row, or null if it isn't something the game could have sent. The bounds
 * are loose on purpose, so retuning the scoring doesn't start rejecting real games.
 */
export function parseEvent(body: unknown): EventRow | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!isIntIn(b.puzzle, 1, 100000)) return null;
  const empty = { puzzle: b.puzzle, result: null, score: null, misses: null, top_speed: null, seconds_per_piece: null, islands: null, streak: null };
  if (b.event === 'puzzle-start' || b.event === 'result-share') return { event: b.event, ...empty };
  if (
    b.event !== 'puzzle-finish' ||
    (b.result !== 'solved' && b.result !== 'out-of-misses') ||
    !isIntIn(b.score, 0, 100000) ||
    !isIntIn(b.misses, 0, 100) ||
    !isNumberIn(b.top_speed, 1, 10) ||
    !isNumberIn(b.seconds_per_piece, 0, 600) ||
    !isIntIn(b.islands, 0, 100) ||
    !isIntIn(b.streak, 0, 100000)
  ) {
    return null;
  }
  return {
    event: b.event,
    puzzle: b.puzzle,
    result: b.result,
    score: b.score,
    misses: b.misses,
    top_speed: b.top_speed,
    seconds_per_piece: b.seconds_per_piece,
    islands: b.islands,
    streak: b.streak,
  };
}
