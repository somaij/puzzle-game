/**
 * The indigo and lemon palette from the Figma design file ("Color" variables). The shipped
 * POC palette it replaced is recorded on the file's "Original (live game, fbc1043)" page.
 */
export const colors = {
  /** The page, and the board's empty play area: one surface, the board marked only by its border. */
  background: '#1f2442',
  /** Recessed wells: hand slots, the rules panel, chips. */
  board: '#14182e',
  /** Raised boxes and panels: score, misses, hand, buttons. */
  surface: '#313b72',
  surfaceRaised: '#3d498f',
  line: '#4c599e',
  text: '#eff1fb',
  muted: '#acb3d7',
  /** Lemon: what a piece is worth (points), selection, primary buttons, key numbers. */
  accent: '#f0f465',
  /**
   * Magenta: the multiplier, i.e. what speed adds. Its own colour so points and the multiplier
   * read as two things; kept on the purple side of `bad` so a gain never looks like a miss.
   * Light enough for 4.5:1 as small text on `surface` (WCAG AA).
   */
  multiplier: '#d690ff',
  onAccent: '#141834',
  meterTrack: '#20274b',
  /** Misses. Light enough for 4.5:1 as small text on `surface` (WCAG AA). */
  bad: '#ff8f96',
  /** Piece outlines, and any edge a player has to see (board, segments, outlined buttons): 3:1+ on every background. */
  pieceOutline: '#7c86c0',
};

/** Semi-transparent versions for overlays. */
export const overlays = {
  /** Behind the onboarding card. */
  backdrop: 'rgba(10, 12, 28, 0.82)',
  /** Behind the photo countdown badge. */
  badge: 'rgba(20, 24, 46, 0.85)',
};
