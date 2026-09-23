import { useRef, useState } from 'react';
import { Animated, Platform, type GestureResponderEvent, type GestureResponderHandlers } from 'react-native';

/** Where a dragged piece can land: a board cell, or the hold slot. */
export type DropTarget = { kind: 'cell'; cell: number } | { kind: 'hold' };

type Options = {
  enabled: boolean;
  /** Drawn size of the dragged piece's box, in px. */
  pieceSize: number;
  /** What's under a window point: a board cell, the hold slot, or null for nowhere. */
  targetAt: (x: number, y: number) => DropTarget | null;
  onStart: () => void;
  /** Called on release with the piece and what's under its centre (null = nowhere). */
  onDrop: (piece: number, target: DropTarget | null) => void;
};

/** On touch screens the dragged piece is drawn this many piece-heights above the finger, so it isn't hidden. */
const TOUCH_LIFT = 0.75;

function isTouchScreen(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

const keyOf = (t: DropTarget | null) => (t === null ? '' : t.kind === 'hold' ? 'hold' : `cell${t.cell}`);
const sameTarget = (a: DropTarget | null, b: DropTarget | null) => keyOf(a) === keyOf(b);

/**
 * Drag handling for the playable pieces. Spread `handlersFor(piece)` onto each piece in the
 * feed, and draw the dragged copy of `dragged` at `position` (its top-left corner, in window
 * coordinates).
 */
export function usePieceDrag({ enabled, pieceSize, targetAt, onStart, onDrop }: Options) {
  const [position] = useState(() => new Animated.ValueXY());
  const [dragged, setDragged] = useState<number | null>(null);
  const [hover, setHover] = useState<DropTarget | null>(null);
  // Per-drag values that change on every move, kept out of state to avoid re-rendering each frame.
  const gesture = useRef({ piece: -1, lift: 0, x: 0, y: 0, hover: null as DropTarget | null });

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
    const target = targetAt(g.x, g.y);
    if (!sameTarget(target, g.hover)) {
      g.hover = target;
      setHover(target);
    }
  };

  const finish = (drop: boolean) => {
    const g = gesture.current;
    const target = targetAt(g.x, g.y);
    g.hover = null;
    setHover(null);
    setDragged(null);
    if (drop) onDrop(g.piece, target);
  };

  const handlersFor = (piece: number): GestureResponderHandlers => ({
    onStartShouldSetResponder: () => enabled,
    onMoveShouldSetResponder: () => enabled,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e) => {
      onStart();
      gesture.current.piece = piece;
      gesture.current.lift = isTouchScreen() ? pieceSize * TOUCH_LIFT : 0;
      setDragged(piece);
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
  });

  return {
    handlersFor,
    dragged,
    position,
    hoverCell: hover?.kind === 'cell' ? hover.cell : null,
    hoverHold: hover?.kind === 'hold',
  };
}
