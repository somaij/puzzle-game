import {
  COLS,
  DECAY_TICK_MS,
  FAST_MS,
  ISLAND_POINTS,
  MISS_LIMIT,
  MULT_MAX_TENTHS,
  MULT_MIN_TENTHS,
  MULT_STEP_TENTHS,
  PIECE_COUNT,
  PULSE_MS,
  PULSE_RADIUS,
  ROWS,
  SNAP_POINTS,
  STALL_MS,
  WRONG_PENALTY_TENTHS,
} from './constants';
import { indexOf, rowColOf } from './cuts';
import type { Puzzle } from './daily';

/** How many upcoming pieces the preview shows. */
export const QUEUE_LENGTH = 3;

/** A pulse ghost: an empty cell shown faintly (image + cut) until `until`. */
export type Ghost = { cell: number; until: number };
/** One entry per placement or miss, in order (the share result is built from these). */
export type Move = 'island' | 'snap' | 'miss';

/**
 * All times are milliseconds on one monotonic clock chosen by the caller
 * (the UI passes `performance.now()`; tests pass plain numbers).
 */
export type GameState = {
  /** Pieces still to play, in deal order. deck[0] is the current piece. */
  deck: readonly number[];
  /** The piece in the hold slot, if any. */
  hold: number | null;
  /** Hold can be used once per current piece. */
  holdUsed: boolean;
  /** placed[i] is true once piece i is on the board. */
  placed: readonly boolean[];
  placedCount: number;
  /** `failed` = out of misses. */
  status: 'playing' | 'won' | 'failed';
  score: number;
  /** Flow multiplier in whole tenths: 10 = 1.0×. */
  multTenths: number;
  misses: number;
  /** When the current piece was dealt, or re-dealt after a hold or a miss. Starts the fast window. */
  presentedAt: number;
  /** When a piece was last placed (or the game started). Starts the stall clock. */
  lastPlacedAt: number;
  /** Stall-decay steps already applied since `lastPlacedAt`. */
  decaySteps: number;
  ghosts: readonly Ghost[];
  moves: readonly Move[];
};

/**
 * What a drop did:
 * - `placed`: right cell, the piece locks in and scores.
 * - `wrong`: an empty cell that isn't this piece's; costs a miss and 0.1× flow, and the piece returns.
 * - `returned`: off the board or on a filled cell; the piece returns quietly.
 */
export type DropResult = 'placed' | 'wrong' | 'returned';

export type Placement = { cell: number; island: boolean; fast: boolean; points: number; pulse: boolean };
/** A wrong drop: where, and how much multiplier it cost (0 when already at 1.0×). */
export type Miss = { cell: number; multLostTenths: number };

export function newGame(puzzle: Puzzle, now: number): GameState {
  return {
    deck: puzzle.order.slice(),
    hold: null,
    holdUsed: false,
    placed: Array<boolean>(PIECE_COUNT).fill(false),
    placedCount: 0,
    status: 'playing',
    score: 0,
    multTenths: MULT_MIN_TENTHS,
    misses: 0,
    presentedAt: now,
    lastPlacedAt: now,
    decaySteps: 0,
    ghosts: [],
    moves: [],
  };
}

export function currentPiece(state: GameState): number | null {
  return state.deck.length > 0 ? state.deck[0] : null;
}

export function upcomingPieces(state: GameState): number[] {
  return state.deck.slice(1, 1 + QUEUE_LENGTH);
}

export function missesLeft(state: GameState): number {
  return MISS_LIMIT - state.misses;
}

/** Points for a placement: base × multiplier, rounded half up, in integer maths. */
export function pointsFor(base: number, multTenths: number): number {
  return Math.floor((base * multTenths + 5) / 10);
}

function orthogonalNeighbours(cell: number): number[] {
  const [r, c] = rowColOf(cell);
  const out: number[] = [];
  if (r > 0) out.push(indexOf(r - 1, c));
  if (r < ROWS - 1) out.push(indexOf(r + 1, c));
  if (c > 0) out.push(indexOf(r, c - 1));
  if (c < COLS - 1) out.push(indexOf(r, c + 1));
  return out;
}

/** An island is a piece whose home cell touches no placed piece (orthogonally). */
export function isIsland(state: GameState, piece: number): boolean {
  return !orthogonalNeighbours(piece).some((n) => state.placed[n]);
}

/** When the multiplier will first drop if nothing more is placed (stall decay's first step). */
export function decayStartsAt(state: GameState): number {
  return state.lastPlacedAt + STALL_MS + DECAY_TICK_MS;
}

/**
 * Advance the clocks: apply stall decay (−0.1× per DECAY_TICK_MS once STALL_MS has passed
 * since the last placement, so the first step lands at STALL_MS + DECAY_TICK_MS) and drop
 * expired ghosts. Returns the same object when nothing changed.
 */
export function tick(state: GameState, now: number): GameState {
  if (state.status !== 'playing') return state;
  let next = state;
  const idle = now - state.lastPlacedAt;
  const due = idle >= STALL_MS ? Math.floor((idle - STALL_MS) / DECAY_TICK_MS) : 0;
  if (due > state.decaySteps) {
    const multTenths = Math.max(MULT_MIN_TENTHS, state.multTenths - (due - state.decaySteps) * MULT_STEP_TENTHS);
    next = { ...next, multTenths, decaySteps: due };
  }
  if (next.ghosts.some((g) => g.until <= now)) {
    next = { ...next, ghosts: next.ghosts.filter((g) => g.until > now) };
  }
  return next;
}

export function canHold(state: GameState): boolean {
  // Holding the last piece into an empty slot would leave nothing to play, so it isn't allowed.
  return state.status === 'playing' && !state.holdUsed && (state.hold !== null || state.deck.length > 1);
}

/** Stash the current piece, swapping in the held one if there is one. The new piece gets a fresh fast window. */
export function holdPiece(state: GameState, now: number): GameState {
  const ticked = tick(state, now);
  if (!canHold(ticked)) return ticked;
  const [current, ...rest] = ticked.deck;
  const deck = ticked.hold === null ? rest : [ticked.hold, ...rest];
  return { ...ticked, deck, hold: current, holdUsed: true, presentedAt: now };
}

/** Drop the current piece on `cell` (null = off the board). */
export function dropPiece(
  state: GameState,
  cell: number | null,
  now: number,
): { state: GameState; result: DropResult; placement?: Placement; miss?: Miss } {
  const s = tick(state, now);
  const current = currentPiece(s);
  if (s.status !== 'playing' || current === null) return { state: s, result: 'returned' };
  if (cell === null || cell < 0 || cell >= PIECE_COUNT || s.placed[cell]) return { state: s, result: 'returned' };

  if (cell !== current) {
    const misses = s.misses + 1;
    const multTenths = Math.max(MULT_MIN_TENTHS, s.multTenths - WRONG_PENALTY_TENTHS);
    return {
      state: {
        ...s,
        misses,
        multTenths,
        presentedAt: now,
        moves: [...s.moves, 'miss'],
        status: misses >= MISS_LIMIT ? 'failed' : 'playing',
      },
      result: 'wrong',
      miss: { cell, multLostTenths: s.multTenths - multTenths },
    };
  }

  // Scoring: the fast bonus is added before the points are counted.
  const island = isIsland(s, cell);
  const fast = now - s.presentedAt <= FAST_MS;
  const multTenths = fast ? Math.min(MULT_MAX_TENTHS, s.multTenths + MULT_STEP_TENTHS) : s.multTenths;
  const points = pointsFor(island ? ISLAND_POINTS : SNAP_POINTS, multTenths);

  const placed = s.placed.slice();
  placed[cell] = true;
  const placedCount = s.placedCount + 1;

  // When the deck runs out, the held piece is dealt last.
  let deck = s.deck.slice(1);
  let hold = s.hold;
  if (deck.length === 0 && hold !== null) {
    deck = [hold];
    hold = null;
  }

  // A correct island fires the pulse: ghosts on the empty cells around it.
  let ghosts = s.ghosts.filter((g) => g.cell !== cell);
  if (island) {
    const [cr, cc] = rowColOf(cell);
    for (let i = 0; i < PIECE_COUNT; i++) {
      const [r, c] = rowColOf(i);
      const near = Math.max(Math.abs(r - cr), Math.abs(c - cc)) <= PULSE_RADIUS;
      if (near && !placed[i] && !ghosts.some((g) => g.cell === i)) ghosts = [...ghosts, { cell: i, until: now + PULSE_MS }];
    }
  }

  return {
    state: {
      ...s,
      deck,
      hold,
      holdUsed: false,
      placed,
      placedCount,
      status: placedCount === PIECE_COUNT ? 'won' : 'playing',
      score: s.score + points,
      multTenths,
      presentedAt: now,
      lastPlacedAt: now,
      decaySteps: 0,
      ghosts,
      moves: [...s.moves, island ? 'island' : 'snap'],
    },
    result: 'placed',
    placement: { cell, island, fast, points, pulse: island },
  };
}
