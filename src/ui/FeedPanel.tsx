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

import { rowColOf, type Cut } from '../engine/cuts';
import { colors } from './colors';
import { PieceSvg } from './PieceSvg';

type Props = {
  cuts: Cut[];
  image: ImageSourcePropType;
  current: number | null;
  hold: number | null;
  upcoming: number[];
  canHold: boolean;
  onHold: () => void;
  /** Drag handlers for the current piece. */
  dragHandlers: GestureResponderHandlers;
  /** While dragging, the current piece is hidden here (the dragged copy is drawn over the screen). */
  dragging: boolean;
  /** On narrow screens the feed is one row under the board, this many px wide. Omit for the side panel. */
  compactWidth?: number;
};

/** Piece sizes that fit one compact row: padding, borders and gaps take 62px; the rest splits current 2 : hold 1.4 : next 1 (×3). */
function compactSizes(width: number) {
  const next = Math.min(46, Math.floor((width - 62) / 6.4));
  return { current: next * 2, hold: Math.round(next * 1.4), next };
}

// Web only: stop the browser scrolling, zooming or selecting text when a piece is dragged.
const draggableOnWeb =
  Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle) : null;

/** The one-at-a-time feed: current piece, hold slot, and the next few pieces. */
export function FeedPanel(props: Props) {
  const { cuts, image, current, hold, upcoming, canHold, onHold, dragHandlers, dragging, compactWidth } = props;
  const compact = compactWidth !== undefined;
  const sizes = compact ? compactSizes(compactWidth) : { current: 120, hold: 72, next: 54 };
  const piece = (i: number, size: number) => {
    const [row, col] = rowColOf(i);
    return <PieceSvg cut={cuts[i]} row={row} col={col} image={image} size={size} />;
  };

  return (
    <View style={[styles.panel, compact && styles.panelCompact]}>
      <View style={styles.section}>
        <Text style={styles.label}>Current</Text>
        <View
          testID="current-piece"
          {...dragHandlers}
          style={[styles.slot, { width: sizes.current, height: sizes.current }, draggableOnWeb, dragging && styles.hidden]}
        >
          {current !== null && piece(current, sizes.current)}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Hold{!compact && Platform.OS === 'web' ? ' (Space)' : ''}</Text>
        <Pressable
          testID="hold-slot"
          accessibilityRole="button"
          accessibilityLabel="Hold piece"
          disabled={!canHold}
          onPress={onHold}
          style={[styles.slot, styles.holdSlot, { width: sizes.hold, height: sizes.hold }, !canHold && styles.dimmed]}
        >
          {hold !== null && piece(hold, sizes.hold)}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Next</Text>
        <View style={styles.queue}>
          {upcoming.map((i) => (
            <View key={i} style={{ width: sizes.next, height: sizes.next }}>
              {piece(i, sizes.next)}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 240,
    gap: 18,
    padding: 14,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
  },
  panelCompact: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 10 },
  section: { gap: 8 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  slot: { alignItems: 'center', justifyContent: 'center' },
  holdSlot: { borderColor: colors.line, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8 },
  queue: { flexDirection: 'row', gap: 6 },
  hidden: { opacity: 0 },
  dimmed: { opacity: 0.5 },
});
