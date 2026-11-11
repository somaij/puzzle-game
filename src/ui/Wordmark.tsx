import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { pathFor } from '../engine/geometry';
import { colors } from './colors';
import { WORDMARK } from './wordmarkPaths';

/** The piece that dots the i: tabs out on top and to the right, like the brand mock-up. */
const PIECE = pathFor({ t: 1, r: 1, b: 0, l: 0 });
/** The middle of that piece's outline (its tabs reach 14 past the 100 box on two sides). */
const PIECE_CENTRE = { x: 57, y: 43 };
/** The piece's body is a little bigger than the round dot it replaces. */
const PIECE_SCALE = (WORDMARK.dot.size * 1.15) / 100;

/** The traced letters' extent in font units: from the top of the piece to the bottom of the g and p. */
const VIEW = { x: 0, y: 170, width: WORDMARK.width + 20, height: 1110 };

/**
 * "Jigsup": "Jigs" in white, "up" in lemon, with a lemon jigsaw piece for the dot on the i (see
 * the Brand section of CLAUDE.md). Drawn from paths traced from the bundled font, so it looks the
 * same everywhere. `height` sets the size; the width follows.
 */
export function Wordmark({ height }: { height: number }) {
  const piece = `translate(${WORDMARK.dot.cx - PIECE_CENTRE.x * PIECE_SCALE} ${WORDMARK.dot.cy - PIECE_CENTRE.y * PIECE_SCALE}) scale(${PIECE_SCALE})`;
  // The heading role goes on a wrapper: on web, giving it to the Svg itself renders an <h1>
  // instead of the drawing.
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Jigsup">
      <Svg width={(height * VIEW.width) / VIEW.height} height={height} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}>
        <Path d={WORDMARK.jigs} fill={colors.text} />
        <Path d={WORDMARK.up} fill={colors.accent} />
        <G transform={piece}>
          <Path d={PIECE} fill={colors.accent} />
        </G>
      </Svg>
    </View>
  );
}
