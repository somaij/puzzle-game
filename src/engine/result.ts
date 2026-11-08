import { PIECE_COUNT } from './constants';

/** The working title, shown in the shared result. */
export const GAME_NAME = 'Daily Jigsaw';

const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** One move, with what it scored: a piece's base worth, and the total after the multiplier. */
export type ScoredMove = { kind: 'lone' | 'joined'; base: number; points: number; multTenths: number } | { kind: 'miss' };

export type Result = {
  puzzle: number;
  /** All pieces placed before running out of misses. */
  won: boolean;
  score: number;
  /** Pieces placed when the score locked. */
  placed: number;
  moves: readonly ScoredMove[];
};

/**
 * The text a player shares, in plain words so anyone in a group chat can read it without having
 * played. (A grid of coloured squares was tried: it needed a legend, and Wordle's only works
 * because everyone already knows it.)
 */
export function shareText({ puzzle, won, score, placed, moves }: Result, url: string): string {
  let topSpeed = 10;
  let misses = 0;
  for (const m of moves) {
    if (m.kind === 'miss') misses++;
    else topSpeed = Math.max(topSpeed, m.multTenths);
  }
  const outcome = won
    ? ['✅ Solved', misses === 0 ? '🎯 No misses' : `❌ ${misses} ${misses === 1 ? 'miss' : 'misses'}`]
    : [`💔 Out of misses at ${placed}/${PIECE_COUNT} pieces`];
  // ×1.0 means no speed bonus at all, so there's nothing to brag about.
  const speed = topSpeed > 10 ? [`⚡ Top speed ×${(topSpeed / 10).toFixed(1)}`] : [];
  return [`🧩 ${GAME_NAME} #${puzzle}`, ...outcome, `⭐ ${withCommas(score)} points`, ...speed, url].join('\n');
}

export type Stats = {
  played: number;
  won: number;
  /** Days in a row with a game finished (solved or out of misses). */
  streak: number;
  bestStreak: number;
  bestScore: number;
  /** The last daily puzzle counted, so one can never be counted twice. */
  lastPuzzle: number;
};

export const NO_STATS: Stats = { played: 0, won: 0, streak: 0, bestStreak: 0, bestScore: 0, lastPuzzle: 0 };

/**
 * Add one finished daily puzzle. The streak counts days played, not days solved: how hard a day is
 * depends on its photo, and a hard photo shouldn't cost someone a long streak.
 */
export function recordResult(stats: Stats, { puzzle, won, score }: Pick<Result, 'puzzle' | 'won' | 'score'>): Stats {
  if (puzzle <= stats.lastPuzzle) return stats;
  const streak = puzzle === stats.lastPuzzle + 1 ? stats.streak + 1 : 1;
  return {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    bestScore: Math.max(stats.bestScore, score),
    lastPuzzle: puzzle,
  };
}

/** The streak as it stands today: it only lapses once a whole day has been missed. */
export function currentStreak(stats: Stats, today: number): number {
  return stats.lastPuzzle >= today - 1 ? stats.streak : 0;
}
