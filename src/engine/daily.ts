import { PIECE_COUNT } from './constants';
import { generateCuts, type Cut } from './cuts';
import { mulberry32, shuffle } from './rng';

/** Puzzle #1 is on this local calendar date. Placeholder until a launch date is set. */
export const LAUNCH_DATE = { year: 2026, month: 9, day: 21 };

const MS_PER_DAY = 86_400_000;

// Date.UTC on calendar parts gives exact day multiples, so daylight-saving changes can't shift the count.
const dayCount = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / MS_PER_DAY;

/** Which daily puzzle it is on the player's local calendar date (like Wordle). Never below 1. */
export function puzzleNumber(now: Date, launch = LAUNCH_DATE): number {
  const today = dayCount(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const first = dayCount(launch.year, launch.month, launch.day);
  return Math.max(1, today - first + 1);
}

/** Spreads consecutive puzzle numbers into unrelated 32-bit seeds. */
export function seedFor(puzzle: number): number {
  let x = puzzle >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export function imageIndexFor(puzzle: number, imageCount: number): number {
  return (puzzle - 1) % imageCount;
}

export type Puzzle = {
  number: number;
  cuts: Cut[];
  /** The order pieces are dealt in, as piece indexes. */
  order: number[];
};

/** Everything about a day's puzzle comes from its number, so every player gets the same one. */
export function createPuzzle(puzzle: number): Puzzle {
  const rng = mulberry32(seedFor(puzzle));
  const cuts = generateCuts(rng);
  const order = shuffle(
    Array.from({ length: PIECE_COUNT }, (_, i) => i),
    rng,
  );
  return { number: puzzle, cuts, order };
}
