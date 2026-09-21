import { COLS, PIECE_COUNT, ROWS } from './constants';
import type { Rng } from './rng';

/** 1 = tab (sticks out), -1 = notch (cut in), 0 = flat outer border. */
export type Edge = -1 | 0 | 1;
/** The shape of a piece's four edges: top, right, bottom, left. */
export type Cut = { t: Edge; r: Edge; b: Edge; l: Edge };
export type PieceType = 'corner' | 'edge' | 'interior';

export const indexOf = (row: number, col: number) => row * COLS + col;
export const rowColOf = (i: number): [row: number, col: number] => [Math.floor(i / COLS), i % COLS];

const opposite = (e: Edge): Edge => (e === 1 ? -1 : e === -1 ? 1 : 0);

/**
 * Gives every inner edge a random tab/notch direction. The neighbour on the other side
 * always gets the opposite, so tabs fill notches. Outer edges stay flat.
 */
export function generateCuts(rng: Rng): Cut[] {
  const cuts: Cut[] = Array.from({ length: PIECE_COUNT }, () => ({ t: 0, r: 0, b: 0, l: 0 }));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1) {
        const x: Edge = rng() < 0.5 ? 1 : -1;
        cuts[indexOf(r, c)].r = x;
        cuts[indexOf(r, c + 1)].l = opposite(x);
      }
      if (r < ROWS - 1) {
        const y: Edge = rng() < 0.5 ? 1 : -1;
        cuts[indexOf(r, c)].b = y;
        cuts[indexOf(r + 1, c)].t = opposite(y);
      }
    }
  }
  return cuts;
}

export function pieceType(cut: Cut): PieceType {
  const flat = [cut.t, cut.r, cut.b, cut.l].filter((e) => e === 0).length;
  return flat >= 2 ? 'corner' : flat === 1 ? 'edge' : 'interior';
}
