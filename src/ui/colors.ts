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
  /** The one highlight colour: selection, multiplier, points, primary buttons, key numbers. */
  accent: '#f0f465',
  onAccent: '#141834',
  meterTrack: '#20274b',
  bad: '#ff5f6b',
  pieceOutline: '#7c86c0',
};

/** Semi-transparent versions for overlays. */
export const overlays = {
  /** Behind the onboarding card. */
  backdrop: 'rgba(10, 12, 28, 0.82)',
  /** Behind the photo countdown badge. */
  badge: 'rgba(20, 24, 46, 0.85)',
};
