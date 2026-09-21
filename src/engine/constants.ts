// Board. Daily images are 3:2, so a 6×4 grid gives square cells (required by the piece geometry).
export const COLS = 6;
export const ROWS = 4;
export const PIECE_COUNT = COLS * ROWS;

// Piece geometry, in units of a 100×100 cell.
export const CELL = 100;
export const TAB_DEPTH = 14; // how far a tab sticks out past the cell edge
export const PAD = 18; // margin drawn around each cell so tabs and outlines aren't clipped

// Wrong drops allowed per puzzle; the one that uses up the last ends the game (like running out of guesses in Wordle).
// Was 6; raised to 10 after playtesting found 6 too punishing.
export const MISS_LIMIT = 10;

// Scoring and flow. The multiplier is stored in whole tenths (10 = 1.0×) so repeated
// steps can't drift the way floating-point decimals do.
export const ISLAND_POINTS = 100;
export const SNAP_POINTS = 25;
export const FAST_MS = 3500;
export const MULT_MIN_TENTHS = 10;
export const MULT_MAX_TENTHS = 15;
export const MULT_STEP_TENTHS = 1;
export const STALL_MS = 4000;
export const DECAY_TICK_MS = 1000;
export const WRONG_PENALTY_TENTHS = 1;
export const PULSE_RADIUS = 1;
export const PULSE_MS = 4200;
