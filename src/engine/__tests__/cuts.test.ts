import { COLS, PIECE_COUNT, ROWS } from '../constants';
import { generateCuts, indexOf, pieceType, rowColOf } from '../cuts';
import { mulberry32 } from '../rng';

describe('generateCuts', () => {
  const seeds = [1, 2, 42, 123456789, 0xffffffff];

  it('gives the same cuts for the same seed', () => {
    for (const seed of seeds) {
      expect(generateCuts(mulberry32(seed))).toEqual(generateCuts(mulberry32(seed)));
    }
  });

  it('matches every tab with a notch on the neighbouring piece', () => {
    for (const seed of seeds) {
      const cuts = generateCuts(mulberry32(seed));
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const here = cuts[indexOf(r, c)];
          if (c < COLS - 1) {
            expect(here.r).not.toBe(0);
            expect(cuts[indexOf(r, c + 1)].l).toBe(-here.r);
          }
          if (r < ROWS - 1) {
            expect(here.b).not.toBe(0);
            expect(cuts[indexOf(r + 1, c)].t).toBe(-here.b);
          }
        }
      }
    }
  });

  it('keeps the outer border flat', () => {
    const cuts = generateCuts(mulberry32(7));
    for (let c = 0; c < COLS; c++) {
      expect(cuts[indexOf(0, c)].t).toBe(0);
      expect(cuts[indexOf(ROWS - 1, c)].b).toBe(0);
    }
    for (let r = 0; r < ROWS; r++) {
      expect(cuts[indexOf(r, 0)].l).toBe(0);
      expect(cuts[indexOf(r, COLS - 1)].r).toBe(0);
    }
  });

  it('classifies corners, edges and interior pieces', () => {
    const cuts = generateCuts(mulberry32(7));
    const counts = { corner: 0, edge: 0, interior: 0 };
    cuts.forEach((cut) => counts[pieceType(cut)]++);
    expect(counts).toEqual({ corner: 4, edge: 2 * (COLS - 2) + 2 * (ROWS - 2), interior: (COLS - 2) * (ROWS - 2) });
  });
});

describe('indexOf / rowColOf', () => {
  it('round-trip every cell', () => {
    for (let i = 0; i < PIECE_COUNT; i++) {
      const [r, c] = rowColOf(i);
      expect(indexOf(r, c)).toBe(i);
    }
  });
});
