import { useId } from 'react';
import type { ImageSourcePropType } from 'react-native';
import Svg, { ClipPath, Defs, Image, Path } from 'react-native-svg';

import { CELL, COLS, ROWS } from '../engine/constants';
import type { Cut } from '../engine/cuts';
import { pathFor, PIECE_VIEWBOX } from '../engine/geometry';
import { colors } from './colors';

type Props = {
  cut: Cut;
  row: number;
  col: number;
  image: ImageSourcePropType;
  /** Width and height of the drawn box (the cell plus its tab margin), in px. */
  size: number;
  /** Pulse ghost: faint image with a dashed outline. */
  ghost?: boolean;
};

/** One jigsaw piece: its slice of the image, clipped to its cut, with an outline. */
export function PieceSvg({ cut, row, col, image, size, ghost = false }: Props) {
  // On web every SVG id shares the page's namespace, so each drawn piece needs its own.
  const clipId = 'clip' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  const d = pathFor(cut);
  return (
    <Svg width={size} height={size} viewBox={PIECE_VIEWBOX}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={d} />
        </ClipPath>
      </Defs>
      {/* The whole image, shifted so this piece's cell lines up with the piece's box. */}
      <Image
        href={image}
        x={-col * CELL}
        y={-row * CELL}
        width={COLS * CELL}
        height={ROWS * CELL}
        preserveAspectRatio="none"
        clipPath={`url(#${clipId})`}
        opacity={ghost ? 0.4 : 1}
      />
      <Path
        d={d}
        fill="none"
        stroke={ghost ? colors.accent : colors.pieceOutline}
        strokeWidth={ghost ? 2.6 : 2.2}
        strokeDasharray={ghost ? '6 5' : undefined}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
