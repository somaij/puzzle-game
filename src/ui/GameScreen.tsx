import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderHandlers,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import { COLS, FLASH_MS, MULT_MIN_TENTHS, PIECE_COUNT, ROWS, UNUSED_MISS_POINTS } from '../engine/constants';
import { indexOf, rowColOf } from '../engine/cuts';
import { PIECE_SCALE } from '../engine/geometry';
import type { Puzzle } from '../engine/daily';
import {
  canHold,
  decayStartsAt,
  dropPiece,
  holdPiece,
  missesLeft,
  newGame,
  tick,
  type Miss,
  type Placement,
} from '../engine/game';
import { getStoredFlag, setStoredFlag } from '../storage';
import { Board, type FloatText } from './Board';
import { colors } from './colors';
import { FeedPanel, SIDE_PANEL_WIDTH } from './FeedPanel';
import { HowToPlay } from './HowToPlay';
import { OnboardingModal } from './OnboardingModal';
import { PhotoPreview } from './PhotoPreview';
import { PieceSvg } from './PieceSvg';
import { ScoreBar, withCommas } from './ScoreBar';
import { type } from './type';
import { TAP_SLOP, usePieceDrag, type DropTarget } from './usePieceDrag';

type Props = {
  puzzle: Puzzle;
  image: ImageSourcePropType;
  /** Highest puzzle number the ‹ › buttons can switch to. */
  lastPuzzle: number;
  onSelectPuzzle: (n: number) => void;
};

type Rect = { x: number; y: number; width: number; height: number };

const WIDE_LAYOUT_MIN = 760;
/** Below this width the onboarding card stacks its steps. */
const NARROW_CARD_MAX = 520;
const PANEL_WIDTH = SIDE_PANEL_WIDTH;
// Spacing (8-point scale): bigger gaps between groups than inside them.
const GAP_WIDE = 24;
const GAP_NARROW = 16;
const SIDE_PADDING = 16;
/** Header (32) + gap + score bar (79) + gap, above the board in the wide layout. */
const ABOVE_BOARD = 32 + 16 + 79 + 16;
/** The side panel's fixed parts: border, padding, header and its gap, controls and their gap, gaps between 3 slots. */
const SIDE_PANEL_CHROME = 2 + 32 + 34 + 16 + 160 + 16 + 2 * 12;
/** Largest hand slot on the side panel. */
const SIDE_SLOT_MAX = 208;
const WRONG_FLASH_MS = 300;
/** How often the clocks (flow decay, ghost fade) are advanced. */
const TICK_MS = 100;
/** The dragged piece's box relative to a cell, as in the POC: its body is ~82% of a cell, so the outline of the cell under it stays visible. */
const DRAG_SCALE = 1.12;
/** Bump this to make the onboarding popup show again for everyone (a content change, say). */
const ONBOARDING_KEY = 'onboarding-seen-v1';

// Web only: taps on the game shouldn't zoom the page (double-tap) or open the long-press menu.
const noTouchZoomOnWeb =
  Platform.OS === 'web' ? ({ touchAction: 'manipulation', WebkitTouchCallout: 'none' } as unknown as ViewStyle) : null;

/** One monotonic clock for everything the engine times. */
const now = () => performance.now();

export function GameScreen({ puzzle, image, lastPuzzle, onSelectPuzzle }: Props) {
  const [game, setGame] = useState(() => newGame(puzzle, now()));
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(wrongTimer.current), []);

  // Shown once per browser (see storage.ts), or any time from the header's "?" button.
  const [onboardingVisible, setOnboardingVisible] = useState(() => getStoredFlag(ONBOARDING_KEY) !== '1');
  // Each board waits on a Start button ('ready'), then shows the finished photo briefly
  // ('previewing'), then play and its clocks start ('playing'). The photo only shows once the
  // player asks for it, so opening the page (or switching puzzles) while looking away wastes nothing.
  const [phase, setPhase] = useState<'ready' | 'previewing' | 'playing'>('ready');
  const started = phase === 'playing';
  const startPreview = () => setPhase('previewing');
  const endPreview = useCallback(() => {
    setPhase('playing');
    setGame(newGame(puzzle, now()));
  }, [puzzle]);

  const dismissOnboarding = () => {
    setStoredFlag(ONBOARDING_KEY, '1');
    setOnboardingVisible(false);
    // The popup's "Start playing" is the first visit's Start button, so that's one tap, not two.
    // Reopened mid-game from "?", it just closes.
    if (phase === 'ready') startPreview();
  };

  // Flow decay and pulse fade depend on time passing, not just on moves.
  useEffect(() => {
    if (game.status !== 'playing') return;
    const id = setInterval(() => setGame((g) => tick(g, now())), TICK_MS);
    return () => clearInterval(id);
  }, [game.status]);

  // Floating text over a cell: "+110" / "PULSE" on a placement, "MISS" / "−0.1×" on a miss.
  const [floats, setFloats] = useState<FloatText[]>([]);
  const nextFloatId = useRef(0);
  const removeFloat = useCallback((id: number) => setFloats((fs) => fs.filter((f) => f.id !== id)), []);
  const showFloats = (cell: number, lines: { text: string; color: string; large: boolean }[]) => {
    const added = lines.map((l, line) => ({ ...l, cell, line, id: nextFloatId.current++ }));
    setFloats((fs) => [...fs, ...added]);
  };
  const showPlacement = (p: Placement) => {
    const lines = [{ text: `+${p.points}`, color: colors.accent, large: p.island }];
    if (p.pulse) lines.push({ text: 'PULSE', color: colors.accent, large: false });
    showFloats(p.cell, lines);
  };

  // A miss has to read as costing the multiplier: red text at the cell, and the score bar flashes.
  const [missFlash, setMissFlash] = useState<{ id: number; multLostTenths: number } | null>(null);
  const nextMissId = useRef(0);
  const showMiss = (m: Miss) => {
    const lines = [{ text: 'MISS', color: colors.bad, large: true }];
    if (m.multLostTenths > 0) lines.push({ text: `−${(m.multLostTenths / 10).toFixed(1)}×`, color: colors.bad, large: false });
    showFloats(m.cell, lines);
    setMissFlash({ id: nextMissId.current++, multLostTenths: m.multLostTenths });
  };

  // Layout: board beside the feed on wide screens, feed under the board on narrow ones.
  // The board is as large as fits (3:2), leaving room for the header, score bar and, when narrow, the feed.
  const screen = useWindowDimensions();
  const wide = screen.width >= WIDE_LAYOUT_MIN;
  const gap = wide ? GAP_WIDE : GAP_NARROW;
  const boardWidth = wide
    ? Math.min(screen.width - 2 * SIDE_PADDING - PANEL_WIDTH - gap, (screen.height - ABOVE_BOARD - 64) * (COLS / ROWS), 900)
    : Math.min(screen.width - 2 * SIDE_PADDING, (screen.height - 400) * (COLS / ROWS));
  const cell = boardWidth / COLS;
  // Side panel: a hand piece drawn about the size it will be on the board, as long as three fit
  // beside the board column with the controls under them.
  const columnHeight = ABOVE_BOARD + (boardWidth / COLS) * ROWS + 2;
  const sideSlot = Math.floor(Math.min(SIDE_SLOT_MAX, cell * PIECE_SCALE, (columnHeight - SIDE_PANEL_CHROME) / 3));
  const dragPieceSize = Math.max(48, cell * DRAG_SCALE);

  // Where the board and hold slot are on screen, for turning a drop point into a target.
  const boardRef = useRef<View>(null);
  const holdRef = useRef<View>(null);
  const rects = useRef<{ board: Rect | null; hold: Rect | null }>({ board: null, hold: null });
  const measureTargets = useCallback(() => {
    boardRef.current?.measureInWindow((x, y, width, height) => {
      rects.current.board = { x, y, width, height };
    });
    holdRef.current?.measureInWindow((x, y, width, height) => {
      rects.current.hold = { x, y, width, height };
    });
  }, []);
  useEffect(measureTargets, [measureTargets, screen.width, screen.height]);

  const targetAt = (x: number, y: number): DropTarget | null => {
    const { board, hold } = rects.current;
    if (hold && x >= hold.x && x < hold.x + hold.width && y >= hold.y && y < hold.y + hold.height) return { kind: 'hold' };
    if (!board) return null;
    const col = Math.floor(((x - board.x) / board.width) * COLS);
    const row = Math.floor(((y - board.y) / board.height) * ROWS);
    return col >= 0 && col < COLS && row >= 0 && row < ROWS ? { kind: 'cell', cell: indexOf(row, col) } : null;
  };

  const playing = game.status === 'playing';
  const canPlay = playing && !onboardingVisible && started;

  const place = (piece: number, cell: number | null) => {
    const { state, result, placement, miss } = dropPiece(game, piece, cell, now());
    setGame(state);
    if (placement) showPlacement(placement);
    if (miss) showMiss(miss);
    if (result === 'wrong') {
      setWrongCell(cell);
      clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrongCell(null), WRONG_FLASH_MS);
    }
    return result;
  };

  // Tap-to-place, the easier control on a phone: tap a hand (or held) piece to select it, then tap
  // its cell, or the hold slot. A selected piece that has left the hand is no longer selected.
  const [selected, setSelected] = useState<number | null>(null);
  const selectedPiece =
    canPlay && selected !== null && (game.hand.includes(selected) || game.hold === selected) ? selected : null;
  const holdSelected = () => {
    if (selectedPiece === null || selectedPiece === game.hold || !canHold(game)) return false;
    setGame(holdPiece(game, selectedPiece, now()));
    setSelected(null);
    return true;
  };

  const drag = usePieceDrag({
    enabled: canPlay,
    pieceSize: dragPieceSize,
    targetAt,
    onStart: measureTargets,
    onTap: (piece) => {
      // With a hand piece selected, tapping the held piece means "hold this one" (swap them).
      if (piece === game.hold && holdSelected()) return;
      setSelected(piece === selectedPiece ? null : piece);
    },
    onDrop: (piece, target) => {
      setSelected(null);
      if (target?.kind === 'hold') setGame(holdPiece(game, piece, now()));
      else place(piece, target?.cell ?? null);
    },
  });

  // Taps on the board while a piece is selected. A press that moves (a scroll) doesn't count.
  const boardPress = useRef({ x: 0, y: 0 });
  const boardHandlers: GestureResponderHandlers | undefined =
    selectedPiece === null
      ? undefined
      : {
          onStartShouldSetResponder: () => true,
          onResponderGrant: (e) => {
            measureTargets();
            boardPress.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          },
          onResponderRelease: (e) => {
            const { pageX, pageY } = e.nativeEvent;
            if (Math.hypot(pageX - boardPress.current.x, pageY - boardPress.current.y) >= TAP_SLOP) return;
            const target = targetAt(pageX, pageY);
            if (target?.kind !== 'cell') return;
            // A wrong cell deselects, so a double tap can't cost two misses; a filled one is ignored.
            if (place(selectedPiece, target.cell) !== 'returned') setSelected(null);
          },
        };

  const restart = () => {
    setSelected(null);
    setFloats([]);
    setMissFlash(null);
    // Pressing Restart is itself the go-ahead, so skip the Start button.
    setPhase('previewing');
    setGame(newGame(puzzle, now()));
  };

  return (
    <View style={[styles.root, noTouchZoomOnWeb]}>
      {/* Scrolls so the rules can sit below the game. Drags on a piece don't scroll (see usePieceDrag). */}
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.screen, wide ? styles.screenWide : styles.screenNarrow]}>
        <View style={[{ gap }, wide ? styles.layoutWide : styles.layoutNarrow]}>
          <View style={[styles.boardColumn, { width: boardWidth, gap: wide ? 16 : 12 }]}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Pressable
                  testID="prev-puzzle"
                  accessibilityRole="button"
                  accessibilityLabel="Previous puzzle"
                  disabled={puzzle.number <= 1}
                  style={[styles.helpButton, puzzle.number <= 1 && styles.disabled]}
                  onPress={() => onSelectPuzzle(puzzle.number - 1)}
                >
                  <Text style={styles.helpButtonText}>‹</Text>
                </Pressable>
                <Text style={styles.title}>Puzzle #{puzzle.number}</Text>
                <Pressable
                  testID="next-puzzle"
                  accessibilityRole="button"
                  accessibilityLabel="Next puzzle"
                  disabled={puzzle.number >= lastPuzzle}
                  style={[styles.helpButton, puzzle.number >= lastPuzzle && styles.disabled]}
                  onPress={() => onSelectPuzzle(puzzle.number + 1)}
                >
                  <Text style={styles.helpButtonText}>›</Text>
                </Pressable>
              </View>
              <View style={styles.headerRight}>
                <Text testID="placed-count" style={styles.count}>
                  {game.placedCount}/{PIECE_COUNT}
                </Text>
                <Pressable
                  testID="help-button"
                  accessibilityRole="button"
                  accessibilityLabel="How to play"
                  style={styles.helpButton}
                  onPress={() => setOnboardingVisible(true)}
                >
                  <Text style={styles.helpButtonText}>?</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={restart}>
                  <Text style={styles.buttonText}>Restart</Text>
                </Pressable>
              </View>
            </View>
            <ScoreBar
              score={game.score}
              multTenths={game.multTenths}
              missesLeft={missesLeft(game)}
              missFlash={missFlash}
              decayCountdown={
                playing && game.multTenths > MULT_MIN_TENTHS ? { from: game.lastPlacedAt, until: decayStartsAt(game) } : null
              }
              compact={!wide}
            />
            <View>
              <Board
                ref={boardRef}
                cuts={puzzle.cuts}
                image={image}
                placed={game.placed}
                ghosts={game.ghosts}
                floats={floats}
                onFloatDone={removeFloat}
                width={boardWidth}
                hoverCell={drag.hoverCell}
                wrongCell={wrongCell}
                touchHandlers={boardHandlers}
              >
                {phase === 'previewing' && !onboardingVisible && (
                  <PhotoPreview image={image} ms={FLASH_MS} onDone={endPreview} />
                )}
              </Board>
              {phase === 'ready' && !onboardingVisible && (
                <View style={styles.overlay}>
                  <View testID="start-card" style={styles.endCard}>
                    <Text style={styles.endTitle}>Puzzle #{puzzle.number}</Text>
                    <Text style={[styles.endText, styles.startText]}>
                      The photo shows for {FLASH_MS / 1000} seconds, then hides. Memorise it!
                    </Text>
                    <Pressable
                      testID="start-button"
                      accessibilityRole="button"
                      style={[styles.button, styles.primaryButton, styles.startButton]}
                      onPress={startPreview}
                    >
                      <Text style={[styles.primaryButtonText, styles.startButtonText]}>Start puzzle</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {/* A small card, so the finished picture stays visible. */}
              {!playing && (
                <View style={styles.overlay}>
                  <View testID="end-card" style={styles.endCard}>
                    <Text style={styles.endTitle}>{game.status === 'won' ? 'Solved' : 'Out of misses'}</Text>
                    <Text style={styles.endScore}>{withCommas(game.score)}</Text>
                    <Text style={styles.endText}>
                      {game.status === 'won'
                        ? `All ${PIECE_COUNT} pieces placed.`
                        : `${game.placedCount} of ${PIECE_COUNT} pieces placed.`}
                    </Text>
                    {game.missBonus > 0 && (
                      <Text testID="miss-bonus" style={styles.endText}>
                        Includes <Text style={styles.bonusValue}>+{withCommas(game.missBonus)}</Text> for{' '}
                        {game.missBonus / UNUSED_MISS_POINTS} unused {game.missBonus === UNUSED_MISS_POINTS ? 'miss' : 'misses'}.
                      </Text>
                    )}
                    <Pressable style={[styles.button, styles.primaryButton]} onPress={restart}>
                      <Text style={styles.primaryButtonText}>{game.status === 'won' ? 'Play again' : 'Try again'}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>

          <FeedPanel
            cuts={puzzle.cuts}
            image={image}
            hand={game.hand}
            hold={game.hold}
            deckCount={game.deck.length}
            canHold={canHold(game)}
            dragHandlers={drag.handlersFor}
            dragged={drag.dragged}
            selected={selectedPiece}
            onHoldPress={holdSelected}
            holdHovered={(drag.hoverHold && drag.dragged !== game.hold) || (selectedPiece !== null && selectedPiece !== game.hold)}
            showPieces={started}
            holdRef={holdRef}
            compactWidth={wide ? undefined : boardWidth}
            sideSlot={wide ? sideSlot : undefined}
          />
        </View>

        <HowToPlay width={wide ? boardWidth + gap + PANEL_WIDTH : boardWidth} wide={wide} cuts={puzzle.cuts} />
      </ScrollView>

      {/* The dragged copy, in window coordinates, so it sits in an unpadded root at the window origin. */}
      {drag.dragged !== null && (
        <Animated.View style={[styles.dragLayer, { transform: drag.position.getTranslateTransform() }]}>
          <PieceSvg
            cut={puzzle.cuts[drag.dragged]}
            row={rowColOf(drag.dragged)[0]}
            col={rowColOf(drag.dragged)[1]}
            image={image}
            size={dragPieceSize}
          />
        </Animated.View>
      )}

      {/* Covers the viewport (not the full scroll height), and its own backdrop blocks clicks and wheel-scroll underneath. */}
      <OnboardingModal
        visible={onboardingVisible}
        onDismiss={dismissOnboarding}
        cuts={puzzle.cuts}
        image={image}
        narrow={screen.width < NARROW_CARD_MAX}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, userSelect: 'none' },
  scroll: { flex: 1, backgroundColor: colors.background },
  // Grows to at least the screen height, so the game stays centred when everything fits.
  screen: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIDE_PADDING },
  screenWide: { paddingTop: 32, paddingBottom: 48, gap: 40 },
  screenNarrow: { paddingTop: 20, paddingBottom: 32, gap: 32 },
  layoutWide: { flexDirection: 'row', alignItems: 'stretch' },
  layoutNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  boardColumn: {},
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { ...type.titleScreen, color: colors.text },
  count: { ...type.valueCount, color: colors.muted },
  button: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  buttonText: { ...type.button, color: colors.muted },
  helpButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
  },
  helpButtonText: { ...type.glyph, color: colors.muted },
  disabled: { opacity: 0.35 },
  primaryButton: { backgroundColor: colors.accent, borderColor: colors.accent, marginTop: 6 },
  primaryButtonText: { ...type.buttonPrimary, color: colors.onAccent },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCard: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderWidth: 1,
  },
  endTitle: { ...type.titleCard, color: colors.text },
  endScore: { ...type.valueEndScore, color: colors.accent },
  endText: { ...type.body, color: colors.muted },
  bonusValue: { color: colors.accent },
  startText: { textAlign: 'center', maxWidth: 240, marginTop: 2 },
  startButton: { marginTop: 10, paddingVertical: 11, paddingHorizontal: 28 },
  startButtonText: { ...type.buttonLarge },
  dragLayer: { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' },
});
