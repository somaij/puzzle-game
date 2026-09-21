import { indexOf } from '../cuts';
import { MISS_LIMIT, PIECE_COUNT, PULSE_MS } from '../constants';
import { createPuzzle, type Puzzle } from '../daily';
import {
  canHold,
  currentPiece,
  dropPiece,
  holdPiece,
  isIsland,
  missesLeft,
  newGame,
  pointsFor,
  tick,
  upcomingPieces,
  type GameState,
} from '../game';

const puzzle = createPuzzle(1);
const { order } = puzzle;

/** Same cuts, but pieces dealt in a chosen order. */
const dealtInOrder = (deal: number[]): Puzzle => ({ number: 0, cuts: puzzle.cuts, order: deal });
/** Row by row from the top-left: piece 0 is an island, every later piece snaps. */
const rowMajor = dealtInOrder(Array.from({ length: PIECE_COUNT }, (_, i) => i));

/** Drop the current piece on its own cell at time `now`. */
function placeCurrent(state: GameState, now = 0): GameState {
  const { state: next, result } = dropPiece(state, currentPiece(state), now);
  expect(result).toBe('placed');
  return next;
}

/** Any empty cell that isn't the current piece's. */
function wrongCell(state: GameState): number {
  return state.placed.findIndex((filled, i) => !filled && i !== currentPiece(state));
}

describe('dealing', () => {
  it('deals in the puzzle order with the next three previewed', () => {
    const game = newGame(puzzle, 0);
    expect(currentPiece(game)).toBe(order[0]);
    expect(upcomingPieces(game)).toEqual(order.slice(1, 4));
    expect(game.placedCount).toBe(0);
  });

  it('does not change the puzzle it was dealt from', () => {
    const before = [...order];
    placeCurrent(newGame(puzzle, 0));
    expect(puzzle.order).toEqual(before);
  });
});

describe('dropPiece', () => {
  it('locks the piece in on its own cell and deals the next', () => {
    const game = placeCurrent(newGame(puzzle, 0));
    expect(game.placed[order[0]]).toBe(true);
    expect(game.placedCount).toBe(1);
    expect(currentPiece(game)).toBe(order[1]);
  });

  it('keeps the same piece after a wrong cell', () => {
    const game = newGame(puzzle, 0);
    const { state, result } = dropPiece(game, wrongCell(game), 0);
    expect(result).toBe('wrong');
    expect(currentPiece(state)).toBe(order[0]);
    expect(state.placedCount).toBe(0);
  });

  it('returns quietly when dropped off the board or on a filled cell', () => {
    const game = placeCurrent(newGame(puzzle, 0));
    for (const cell of [null, -1, PIECE_COUNT, order[0]]) {
      const { state, result } = dropPiece(game, cell, 0);
      expect(result).toBe('returned');
      expect(state).toBe(game);
    }
  });
});

describe('holdPiece', () => {
  it('stashes the current piece and deals the next', () => {
    const game = holdPiece(newGame(puzzle, 0), 0);
    expect(game.hold).toBe(order[0]);
    expect(currentPiece(game)).toBe(order[1]);
  });

  it('can only be used once per piece', () => {
    const game = holdPiece(newGame(puzzle, 0), 0);
    expect(canHold(game)).toBe(false);
    expect(holdPiece(game, 0)).toBe(game);
  });

  it('is available again after a placement, and swaps the held piece back in', () => {
    let game = placeCurrent(holdPiece(newGame(puzzle, 0), 0)); // holds order[0], places order[1]
    expect(canHold(game)).toBe(true);
    game = holdPiece(game, 0); // swaps order[2] for order[0]
    expect(currentPiece(game)).toBe(order[0]);
    expect(game.hold).toBe(order[2]);
  });

  it('is not made available again by a wrong drop', () => {
    const held = holdPiece(newGame(puzzle, 0), 0);
    const { state } = dropPiece(held, wrongCell(held), 0);
    expect(canHold(state)).toBe(false);
  });
});

describe('end of deck', () => {
  it('deals the held piece last and wins with all pieces placed', () => {
    let game = holdPiece(newGame(puzzle, 0), 0);
    while (game.status === 'playing') game = placeCurrent(game);
    expect(game.status).toBe('won');
    expect(game.placedCount).toBe(PIECE_COUNT);
    expect(game.placed.every(Boolean)).toBe(true);
    expect(game.hold).toBeNull();
  });

  it('does not win while a piece is still held', () => {
    let game = holdPiece(newGame(puzzle, 0), 0);
    for (let i = 0; i < PIECE_COUNT - 1; i++) game = placeCurrent(game);
    expect(game.status).toBe('playing');
    expect(currentPiece(game)).toBe(order[0]);
  });

  it('refuses to hold the last piece into an empty slot', () => {
    let game = newGame(puzzle, 0);
    for (let i = 0; i < PIECE_COUNT - 1; i++) game = placeCurrent(game);
    expect(canHold(game)).toBe(false);
    expect(holdPiece(game, 0)).toBe(game);
  });

  it('ignores drops and holds once won', () => {
    let game = newGame(puzzle, 0);
    while (game.status === 'playing') game = placeCurrent(game);
    expect(currentPiece(game)).toBeNull();
    expect(dropPiece(game, 0, 0).result).toBe('returned');
    expect(holdPiece(game, 0)).toBe(game);
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
    const first = dropPiece(game, 0, 5000); // slow: no fast bonus
    expect(first.placement).toMatchObject({ island: true, fast: false, points: 100, pulse: true });
    game = first.state;
    const second = dropPiece(game, 1, 10_000);
    expect(second.placement).toMatchObject({ island: false, fast: false, points: 25, pulse: false });
    expect(second.state.score).toBe(125);
    expect(second.state.moves).toEqual(['island', 'snap']);
  });

  it('pays a fast placement at the raised multiplier', () => {
    const { state, placement } = dropPiece(newGame(rowMajor, 0), 0, 3500);
    expect(placement).toMatchObject({ fast: true, points: 110 });
    expect(state.multTenths).toBe(11);
  });

  it('caps the multiplier at 1.5×', () => {
    let game = newGame(rowMajor, 0);
    for (let i = 0; i < 8; i++) game = placeCurrent(game, i * 100);
    expect(game.multTenths).toBe(15);
    expect(dropPiece(game, 8, 900).placement?.points).toBe(38);
  });

  it('labels the current piece island or snap from what is already placed', () => {
    let game = newGame(rowMajor, 0);
    expect(isIsland(game, 1)).toBe(true);
    game = placeCurrent(game);
    expect(isIsland(game, 1)).toBe(false); // touches piece 0
    expect(isIsland(game, 7)).toBe(true); // diagonal to piece 0 only
  });
});

describe('flow decay', () => {
  /** Four fast placements from t=0 to t=300: multiplier 1.4×, last placement at t=300. */
  const flowing = () => {
    let game = newGame(rowMajor, 0);
    for (let i = 0; i < 4; i++) game = placeCurrent(game, i * 100);
    expect(game.multTenths).toBe(14);
    return game;
  };

  it('starts one tick after the stall grace, then drops 0.1× per tick', () => {
    const game = flowing();
    expect(tick(game, 300 + 4999).multTenths).toBe(14);
    expect(tick(game, 300 + 5000).multTenths).toBe(13);
    expect(tick(game, 300 + 6000).multTenths).toBe(12);
    expect(tick(tick(game, 300 + 5000), 300 + 6000).multTenths).toBe(12); // same result tick by tick
  });

  it('never goes below 1.0×', () => {
    expect(tick(flowing(), 300 + 60_000).multTenths).toBe(10);
  });

  it('is applied before a late placement is scored', () => {
    const { state } = dropPiece(flowing(), 4, 300 + 6000);
    expect(state.multTenths).toBe(12);
  });

  it('is not reset by a hold or a miss, only by a placement', () => {
    let game = flowing();
    game = holdPiece(game, 300 + 3000);
    game = dropPiece(game, wrongCell(game), 300 + 4500).state; // miss: −0.1×
    expect(game.multTenths).toBe(13);
    expect(tick(game, 300 + 5000).multTenths).toBe(12);
  });
});

describe('fast window', () => {
  it('restarts after a hold', () => {
    const game = holdPiece(newGame(rowMajor, 0), 3000);
    expect(dropPiece(game, 1, 6000).placement?.fast).toBe(true);
  });

  it('restarts after a miss', () => {
    const game = dropPiece(newGame(rowMajor, 0), 5, 3000).state;
    expect(dropPiece(game, 0, 6000).placement?.fast).toBe(true);
  });
});

describe('misses', () => {
  it('cost a miss and 0.1× flow, but never below 1.0×', () => {
    let game = placeCurrent(newGame(rowMajor, 0), 100); // 1.1×
    game = dropPiece(game, 10, 200).state;
    expect(game.multTenths).toBe(10);
    expect(missesLeft(game)).toBe(MISS_LIMIT - 1);
    game = dropPiece(game, 10, 300).state;
    expect(game.multTenths).toBe(10);
    expect(game.moves).toEqual(['island', 'miss', 'miss']);
  });

  it(`end the game on the ${MISS_LIMIT}th`, () => {
    let game = newGame(rowMajor, 0);
    for (let i = 1; i < MISS_LIMIT; i++) game = dropPiece(game, 10, i).state;
    expect(game.status).toBe('playing');
    game = dropPiece(game, 10, MISS_LIMIT).state;
    expect(game.status).toBe('failed');
    expect(missesLeft(game)).toBe(0);
    expect(dropPiece(game, 0, 100).result).toBe('returned');
    expect(holdPiece(game, 100)).toBe(game);
  });
});

describe('pulse', () => {
  const centre = indexOf(1, 1);
  const around = [0, 1, 2, 6, 8, 12, 13, 14]; // the 8 cells around (1,1)

  it('ghosts the empty cells around a correct island, including diagonals', () => {
    const { state } = dropPiece(newGame(dealtInOrder([centre, ...around]), 0), centre, 1000);
    expect(state.ghosts.map((g) => g.cell).sort((a, b) => a - b)).toEqual(around);
    expect(state.ghosts.every((g) => g.until === 1000 + PULSE_MS)).toBe(true);
  });

  it('skips placed cells, and not on a snap', () => {
    let game = placeCurrent(newGame(rowMajor, 0)); // piece 0 island: ghosts 1, 6, 7
    expect(game.ghosts.map((g) => g.cell).sort((a, b) => a - b)).toEqual([1, 6, 7]);
    game = placeCurrent(game); // piece 1 is a snap: no new ghosts, its own ghost removed
    expect(game.ghosts.map((g) => g.cell).sort((a, b) => a - b)).toEqual([6, 7]);
  });

  it('fades after PULSE_MS', () => {
    const game = placeCurrent(newGame(rowMajor, 0), 1000);
    expect(tick(game, 1000 + PULSE_MS - 1).ghosts).toHaveLength(3);
    expect(tick(game, 1000 + PULSE_MS).ghosts).toHaveLength(0);
  });

  it('keeps the original timer when a ghost is pulsed again', () => {
    // Island at (0,0) ghosts (1,1); a later island at (0,2) would ghost (1,1) again.
    let game = placeCurrent(newGame(dealtInOrder([0, 2, ...around]), 0), 0);
    game = placeCurrent(game, 2000);
    expect(game.ghosts.find((g) => g.cell === 7)?.until).toBe(PULSE_MS);
  });
});
