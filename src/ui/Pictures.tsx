import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { indexOf, type Cut } from '../engine/cuts';
import { PIECE_SCALE } from '../engine/geometry';
import { colors } from './colors';
import { PieceSvg, type PieceShape } from './PieceSvg';
import { type } from './type';

/**
 * Small pictures made from the game's own parts (pieces, pips, the meter), for the rules, the
 * hand's controls and the onboarding card. They copy what is on screen so a player can match
 * a rule to the thing it explains. Pieces use today's cuts, so the shapes are real ones.
 */

/** The rounded box a picture sits in. */
export function Chip({ children, style, well = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; well?: boolean }) {
  return <View style={[styles.chip, { backgroundColor: well ? colors.board : colors.surface }, style]}>{children}</View>;
}

type CutsProp = { cuts: Cut[] };

/** One piece as a plain shape. `size` is the padded piece box. */
export function ShapePiece({ cuts, row, col, size, shape }: CutsProp & { row: number; col: number; size: number; shape: PieceShape }) {
  return <PieceSvg cut={cuts[indexOf(row, col)]} row={row} col={col} size={size} shape={shape} />;
}

/** One piece with its slice of the photo. */
export function PhotoPiece({
  cuts,
  image,
  row,
  col,
  size,
  stroke,
}: CutsProp & { image: ImageSourcePropType; row: number; col: number; size: number; stroke?: string }) {
  return <PieceSvg cut={cuts[indexOf(row, col)]} row={row} col={col} image={image} size={size} stroke={stroke} />;
}

/**
 * Neighbouring pieces laid out as on the board, so their tabs interlock. `cells` are
 * [row, col] pairs; each is drawn with `shapeFor` (or the photo, if it returns null).
 */
export function Cluster({
  cuts,
  image,
  cells,
  size,
  shapeFor,
}: CutsProp & {
  image?: ImageSourcePropType;
  cells: [number, number][];
  size: number;
  shapeFor: (row: number, col: number) => PieceShape | null;
}) {
  const cell = size / PIECE_SCALE;
  const minRow = Math.min(...cells.map((c) => c[0]));
  const minCol = Math.min(...cells.map((c) => c[1]));
  const rows = Math.max(...cells.map((c) => c[0])) - minRow + 1;
  const cols = Math.max(...cells.map((c) => c[1])) - minCol + 1;
  return (
    <View style={{ width: cols * cell + (size - cell), height: rows * cell + (size - cell) }}>
      {cells.map(([row, col]) => {
        const shape = shapeFor(row, col);
        return (
          <View key={`${row}-${col}`} style={[styles.abs, { left: (col - minCol) * cell, top: (row - minRow) * cell }]}>
            {shape || !image ? (
              <ShapePiece cuts={cuts} row={row} col={col} size={size} shape={shape ?? plainShape} />
            ) : (
              <PhotoPiece cuts={cuts} image={image} row={row} col={col} size={size} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/** A placed piece, drawn plainly. */
export const plainShape: PieceShape = { fill: colors.surfaceRaised, stroke: colors.pieceOutline, strokeWidth: 5 };
/** A lone (island) piece: the one worth more. */
export const loneShape: PieceShape = { fill: colors.surfaceRaised, stroke: colors.accent, strokeWidth: 7 };
/** An empty spot: a dashed outline, as on the board. */
export const spotShape: PieceShape = { stroke: colors.text, strokeOpacity: 0.6, strokeWidth: 5, dashed: true };

export function Arrow() {
  return <Text style={styles.arrow}>→</Text>;
}

/** A tiny tilted piece outline, for decoration (the rules title). */
export function DoodlePiece({ cuts, size = 28 }: CutsProp & { size?: number }) {
  return (
    <View style={{ transform: [{ rotate: '14deg' }] }}>
      <ShapePiece cuts={cuts} row={1} col={1} size={size} shape={{ stroke: colors.text, strokeWidth: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  abs: { position: 'absolute' },
  arrow: { ...type.small, color: colors.muted },
});
