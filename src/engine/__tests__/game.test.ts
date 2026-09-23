import { indexOf } from '../cuts';
import { DECAY_TICK_MS, FAST_MS, HAND_SIZE, MISS_LIMIT, PIECE_COUNT, PULSE_MS, STALL_MS } from '../constants';
import { createPuzzle, type Puzzle } from '../daily';
import {
  canHold,
  decayStartsAt,
  dropPiece,
  holdPiece,
  isIsland,
  isPlayable,
  missesLeft,
  newGame,
  pointsFor,
  tick,
  type GameState,
} from '../game';

const puzzle = createPuzzle(1);
/** Idle time until the multiplier first drops. */
const FIRST_DROP = STALL_MS + DECAY_TICK_MS;
const { order } = puzzle;

/** Same cuts, but pieces dealt in a chosen order. */
const dealtInOrder = (deal: number[]): Puzzle => ({ number: 0, cuts: puzzle.cuts, order: deal });
/** Row by row from the top-left: piece 0 is an island, and played in number order every later piece snaps. */
const rowMajor = dealtInOrder(Array.from({ length: PIECE_COUNT }, (_, i) => i));

/** Drop `piece` on its own cell at time `now`. */
function place(state: GameState, piece: number, now = 0): GameState {
  const { state: next, result } = dropPiece(state, piece, piece, now);
  expect(result).toBe('placed');
  return next;
}

/** Place the lowest-numbered playable piece (in rowMajor, the next one row by row). */
function placeLowest(state: GameState, now = 0): GameState {
  const playable = [...state.hand, state.hold].filter((p): p is number => p !== null);
  return place(state, Math.min(...playable), now);
}

/** Any empty cell that isn't `piece`'s. */
function wrongCell(state: GameState, piece: number): number {
  return state.placed.findIndex((filled, i) => !filled && i !== piece);
}

describe('dealing', () => {
  it(`deals a hand of ${HAND_SIZE} in the puzzle order`, () => {
    const game = newGame(puzzle, 0);
    expect(game.hand).toEqual(order.slice(0, HAND_SIZE));
    expect(game.deck).toEqual(order.slice(HAND_SIZE));
    expect(game.placedCount).toBe(0);
  });

  it('does not change the puzzle it was dealt from', () => {
    const before = [...order];
    place(newGame(puzzle, 0), order[0]);
    expect(puzzle.order).toEqual(before);
  });
});

describe('dropPiece', () => {
  it('plays any hand piece and refills its slot from the deck', () => {
    const game = place(newGame(puzzle, 0), order[1]);
    expect(game.placed[order[1]]).toBe(true);
    expect(game.placedCount).toBe(1);
    expect(game.hand).toEqual([order[0], order[3], order[2]]);
    expect(game.deck).toEqual(order.slice(4));
  });

  it('keeps the hand as it was after a wrong cell', () => {
    const game = newGame(puzzle, 0);
    const { state, result } = dropPiece(game, order[2], wrongCell(game, order[2]), 0);
    expect(result).toBe('wrong');
    expect(state.hand).toEqual(game.hand);
    expect(state.placedCount).toBe(0);
  });

  it('returns quietly when dropped off the board or on a filled cell', () => {
    const game = place(newGame(puzzle, 0), order[0]);
    for (const cell of [null, -1, PIECE_COUNT, order[0]]) {
      const { state, result } = dropPiece(game, order[1], cell, 0);
      expect(result).toBe('returned');
      expect(state).toBe(game);
    }
  });

  it('ignores pieces that are not in the hand or hold', () => {
    const game = newGame(puzzle, 0);
    const notDealt = order[HAND_SIZE];
    expect(isPlayable(game, notDealt)).toBe(false);
    expect(dropPiece(game, notDealt, notDealt, 0).result).toBe('returned');
  });
});

describe('holdPiece', () => {
  it('moves a hand piece to hold and refills its slot from the deck', () => {
    const game = holdPiece(newGame(puzzle, 0), order[1], 0);
    expect(game.hold).toBe(order[1]);
    expect(game.hand).toEqual([order[0], order[3], order[2]]);
  });

  it('can only be used once per placement', () => {
    const game = holdPiece(newGame(puzzle, 0), order[0], 0);
    expect(canHold(game)).toBe(false);
    expect(holdPiece(game, order[1], 0)).toBe(game);
  });

  it('swaps with the held piece once available again', () => {
    // Hold order[0] (order[3] fills its slot), then place order[1] (order[4] fills its slot).
    let game = place(holdPiece(newGame(puzzle, 0), order[0], 0), order[1]);
    expect(canHold(game)).toBe(true);
    game = holdPiece(game, order[2], 0);
    expect(game.hold).toBe(order[2]);
    expect(game.hand).toEqual([order[3], order[4], order[0]]);
    expect(game.deck).toEqual(order.slice(5));
  });

  it('is not made available again by a wrong drop', () => {
    const held = holdPiece(newGame(puzzle, 0), order[0], 0);
    const { state } = dropPiece(held, order[1], wrongCell(held, order[1]), 0);
    expect(canHold(state)).toBe(false);
  });

  it('keeps the held piece playable from the hold slot', () => {
    let game = holdPiece(newGame(puzzle, 0), order[0], 0);
    expect(isPlayable(game, order[0])).toBe(true);
    game = place(game, order[0]);
    expect(game.hold).toBeNull();
    expect(game.hand).toEqual([order[3], order[1], order[2]]); // playing from hold deals nothing
  });

  it('ignores pieces not in the hand', () => {
    const game = newGame(puzzle, 0);
    expect(holdPiece(game, order[HAND_SIZE], 0)).toBe(game);
  });
});

describe('end of deck', () => {
  it('empties hand slots once the deck runs out, and wins with all pieces placed', () => {
    let game = newGame(rowMajor, 0);
    for (let i = 0; i < PIECE_COUNT - 1; i++) game = placeLowest(game);
    expect(game.deck).toEqual([]);
    expect(game.hand.filter((p) => p !== null)).toEqual([PIECE_COUNT - 1]);
    expect(game.status).toBe('playing');
    game = placeLowest(game);
    expect(game.status).toBe('won');
    expect(game.hand).toEqual([null, null, null]);
  });

  it('does not win while a piece is still held, and it can be played last', () => {
    let game = holdPiece(newGame(rowMajor, 0), 0, 0);
    // Place everything but the held piece, highest first so the hand never needs piece 0.
    while (game.hand.some((p) => p !== null)) {
      game = place(game, Math.max(...game.hand.filter((p): p is number => p !== null)));
    }
    expect(game.placedCount).toBe(PIECE_COUNT - 1);
    expect(game.status).toBe('playing');
    game = place(game, 0);
    expect(game.status).toBe('won');
  });

  it('allows holding the last hand piece, since it can still be played from hold', () => {
    let game = newGame(rowMajor, 0);
    for (let i = 0; i < PIECE_COUNT - 1; i++) game = placeLowest(game);
    game = holdPiece(game, PIECE_COUNT - 1, 0);
    expect(game.hold).toBe(PIECE_COUNT - 1);
    expect(place(game, PIECE_COUNT - 1).status).toBe('won');
  });

  it('ignores drops and holds once won', () => {
    let game = newGame(rowMajor, 0);
    while (game.status === 'playing') game = placeLowest(game);
    expect(dropPiece(game, 0, 0, 0).result).toBe('returned');
    expect(holdPiece(game, 0, 0)).toBe(game);
  });
});

describe('scoring', () => {
  it('rounds points half up in integer maths', () => {
    expect(pointsFor(100, 10)).toBe(100);
    expect(pointsFor(100, 11)).toBe(110);
    expect(pointsFor(25, 11)).toBe(28); // 27.5
    expect(pointsFor(25, 13)).toBe(33); // 32.5, the same whether 1.3× was reached going up or down
    expect(pointsFor(25, 15)).toBe(38); // 37.5
  });

  it('scores an island 100 and a snap 25 at 1.0×', () => {
    let game = newGame(rowMajor, 0);
    const first = dropPiece(game, 0, 0, 5000); // slow: no fast bonus
    expect(first.placement).toMatchObject({ island: true, fast: false, points: 100, pulse: true });
    game = first.state;
    const second = dropPiece(game, 1, 1, 10_000);
    expect(second.placement).toMatchObject({ island: false, fast: false, points: 25, pulse: false });
    expect(second.state.score).toBe(125);
    expect(second.state.moves).toEqual(['island', 'snap']);
  });

  it('pays a fast placement at the raised multiplier', () => {
    const { state, placement } = dropPiece(newGame(rowMajor, 0), 0, 0, FAST_MS);
    expect(placement).toMatchObject({ fast: true, points: 110 });
    expect(state.multTenths).toBe(11);
  });

  it('caps the multiplier at 1.5×', () => {
    let game = newGame(rowMajor, 0);
    for (let i = 0; i < 8; i++) game = placeLowest(game, i * 100);
    expect(game.multTenths).toBe(15);
    expect(dropPiece(game, 8, 8, 900).placement?.points).toBe(38);
  });

  it('decides island or snap from what is already placed, whichever hand piece is played', () => {
    let game = newGame(rowMajor, 0);
    expect(isIsland(game, 1)).toBe(true);
    game = place(game, 0);
    expect(isIsland(game, 1)).toBe(false); // touches piece 0
    expect(isIsland(game, 7)).toBe(true); // diagonal to piece 0 only
    expect(dropPiece(game, 2, 2, 0).placement?.island).toBe(true); // hand is 3, 1, 2: skipping 1 leaves 2 an island
  });
});

describe('flow decay', () => {
  /** Four fast placements from t=0 to t=300: multiplier 1.4×, last placement at t=300. */
  const flowing = () => {
    let game = newGame(rowMajor, 0);
    for (let i = 0; i < 4; i++) game = placeLowest(game, i * 100);
    expect(game.multTenths).toBe(14);
    return game;
  };

  it('starts one tick after the stall grace, then drops 0.1× per tick', () => {
    const game = flowing();
    expect(tick(game, 300 + FIRST_DROP - 1).multTenths).toBe(14);
    expect(tick(game, 300 + FIRST_DROP).multTenths).toBe(13);
    expect(tick(game, 300 + FIRST_DROP + DECAY_TICK_MS).multTenths).toBe(12);
    expect(tick(tick(game, 300 + FIRST_DROP), 300 + FIRST_DROP + DECAY_TICK_MS).multTenths).toBe(12); // same result tick by tick
  });

  it('starts exactly when decayStartsAt says', () => {
    const game = flowing();
    expect(decayStartsAt(game)).toBe(300 + FIRST_DROP);
    expect(tick(game, decayStartsAt(game) - 1).multTenths).toBe(14);
    expect(tick(game, decayStartsAt(game)).multTenths).toBe(13);
  });

  it('never goes below 1.0×', () => {
    expect(tick(flowing(), 300 + 60_000).multTenths).toBe(10);
  });

  it('is applied before a late placement is scored', () => {
    const { state } = dropPiece(flowing(), 4, 4, 300 + FIRST_DROP + DECAY_TICK_MS);
    expect(state.multTenths).toBe(12);
  });

  it('is not reset by a hold or a miss, only by a placement', () => {
    let game = flowing(); // hand: 4, 5, 6
    game = holdPiece(game, 5, 300 + 3000);
    game = dropPiece(game, 4, wrongCell(game, 4), 300 + 4500).state; // miss: −0.1×
    expect(game.multTenths).toBe(13);
    expect(tick(game, 300 + FIRST_DROP).multTenths).toBe(12);
  });
});

describe('fast window', () => {
  it('counts from the previous placement', () => {
    const game = place(newGame(rowMajor, 0), 0, 5000); // slow
    expect(dropPiece(game, 1, 1, 5000 + FAST_MS).placement?.fast).toBe(true);
    expect(dropPiece(game, 1, 1, 5000 + FAST_MS + 1).placement?.fast).toBe(false);
  });

  it('counts the first placement from the start of the game', () => {
    expect(dropPiece(newGame(rowMajor, 1000), 0, 0, 1000 + FAST_MS).placement?.fast).toBe(true);
    expect(dropPiece(newGame(rowMajor, 1000), 0, 0, 1000 + FAST_MS + 1).placement?.fast).toBe(false);
  });

  it('is not restarted by a hold or a miss', () => {
    let game = holdPiece(newGame(rowMajor, 0), 2, 3000);
    game = dropPiece(game, 0, 5, 3400).state;
    expect(dropPiece(game, 0, 0, FAST_MS + 1).placement?.fast).toBe(false);
  });
});

describe('misses', () => {
  it('cost a miss and 0.1× flow, but never below 1.0×, and report what was lost', () => {
    let game = place(newGame(rowMajor, 0), 0, 100); // 1.1×
    const first = dropPiece(game, 1, 10, 200);
    expect(first.miss).toEqual({ cell: 10, multLostTenths: 1 });
    game = first.state;
    expect(game.multTenths).toBe(10);
    expect(missesLeft(game)).toBe(MISS_LIMIT - 1);
    const second = dropPiece(game, 1, 10, 300);
    expect(second.miss).toEqual({ cell: 10, multLostTenths: 0 });
    game = second.state;
    expect(game.multTenths).toBe(10);
    expect(game.moves).toEqual(['island', 'miss', 'miss']);
  });

  it(`end the game on the ${MISS_LIMIT}th`, () => {
    let game = newGame(rowMajor, 0);
    for (let i = 1; i < MISS_LIMIT; i++) game = dropPiece(game, 0, 10, i).state;
    expect(game.status).toBe('playing');
    game = dropPiece(game, 0, 10, MISS_LIMIT).state;
    expect(game.status).toBe('failed');
    expect(missesLeft(game)).toBe(0);
    expect(dropPiece(game, 0, 0, 100).result).toBe('returned');
    expect(holdPiece(game, 0, 100)).toBe(game);
  });
});

describe('pulse', () => {
  const centre = indexOf(1, 1);
  const around = [0, 1, 2, 6, 8, 12, 13, 14]; // the 8 cells around (1,1)

  it('ghosts the empty cells around a correct island, including diagonals', () => {
    const { state } = dropPiece(newGame(dealtInOrder([centre, ...around]), 0), centre, centre, 1000);
    expect(state.ghosts.map((g) => g.cell).sort((a, b) => a - b)).toEqual(around);
    expect(state.ghosts.every((g) => g.until === 1000 + PULSE_MS)).toBe(true);
  });

  it('skips placed cells, and not on a snap', () => {
    let game = place(newGame(rowMajor, 0), 0); // piece 0 island: ghosts 1, 6, 7
    expect(game.ghosts.map((g) => g.cell).sort((a, b) => a - b)).toEqual([1, 6, 7]);
    game = place(game, 1); // piece 1 is a snap: no new ghosts, its own ghost removed
    expect(game.ghosts.map((g) => g.cell).sort((a, b) => a - b)).toEqual([6, 7]);
  });

  it('fades after PULSE_MS', () => {
    const game = place(newGame(rowMajor, 0), 0, 1000);
    expect(tick(game, 1000 + PULSE_MS - 1).ghosts).toHaveLength(3);
    expect(tick(game, 1000 + PULSE_MS).ghosts).toHaveLength(0);
  });

  it('keeps the original timer when a ghost is pulsed again', () => {
    // Island at (0,0) ghosts (1,1); a later island at (0,2) would ghost (1,1) again.
    let game = place(newGame(dealtInOrder([0, 2, ...around]), 0), 0, 0);
    game = place(game, 2, 2000);
    expect(game.ghosts.find((g) => g.cell === 7)?.until).toBe(PULSE_MS);
  });
});
