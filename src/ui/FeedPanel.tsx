import type { Ref } from 'react';
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
import { PieceSvg } from './PieceSvg';
import { Rich } from './Rich';
import { type } from './type';

type Props = {
  cuts: Cut[];
  image: ImageSourcePropType;
  /** The playable hand; null slots are empty (the deck has run out). */
  hand: readonly (number | null)[];
  hold: number | null;
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
  /** Until the first placement: a one-line reminder of how to move a piece. */
  showControls: boolean;
  /** A short status shown in the tab when there's no other hint (e.g. the score is locked). */
  note?: string;
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
 * The hand of playable pieces and the hold slot. Wide screens: a column beside the board, slots
 * stacked. Narrow screens: one row right under the board.
 */
export function FeedPanel(props: Props) {
  const {
    cuts,
    image,
    hand,
    hold,
    canHold,
    dragHandlers,
    dragged,
    selected,
    onHoldPress,
    holdHovered,
    showPieces,
    showControls,
    note,
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
      {/* No label or deck count: the pieces speak for themselves. One line of help, only while it
          helps, as a tab on the panel's top edge so it takes no space and nothing jumps. */}
      {selected !== null ? (
        <View style={styles.tab}>
          <Text testID="tap-hint" style={styles.hint}>
            Tap its spot on the board
          </Text>
        </View>
      ) : showControls ? (
        <View style={styles.tab}>
          <Rich testID="controls" style={styles.controlsLine} text="[Drag] a piece, or [tap] it then its spot" />
        </View>
      ) : note ? (
        <View style={styles.tab}>
          <Text testID="hand-note" style={styles.controlsLine}>
            {note}
          </Text>
        </View>
      ) : null}
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
  // Fills the side column's height above the How to play button.
  panelSide: { width: SIDE_PANEL_WIDTH, flex: 1 },
  panelCompact: { width: '100%', padding: COMPACT_PADDING, gap: 10 },
  tab: {
    position: 'absolute',
    top: -11,
    left: 14,
    zIndex: 1,
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hint: { ...type.small, color: colors.text },
  slotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  // Grows to fill the panel's height (which matches the board column), with the slots centred in it.
  slotsColumn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slot: { alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  handSlot: { backgroundColor: colors.board, borderColor: 'transparent', borderWidth: 2 },
  // White, not lemon: lemon only ever means what a piece is worth.
  selected: { borderColor: colors.text, borderWidth: 2, borderStyle: 'solid' },
  holdSlot: { borderColor: colors.line, borderWidth: 1, borderStyle: 'dashed' },
  holdHovered: { borderColor: colors.text, borderWidth: 2 },
  holdTag: { ...type.small, position: 'absolute', pointerEvents: 'none', top: 4, left: 6, color: colors.muted, fontSize: 10 },
  hidden: { opacity: 0 },
  dimmed: { opacity: 0.4 },
  controlsLine: { ...type.small, color: colors.muted },
});
