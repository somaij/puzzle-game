import type { Ref } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderHandlers,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import { rowColOf, type Cut } from '../engine/cuts';
import { colors } from './colors';
import { PieceSvg } from './PieceSvg';

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
  /** A dragged piece is over the hold slot. */
  holdHovered: boolean;
  /** False while the photo is previewed: the slots show empty until play starts. */
  showPieces: boolean;
  /** Attached to the hold slot, for measuring it as a drop target. */
  holdRef?: Ref<View>;
  /** On narrow screens the feed is one row under the board, this many px wide. Omit for the side panel. */
  compactWidth?: number;
};

const SIDE_SLOT = 100;
const COMPACT_GAP = 8;
const COMPACT_PADDING = 10;

/** Slot size that fits the three hand slots and hold in one compact row. */
function compactSlot(width: number) {
  return Math.min(SIDE_SLOT, Math.floor((width - 2 * (COMPACT_PADDING + 1) - 3 * COMPACT_GAP) / 4));
}

// Web only: stop the browser scrolling, zooming or selecting text when a piece is dragged.
const draggableOnWeb =
  Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle) : null;

/** The hand of playable pieces, the hold slot, and how many pieces are left to deal. */
export function FeedPanel(props: Props) {
  const { cuts, image, hand, hold, deckCount, canHold, dragHandlers, dragged, holdHovered, showPieces, holdRef, compactWidth } =
    props;
  const compact = compactWidth !== undefined;
  const size = compact ? compactSlot(compactWidth) : SIDE_SLOT;

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
    <View style={[styles.panel, compact && styles.panelCompact]}>
      <View style={styles.header}>
        <Text style={styles.label}>Hand</Text>
        <Text testID="deck-count" style={styles.deckCount}>
          {deckCount} left in deck
        </Text>
      </View>
      <View style={[styles.slots, { gap: compact ? COMPACT_GAP : 10 }]}>
        {hand.map((piece, i) => (
          <View key={i} testID={`hand-slot-${i}`} style={[styles.slot, styles.handSlot, { width: size, height: size }]}>
            {slotContent(piece)}
          </View>
        ))}
        <View
          ref={holdRef}
          testID="hold-slot"
          style={[styles.slot, styles.holdSlot, { width: size, height: size }, holdHovered && canHold && styles.holdHovered]}
        >
          {slotContent(hold)}
          {/* After the piece, so a held piece doesn't cover it. */}
          <Text style={[styles.holdTag, !canHold && styles.dimmed]}>Hold</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 240,
    gap: 10,
    padding: 14,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
  },
  panelCompact: { width: '100%', padding: COMPACT_PADDING, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  deckCount: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  slots: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  handSlot: { backgroundColor: colors.board },
  holdSlot: { borderColor: colors.line, borderWidth: 1, borderStyle: 'dashed' },
  holdHovered: { borderColor: colors.accent, borderWidth: 2 },
  holdTag: {
    position: 'absolute',
    pointerEvents: 'none',
    top: 4,
    left: 6,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hidden: { opacity: 0 },
  dimmed: { opacity: 0.4 },
});
