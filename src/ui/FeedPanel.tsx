import type { ReactNode, Ref } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderHandlers,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import { HOLD_SLOT } from '../engine/constants';
import { rowColOf, type Cut } from '../engine/cuts';
import { colors } from './colors';
import { Arrow, Chip, MiniSlot, NumberBadge, PhotoPiece, ReturnArrow, ShapePiece, spotShape } from './Pictures';
import { PieceSvg } from './PieceSvg';
import { Rich } from './Rich';
import { type } from './type';

type Props = {
  cuts: Cut[];
  image: ImageSourcePropType;
  /** The playable hand; null slots are empty (the deck has run out). */
  hand: readonly (number | null)[];
  hold: number | null;
  deckCount: number;
  /** Whether a hand piece can be dropped on the hold slot right now. */
  canHold: boolean;
  /** Drag handlers for a playable piece (hand or hold). */
  dragHandlers: (piece: number) => GestureResponderHandlers;
  /** The piece being dragged: hidden here, since the dragged copy is drawn over the screen. */
  dragged: number | null;
  /** The piece selected for tap-to-place, if any: its slot is highlighted. */
  selected: number | null;
  /** The hold slot was tapped (holds the selected piece, if there is one). */
  onHoldPress: () => void;
  /** A dragged piece is over the hold slot, or a hand piece is selected: the slot is a target. */
  holdHovered: boolean;
  /** False while the photo is previewed: the slots show empty until play starts. */
  showPieces: boolean;
  /** Attached to the hold slot, for measuring it as a drop target. */
  holdRef?: Ref<View>;
  /** On narrow screens the feed is one row under the board, this many px wide. Omit for the side panel. */
  compactWidth?: number;
  /** Side panel only: slot size, so a hand piece is drawn about the size it will be on the board. */
  sideSlot?: number;
};

export const SIDE_PANEL_WIDTH = 240;
const SIDE_SLOT = 100;
const SIDE_GAP = 12;
/** On narrow screens the slots share the row's width, up to this size. */
const COMPACT_SLOT_MAX = 120;
const COMPACT_GAP = 8;
const COMPACT_PADDING = 12;

/** Slot size that fits the hand slots (and hold, if on) in one compact row. */
function compactSlot(width: number, slots: number) {
  return Math.min(COMPACT_SLOT_MAX, Math.floor((width - 2 * (COMPACT_PADDING + 1) - (slots - 1) * COMPACT_GAP) / slots));
}

// Web only: stop the browser scrolling, zooming or selecting text when a piece is dragged.
const draggableOnWeb =
  Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle) : null;

/**
 * The hand of playable pieces, the hold slot, how many pieces are left to deal, and how to move
 * a piece. Wide screens: a column beside the board, slots stacked, controls as picture rows.
 * Narrow screens: one row under the board, controls as one line.
 */
export function FeedPanel(props: Props) {
  const {
    cuts,
    image,
    hand,
    hold,
    deckCount,
    canHold,
    dragHandlers,
    dragged,
    selected,
    onHoldPress,
    holdHovered,
    showPieces,
    holdRef,
    compactWidth,
    sideSlot,
  } = props;
  const compact = compactWidth !== undefined;
  const size = compact ? compactSlot(compactWidth, hand.length + (HOLD_SLOT ? 1 : 0)) : (sideSlot ?? SIDE_SLOT);

  const slotContent = (piece: number | null) => {
    if (piece === null || !showPieces) return null;
    const [row, col] = rowColOf(piece);
    return (
      <View {...dragHandlers(piece)} style={[draggableOnWeb, dragged === piece && styles.hidden]}>
        <PieceSvg cut={cuts[piece]} row={row} col={col} image={image} size={size} />
      </View>
    );
  };

  return (
    <View style={[styles.panel, compact ? styles.panelCompact : styles.panelSide]}>
      {/* Side panel: the label above the hint, which is too long to share the narrow column. */}
      <View style={compact ? styles.headerRow : styles.headerStack}>
        <Text style={styles.label}>Your hand</Text>
        {selected === null ? (
          <Text testID="deck-count" style={styles.deckCount}>
            {deckCount} left in deck
          </Text>
        ) : (
          <Text testID="tap-hint" style={styles.hint}>
            Tap its spot on the board
          </Text>
        )}
      </View>
      <View style={[compact ? styles.slotsRow : styles.slotsColumn, { gap: compact ? COMPACT_GAP : SIDE_GAP }]}>
        {hand.map((piece, i) => (
          <View
            key={i}
            testID={`hand-slot-${i}`}
            style={[styles.slot, styles.handSlot, { width: size, height: size }, piece !== null && piece === selected && styles.selected]}
          >
            {slotContent(piece)}
          </View>
        ))}
        {/* Tapping the piece inside goes to its own handlers; this catches taps on an empty slot. */}
        {HOLD_SLOT && (
          <Pressable
            ref={holdRef}
            testID="hold-slot"
            accessibilityLabel="Hold"
            onPress={onHoldPress}
            style={[
              styles.slot,
              styles.holdSlot,
              { width: size, height: size },
              holdHovered && canHold && styles.holdHovered,
              hold !== null && hold === selected && styles.selected,
            ]}
          >
            {slotContent(hold)}
            {/* After the piece, so a held piece doesn't cover it. */}
            <Text style={[styles.holdTag, !canHold && styles.dimmed]}>Hold</Text>
          </Pressable>
        )}
      </View>
      {compact ? (
        <Rich
          testID="controls"
          style={styles.controlsLine}
          text="[Drag] it onto its spot, or [tap it, then tap its spot]. Off the board is free."
        />
      ) : (
        <Controls cuts={cuts} image={image} />
      )}
    </View>
  );
}

/** The cell whose piece the controls show. Fixed, so the pictures don't change mid-game. */
const DEMO: [number, number] = [2, 4];
const DEMO_SIZE = 30;

/** How to move a piece, right where it's needed: three small picture rows under the hand. */
function Controls({ cuts, image }: { cuts: Cut[]; image: ImageSourcePropType }) {
  const [row, col] = DEMO;
  const slot = <MiniSlot cuts={cuts} image={image} row={row} col={col} size={DEMO_SIZE} selected />;
  const spot = <ShapePiece cuts={cuts} row={row} col={col} size={DEMO_SIZE} shape={spotShape} />;
  const badged = (node: ReactNode, n: number) => (
    <View>
      {node}
      <NumberBadge n={n} style={styles.badge} />
    </View>
  );
  const rows: { key: string; picture: ReactNode[]; text: string }[] = [
    { key: 'drag', picture: [slot, <Arrow key="a" />, spot], text: '[Drag] it onto its spot' },
    { key: 'tap', picture: [badged(slot, 1), <Arrow key="a" />, badged(spot, 2)], text: '[Or tap] it, then tap its spot' },
    {
      key: 'return',
      picture: [
        <PhotoPiece key="p" cuts={cuts} image={image} row={row} col={col} size={DEMO_SIZE} />,
        <ReturnArrow key="r" width={22} />,
        <View key="s" style={styles.emptySlot} />,
      ],
      text: '[Toss it off the board], no harm done',
    },
  ];
  return (
    <View testID="controls" style={styles.controls}>
      {rows.map((r) => (
        <View key={r.key} style={styles.controlRow}>
          <Chip well style={styles.controlChip}>
            {r.picture.map((node, i) => (
              <View key={i}>{node}</View>
            ))}
          </Chip>
          <Rich text={r.text} style={styles.controlText} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
  },
  panelSide: { width: SIDE_PANEL_WIDTH, alignSelf: 'stretch' },
  panelCompact: { width: '100%', padding: COMPACT_PADDING, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  headerStack: { gap: 4 },
  label: { ...type.labelLarge, color: colors.muted },
  deckCount: { ...type.smallTabular, color: colors.muted },
  hint: { ...type.small, color: colors.accent },
  slotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  // Grows to fill the panel's height (which matches the board column), with the slots centred in it.
  slotsColumn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slot: { alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  handSlot: { backgroundColor: colors.board, borderColor: 'transparent', borderWidth: 2 },
  selected: { borderColor: colors.accent, borderWidth: 2, borderStyle: 'solid' },
  holdSlot: { borderColor: colors.line, borderWidth: 1, borderStyle: 'dashed' },
  holdHovered: { borderColor: colors.accent, borderWidth: 2 },
  holdTag: { ...type.small, position: 'absolute', pointerEvents: 'none', top: 4, left: 6, color: colors.muted, fontSize: 10 },
  hidden: { opacity: 0 },
  dimmed: { opacity: 0.4 },
  controlsLine: { ...type.small, lineHeight: 17, color: colors.muted },
  controls: { gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  controlChip: { width: 84, minHeight: 40, paddingVertical: 4, paddingHorizontal: 8, gap: 6, justifyContent: 'center' },
  controlText: { ...type.small, lineHeight: 15, color: colors.muted, flex: 1 },
  badge: { position: 'absolute', top: -6, right: -7 },
  emptySlot: { width: 26, height: 26, borderRadius: 6, backgroundColor: colors.board, borderWidth: 1, borderColor: colors.pieceOutline },
});
