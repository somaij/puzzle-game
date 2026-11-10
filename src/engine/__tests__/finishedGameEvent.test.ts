import { MAX_COUNTED_GAP_MS, MISS_LIMIT, PIECE_COUNT } from '../constants';
import { createPuzzle, type Puzzle } from '../daily';
import { dropPiece, newGame, resumeGame, type GameState } from '../game';
import { finishedGameEvent } from '../result';

/** Dealt row by row, so piece 0 is an island and every later piece snaps. */
const rowMajor: Puzzle = { number: 0, cuts: createPuzzle(1).cuts, order: Array.from({ length: PIECE_COUNT }, (_, i) => i) };

function solvedWithOneMiss(): GameState {
  let game = dropPiece(newGame(rowMajor, 0), 0, 5, 500).state;
  for (let piece = 0; piece < PIECE_COUNT; piece++) game = dropPiece(game, piece, piece, (piece + 1) * 2000).state;
  return game;
}

describe('finishedGameEvent', () => {
  it('describes a solved game', () => {
    const game = solvedWithOneMiss();
    expect(game.status).toBe('won');
    expect(finishedGameEvent(game, 7, [], 3)).toEqual({
      puzzle: 7,
      result: 'solved',
      score: game.score,
      misses: 1,
      top_speed: game.multTenths / 10,
      seconds_per_piece: 2,
      islands: 1,
      streak: 3,
    });
  });

  it('describes a game that ran out of misses before any piece was placed', () => {
    let game = newGame(rowMajor, 0);
    for (let i = 0; i < MISS_LIMIT; i++) game = dropPiece(game, 0, 5, i * 100).state;
    expect(finishedGameEvent(game, 7, [], 1)).toMatchObject({ result: 'out-of-misses', misses: MISS_LIMIT, seconds_per_piece: 0, top_speed: 1 });
  });

  it('reports the top multiplier from the moves when the game ended lower', () => {
    let game = newGame(rowMajor, 0);
    for (let i = 0; i < MISS_LIMIT; i++) game = dropPiece(game, 0, 5, i * 100).state;
    expect(finishedGameEvent(game, 7, [{ kind: 'joined', base: 25, points: 45, multTenths: 18 }], 1).top_speed).toBe(1.8);
  });
});

describe('play time', () => {
  it('caps a long gap between placements', () => {
    const { state } = dropPiece(newGame(rowMajor, 0), 0, 0, MAX_COUNTED_GAP_MS * 10);
    expect(state.playMs).toBe(MAX_COUNTED_GAP_MS);
  });

  it('starts from zero for a game saved before play time was recorded', () => {
    const { playMs: _dropped, ...oldSave } = newGame(rowMajor, 0);
    expect(resumeGame(oldSave as GameState, 0, 50).playMs).toBe(0);
  });
});
