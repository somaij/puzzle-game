// Board. Daily images are 3:2, so a 6×4 grid gives square cells (required by the piece geometry).
export const COLS = 6;
export const ROWS = 4;
export const PIECE_COUNT = COLS * ROWS;

// Piece geometry, in units of a 100×100 cell.
export const CELL = 100;
export const TAB_DEPTH = 14; // how far a tab sticks out past the cell edge
export const PAD = 18; // margin drawn around each cell so tabs and outlines aren't clipped

// Pieces you can play from at once. Keep it small: a full tray brings back the cramped-pieces problem.
export const HAND_SIZE = 3;

// Whether the game offers the hold slot. Off while playtesting a plain hand of 3 (simpler, and
// bigger pieces on phones; simulated, it forces about as many islands as a hand of 2 + hold).
// The engine's hold rules (`holdPiece`, `canHold`) stay in place and tested, so turning it back on
// is just this flag.
export const HOLD_SLOT = false;

// How long the finished photo is shown before play starts.
export const FLASH_MS = 10000;

// Wrong drops allowed per puzzle; the one that uses up the last ends the game (like running out of guesses in Wordle).
// Started at 6; raised to 10, then 12, after playtesting found it too punishing.
export const MISS_LIMIT = 12;
// Finishing the puzzle pays this per unused miss, so accuracy counts in the score: without it a
// fast guesser scored within a few % of a careful player (the 0.1× a miss costs is soon won back).
export const UNUSED_MISS_POINTS = 50;

// Scoring and flow. The multiplier is stored in whole tenths (10 = 1.0×) so repeated
// steps can't drift the way floating-point decimals do.
export const ISLAND_POINTS = 100;
export const SNAP_POINTS = 25;
export const FAST_MS = 3000; // a placement this soon after the previous one (or the start) is fast
export const MULT_MIN_TENTHS = 10;
export const MULT_MAX_TENTHS = 20; // raised from 1.5× so fast play keeps paying past the fifth placement
export const MULT_STEP_TENTHS = 1;
export const STALL_MS = 5000; // idle grace; the first −0.1 lands one DECAY_TICK_MS later (6 s)
export const DECAY_TICK_MS = 1000;
export const WRONG_PENALTY_TENTHS = 1;
export const PULSE_RADIUS = 1;
export const PULSE_MS = 6000;
