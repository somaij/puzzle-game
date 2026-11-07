import { useId } from 'react';
import type { ImageSourcePropType } from 'react-native';
import Svg, { ClipPath, Defs, Image, Path } from 'react-native-svg';

import { CELL, COLS, ROWS } from '../engine/constants';
import type { Cut } from '../engine/cuts';
import { pathFor, PIECE_VIEWBOX } from '../engine/geometry';
import { colors } from './colors';

/** A piece drawn as a plain shape, with no photo: the small pictures in the rules and onboarding. */
export type PieceShape = {
  fill?: string;
  stroke: string;
  /** In viewBox units (a cell is 100), so it scales with the piece. */
  strokeWidth?: number;
  dashed?: boolean;
  strokeOpacity?: number;
};

type Props = {
  cut: Cut;
  row: number;
  col: number;
  /** Not needed for a plain `shape`. */
  image?: ImageSourcePropType;
  /** Width and height of the drawn box (the cell plus its tab margin), in px. */
  size: number;
  /** Pulse ghost: faint image with a soft dashed outline. */
  ghost?: boolean;
  /** Draw the cut as a plain shape instead of the photo. */
  shape?: PieceShape;
  /** Overrides the outline colour of a photo piece (e.g. the selected piece in a picture). */
  stroke?: string;
};

/** One jigsaw piece: its slice of the image, clipped to its cut, with an outline. */
export function PieceSvg({ cut, row, col, image, size, ghost = false, shape, stroke }: Props) {
  // On web every SVG id shares the page's namespace, so each drawn piece needs its own.
  const clipId = 'clip' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  const d = pathFor(cut);
  if (shape) {
    return (
      <Svg width={size} height={size} viewBox={PIECE_VIEWBOX}>
        <Path
          d={d}
          fill={shape.fill ?? 'none'}
          stroke={shape.stroke}
          strokeOpacity={shape.strokeOpacity ?? 1}
          strokeWidth={shape.strokeWidth ?? 5}
          strokeDasharray={shape.dashed ? '12 10' : undefined}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox={PIECE_VIEWBOX}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={d} />
        </ClipPath>
      </Defs>
      {/* The whole image, shifted so this piece's cell lines up with the piece's box. */}
      {image !== undefined && (
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
      )}
      {/* Ghosts get a soft white dashed outline: a quiet hint, so the yellow stays for things you did. */}
      <Path
        d={d}
        fill="none"
        stroke={ghost ? colors.text : (stroke ?? colors.pieceOutline)}
        strokeOpacity={ghost ? 0.55 : 1}
        strokeWidth={ghost ? 1.8 : 2.2}
        strokeDasharray={ghost ? '6 5' : undefined}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
