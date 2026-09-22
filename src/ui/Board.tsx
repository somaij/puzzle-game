import { useEffect, useState, type Ref } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type ImageSourcePropType, type TextStyle } from 'react-native';

import { COLS, ROWS } from '../engine/constants';
import { rowColOf, type Cut } from '../engine/cuts';
import type { Ghost } from '../engine/game';
import { PIECE_OFFSET, PIECE_SCALE } from '../engine/geometry';
import { colors } from './colors';
import { PieceSvg } from './PieceSvg';

/** Text that rises and fades over a cell, e.g. "+110" or "PULSE". */
export type FloatText = { id: number; cell: number; text: string; color: string; large: boolean; line: number };

type Props = {
  cuts: Cut[];
  image: ImageSourcePropType;
  placed: readonly boolean[];
  /** Pulse ghosts: which cells, and when each disappears (performance.now() clock). */
  ghosts: readonly Ghost[];
  floats: FloatText[];
  onFloatDone: (id: number) => void;
  /** Outer width, including the 1px frame. */
  width: number;
  /** Empty cell under the dragged piece: gets a neutral outline that never says whether it's right. */
  hoverCell: number | null;
  /** Cell a piece was just wrongly dropped on: flashes red. */
  wrongCell: number | null;
  /** Attached to the exact-size play area, for measuring its position on screen. */
  ref?: Ref<View>;
};

const nativeDriver = Platform.OS !== 'web';
const FRAME_BORDER = 1;

// react-native-web wants the CSS shorthand; native wants the separate props.
const textShadow = Platform.select<TextStyle>({
  web: { textShadow: '0 1px 4px rgba(0, 0, 0, 0.6)' } as TextStyle,
  default: { textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowRadius: 4 },
});

/** The bare assembly area. Only placed pieces (and pulse ghosts) are drawn; the grid itself stays hidden. */
export function Board({ cuts, image, placed, ghosts, floats, onFloatDone, width, hoverCell, wrongCell, ref }: Props) {
  const playWidth = width - 2 * FRAME_BORDER;
  const cell = playWidth / COLS;
  const pieceAt = (i: number) => {
    const [row, col] = rowColOf(i);
    return { row, col, left: (col - PIECE_OFFSET) * cell, top: (row - PIECE_OFFSET) * cell, size: PIECE_SCALE * cell };
  };

  return (
    <View style={styles.frame}>
      <View ref={ref} testID="board" style={[styles.board, { width: playWidth, height: cell * ROWS }]}>
        {ghosts.map((g) => (
          <GhostPiece key={`ghost-${g.cell}-${g.until}`} {...pieceAt(g.cell)} cut={cuts[g.cell]} image={image} until={g.until} />
        ))}
        {cuts.map((cut, i) => (placed[i] ? <PlacedPiece key={i} {...pieceAt(i)} cut={cut} image={image} /> : null))}
        {hoverCell !== null && !placed[hoverCell] && <CellOutline index={hoverCell} cell={cell} style={styles.hover} />}
        {wrongCell !== null && <CellOutline index={wrongCell} cell={cell} style={styles.wrong} />}
      </View>
      {/* Outside the clipped play area, so text over the top row can rise above the board. */}
      {floats.map((f) => (
        <RisingText key={f.id} float={f} cell={cell} onDone={onFloatDone} />
      ))}
    </View>
  );
}

type PlacedProps = { row: number; col: number; left: number; top: number; size: number; cut: Cut; image: ImageSourcePropType };

function PlacedPiece({ row, col, left, top, size, cut, image }: PlacedProps) {
  // Lock-in "pop": grows in from 55% with a small overshoot.
  const [scale] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 170, useNativeDriver: nativeDriver }).start();
  }, [scale]);

  return (
    <Animated.View style={[styles.piece, { left, top, transform: [{ scale }] }]}>
      <PieceSvg cut={cut} row={row} col={col} image={image} size={size} />
    </Animated.View>
  );
}

/**
 * A pulse ghost. It fades out over its lifetime so you can see when it will go: slowly at
 * first (still readable for most of it), fastest at the end, reaching 0 as it is removed.
 */
function GhostPiece({ row, col, left, top, size, cut, image, until }: PlacedProps & { until: number }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const remaining = Math.max(0, until - performance.now());
    const fade = Animated.timing(opacity, { toValue: 0, duration: remaining, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver });
    fade.start();
    return () => fade.stop();
  }, [opacity, until]);

  return (
    <Animated.View testID="ghost" style={[styles.piece, { left, top, opacity }]}>
      <PieceSvg cut={cut} row={row} col={col} image={image} size={size} ghost />
    </Animated.View>
  );
}

function CellOutline({ index, cell, style }: { index: number; cell: number; style: object }) {
  const [row, col] = rowColOf(index);
  return <View style={[styles.outline, { left: col * cell, top: row * cell, width: cell, height: cell }, style]} />;
}

function RisingText({ float, cell, onDone }: { float: FloatText; cell: number; onDone: (id: number) => void }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start(() =>
      onDone(float.id),
    );
  }, [progress, float.id, onDone]);

  const [row, col] = rowColOf(float.cell);
  const fontSize = float.large ? 19 : 15;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -cell * 0.9] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });
  return (
    <Animated.Text
      style={[
        styles.float,
        textShadow,
        {
          // Two cells wide and centred on the cell, so the text never wraps.
          left: (col - 0.5) * cell,
          width: cell * 2,
          top: (row + 0.5) * cell - fontSize * 0.7 + float.line * (fontSize + 4),
          color: float.color,
          fontSize,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {float.text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  // The border sits on an outer frame so the play area inside is exactly COLS × ROWS cells.
  frame: { borderColor: colors.line, borderWidth: FRAME_BORDER, borderRadius: 5, alignSelf: 'flex-start' },
  board: { backgroundColor: colors.board, borderRadius: 4, overflow: 'hidden' },
  piece: { position: 'absolute' },
  outline: { position: 'absolute', borderRadius: 4, pointerEvents: 'none' },
  hover: { borderWidth: 2, borderColor: colors.muted },
  wrong: { borderWidth: 3, borderColor: colors.bad },
  float: {
    position: 'absolute',
    textAlign: 'center',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    pointerEvents: 'none',
  },
});
