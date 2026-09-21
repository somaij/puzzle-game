import { useRef, useState } from 'react';
import { Animated, Platform, type GestureResponderEvent, type GestureResponderHandlers } from 'react-native';

type Options = {
  enabled: boolean;
  /** Drawn size of the dragged piece's box, in px. */
  pieceSize: number;
  /** The board cell under a window point, or null if the point is off the board. */
  cellAt: (x: number, y: number) => number | null;
  onStart: () => void;
  /** Called on release with the cell under the piece's centre (null = off the board). */
  onDrop: (cell: number | null) => void;
};

/** On touch screens the dragged piece is drawn this many piece-heights above the finger, so it isn't hidden. */
const TOUCH_LIFT = 0.75;

function isTouchScreen(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

/**
 * Drag handling for the current piece. Spread `handlers` onto the piece in the feed, and draw
 * the dragged copy at `position` (its top-left corner, in window coordinates) while `dragging`.
 */
export function usePieceDrag({ enabled, pieceSize, cellAt, onStart, onDrop }: Options) {
  const [position] = useState(() => new Animated.ValueXY());
  const [dragging, setDragging] = useState(false);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  // Per-drag values that change on every move, kept out of state to avoid re-rendering each frame.
  const gesture = useRef({ lift: 0, x: 0, y: 0, hover: null as number | null });

  // The piece centre follows the pointer, lifted above it on touch screens.
  const track = (e: GestureResponderEvent) => {
    const g = gesture.current;
    g.x = e.nativeEvent.pageX;
    g.y = e.nativeEvent.pageY - g.lift;
  };

  const moveTo = (e: GestureResponderEvent) => {
    track(e);
    const g = gesture.current;
    position.setValue({ x: g.x - pieceSize / 2, y: g.y - pieceSize / 2 });
    const cell = cellAt(g.x, g.y);
    if (cell !== g.hover) {
      g.hover = cell;
      setHoverCell(cell);
    }
  };

  const finish = (drop: boolean) => {
    const g = gesture.current;
    const cell = cellAt(g.x, g.y);
    g.hover = null;
    setHoverCell(null);
    setDragging(false);
    if (drop) onDrop(cell);
  };

  const handlers: GestureResponderHandlers = {
    onStartShouldSetResponder: () => enabled,
    onMoveShouldSetResponder: () => enabled,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e) => {
      onStart();
      gesture.current.lift = isTouchScreen() ? pieceSize * TOUCH_LIFT : 0;
      setDragging(true);
      moveTo(e);
      // true = keep native views (the screen's ScrollView on Android) from taking over the touch.
      // On web the piece's `touchAction: 'none'` does the same job.
      return true;
    },
    onResponderMove: moveTo,
    // Use the release point itself: the last move event can lag behind a fast flick.
    onResponderRelease: (e) => {
      track(e);
      finish(true);
    },
    onResponderTerminate: () => finish(false),
  };

  return { handlers, dragging, position, hoverCell };
}
