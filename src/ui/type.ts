import type { TextStyle } from 'react-native';

/**
 * The two bundled fonts (assets/fonts, SIL Open Font License): Varela Round for body text,
 * labels and buttons, Shantell Sans for titles, numbers and the rising points. Loaded in App.
 *
 * Each weight is its own family, so styles set `fontFamily` and never `fontWeight` (a weight on
 * a single-weight family makes the browser fake a bold). Varela Round has only one weight, so
 * emphasis in body text comes from colour, not boldness.
 *
 * Shantell is subset to plain ASCII plus the few symbols the game uses (× − → • … quotes and
 * dashes), without its alternate letter shapes, which keeps it at ~35 KB a weight. Any other
 * character falls back to the system font: re-run the subset (see assets/fonts/README.md) if
 * the UI needs more.
 */
export const FONT_FILES = {
  VarelaRound: require('../../assets/fonts/VarelaRound_400Regular.ttf'),
  'ShantellSans-Bold': require('../../assets/fonts/ShantellSans_700Bold.ttf'),
  'ShantellSans-ExtraBold': require('../../assets/fonts/ShantellSans_800ExtraBold.ttf'),
};

const text: TextStyle = { fontFamily: 'VarelaRound' };
const display: TextStyle = { fontFamily: 'ShantellSans-Bold' };
const displayHeavy: TextStyle = { fontFamily: 'ShantellSans-ExtraBold' };
const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Text roles, matching the Figma file's text styles of the same names. Colour is set by each use. */
export const type = {
  titleScreen: { ...displayHeavy, fontSize: 20 },
  titleCard: { ...displayHeavy, fontSize: 24 },
  titleSection: { ...displayHeavy, fontSize: 17 },
  label: { ...text, fontSize: 12 },
  labelLarge: { ...text, fontSize: 13 },
  valueScore: { ...display, ...tabular, fontSize: 18 },
  valueMultiplier: { ...display, ...tabular, fontSize: 16 },
  valueEndScore: { ...display, ...tabular, fontSize: 30 },
  valueCountdown: { ...displayHeavy, ...tabular, fontSize: 20 },
  valueCount: { ...display, ...tabular, fontSize: 14 },
  body: { ...text, fontSize: 14, lineHeight: 21 },
  bodyStrong: { ...display, fontSize: 14, lineHeight: 21 },
  rules: { ...text, fontSize: 14, lineHeight: 20 },
  small: { ...text, fontSize: 12 },
  smallTabular: { ...text, ...tabular, fontSize: 12 },
  button: { ...text, fontSize: 13 },
  buttonPrimary: { ...text, fontSize: 14 },
  buttonLarge: { ...text, fontSize: 16 },
  glyph: { ...text, fontSize: 13 },
  floatLarge: { ...displayHeavy, ...tabular, fontSize: 19 },
  floatSmall: { ...displayHeavy, ...tabular, fontSize: 15 },
} satisfies Record<string, TextStyle>;
