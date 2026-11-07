import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { indexOf, type Cut } from '../engine/cuts';
import { PIECE_OFFSET, PIECE_SCALE } from '../engine/geometry';
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

/** A hand slot holding a piece, as in the hand. */
export function MiniSlot({
  cuts,
  image,
  row,
  col,
  size,
  selected = false,
}: CutsProp & { image: ImageSourcePropType; row: number; col: number; size: number; selected?: boolean }) {
  return (
    <View style={[styles.slot, { width: size, height: size }, selected && styles.slotSelected]}>
      <PhotoPiece cuts={cuts} image={image} row={row} col={col} size={size - 4} />
    </View>
  );
}

/** The misses-left pips: `left` bright, `used` dim. */
export function Pips({ left, used, size = 10 }: { left: number; used: number; size?: number }) {
  return (
    <View style={styles.row4}>
      {Array.from({ length: left + used }, (_, i) => (
        <View
          key={i}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: i < left ? colors.text : colors.line }}
        />
      ))}
    </View>
  );
}

/** A short multiplier meter, `level` 0–1 full. */
export function Meter({ level, width = 60 }: { level: number; width?: number }) {
  return (
    <View style={[styles.meter, { width }]}>
      <View style={[styles.meterFill, { width: level * width }]} />
    </View>
  );
}

/** A small numbered circle, for the order of taps. */
export function NumberBadge({ n, style }: { n: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{n}</Text>
    </View>
  );
}

export function Arrow() {
  return <Text style={styles.arrow}>→</Text>;
}

/** A curved arrow, from a piece back into the hand. */
export function ReturnArrow({ width = 26 }: { width?: number }) {
  const h = width * 0.45;
  return (
    <Svg width={width} height={h} viewBox="0 0 26 12">
      <Path d="M1 11 C 7 1, 19 1, 25 11" fill="none" stroke={colors.muted} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M20.5 8.5 L 25 11 L 25.5 6" fill="none" stroke={colors.muted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Where a piece's padded box sits relative to its cell, for overlapping pictures. */
export const pieceInset = (size: number) => (size / PIECE_SCALE) * PIECE_OFFSET;

/** A tiny piece outline in the accent colour, for decoration (the rules title). */
export function DoodlePiece({ cuts, size = 28 }: CutsProp & { size?: number }) {
  return (
    <View style={{ transform: [{ rotate: '14deg' }] }}>
      <ShapePiece cuts={cuts} row={1} col={1} size={size} shape={{ stroke: colors.accent, strokeWidth: 8 }} />
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
  slot: { alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.board, borderWidth: 1.5, borderColor: 'transparent' },
  slotSelected: { borderColor: colors.accent },
  row4: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.meterTrack, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  badge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  badgeText: { ...type.small, fontSize: 10, lineHeight: 12, color: colors.onAccent },
  arrow: { ...type.small, color: colors.muted },
});
