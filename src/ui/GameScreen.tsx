import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
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

import { COLS, FLASH_MS, ISLAND_POINTS, MULT_MIN_TENTHS, ROWS, SNAP_POINTS } from '../engine/constants';
import { indexOf, rowColOf } from '../engine/cuts';
import type { Puzzle } from '../engine/daily';
import { PIECE_SCALE } from '../engine/geometry';
import {
  canHold,
  decayStartsAt,
  dropPiece,
  finishPicture,
  holdPiece,
  missesLeft,
  newGame,
  tick,
  type GameState,
  type Miss,
  type Placement,
} from '../engine/game';
import { NO_STATS, recordResult, type Stats } from '../engine/result';
import { getStoredFlag, getStoredJson, setStoredFlag, setStoredJson } from '../storage';
import { Board, type FloatText } from './Board';
import { colors, overlays, pageBackground } from './colors';
import { FeedPanel, SIDE_PANEL_WIDTH } from './FeedPanel';
import { HowToPlay } from './HowToPlay';
import { OnboardingModal } from './OnboardingModal';
import { PhotoPreview } from './PhotoPreview';
import { PieceSvg } from './PieceSvg';
import { ResultSheet } from './ResultSheet';
import { FLY_MS, ScoreCard, type MoveRecord } from './ScoreCard';
import { type } from './type';
import { TAP_SLOP, usePieceDrag, type DropTarget } from './usePieceDrag';

type Props = {
  puzzle: Puzzle;
  image: ImageSourcePropType;
  /** Today's puzzle: one play, saved as it goes, and counted in the stats. Otherwise free practice. */
  isDaily: boolean;
};

/** Today's game as stored after every change, so a reload resumes it rather than restarting it. */
type SavedGame = {
  puzzle: number;
  /** Set when the photo preview starts, so reloading can't show it again from the top. */
  previewStartedAt?: number;
  game?: GameState;
  moves?: MoveRecord[];
  tried?: Record<number, number[]>;
};

const SAVE_KEY = 'daily-game-v1';
const STATS_KEY = 'daily-stats-v1';
/** Let the scoring animation finish before the result covers it. */
const RESULT_DELAY_MS = 1500;

function loadSave(puzzleNumber: number): SavedGame | null {
  const saved = getStoredJson<SavedGame>(SAVE_KEY);
  return saved?.puzzle === puzzleNumber ? saved : null;
}

type Rect = { x: number; y: number; width: number; height: number };

const WIDE_LAYOUT_MIN = 760;
/** Below this width the onboarding card stacks its steps. */
const NARROW_CARD_MAX = 520;
const PANEL_WIDTH = SIDE_PANEL_WIDTH;
// Spacing (8-point scale): bigger gaps between groups than inside them.
const GAP_WIDE = 24;
const GAP_NARROW = 16;
const SIDE_PADDING = 16;
/** The score card (about 129 with one-line meters and captions) and its gap, above the board in the wide layout. */
const ABOVE_BOARD = 129 + 16;
/** The side column's fixed parts: panel border and padding, gaps between 3 slots, and the How to play button with its gap. */
const SIDE_PANEL_CHROME = 2 + 32 + 2 * 12 + 34 + 16;
/** Largest hand slot on the side panel. */
const SIDE_SLOT_MAX = 208;
const WRONG_FLASH_MS = 300;
/** How often the clocks (flow decay, ghost fade) are advanced. */
const TICK_MS = 100;
/** The dragged piece's box relative to a cell, as in the POC: its body is ~82% of a cell, so the outline of the cell under it stays visible. */
const DRAG_SCALE = 1.12;
/** Bump this to make the onboarding popup show again for everyone (a content change, say). */
const ONBOARDING_KEY = 'onboarding-seen-v3';

// Web only: taps on the game shouldn't zoom the page (double-tap) or open the long-press menu.
const noTouchZoomOnWeb =
  Platform.OS === 'web' ? ({ touchAction: 'manipulation', WebkitTouchCallout: 'none' } as unknown as ViewStyle) : null;

/** One monotonic clock for everything the engine times. */
const now = () => performance.now();
const nativeDriver = Platform.OS !== 'web';
const NO_CELLS: readonly number[] = [];

/** The system's "reduce motion" setting (prefers-reduced-motion on the web), kept up to date. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => alive && setReduced(r));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Points flying from a placed piece to the score card, in window coordinates. */
type Flight = { id: number; text: string; from: { x: number; y: number }; to: { x: number; y: number }; big: boolean };

/** One flight: an arc from the piece to the card, growing then shrinking into the chip. */
function FlyingPoints({ flight, onDone }: { flight: Flight; onDone: (id: number) => void }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: FLY_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: nativeDriver }).start(() =>
      onDone(flight.id),
    );
  }, [t, flight.id, onDone]);
  const { from, to } = flight;
  const lift = Math.min(120, Math.abs(to.y - from.y) * 0.35 + 40);
  const midY = Math.min(from.y, to.y) - lift;
  return (
    <Animated.Text
      style={[
        styles.flight,
        flight.big ? type.floatLarge : type.floatSmall,
        {
          opacity: t.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from.x - 40, to.x - 40] }) },
            { translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [from.y - 12, midY, to.y - 12] }) },
            { scale: t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1.35, 0.7] }) },
          ],
        },
      ]}
    >
      {flight.text}
    </Animated.Text>
  );
}

export function GameScreen({ puzzle, image, isDaily }: Props) {
  const reducedMotion = useReducedMotion();
  // Today's game, if it was already started on this device.
  const [saved] = useState(() => (isDaily ? loadSave(puzzle.number) : null));
  const [game, setGame] = useState<GameState>(() =>
    // The clocks are per-page-load, so a resumed game restarts them; pulse ghosts don't survive.
    saved?.game ? { ...saved.game, lastPlacedAt: now(), decaySteps: 0, ghosts: [] } : newGame(puzzle, now()),
  );
  // Every placement and miss as the score card draws it (what each piece was worth, at what speed).
  const [moves, setMoves] = useState<MoveRecord[]>(() => saved?.moves ?? []);
  // Spots already tried with each piece, so nobody pays twice for the same wrong guess.
  const [tried, setTried] = useState<Record<number, number[]>>(() => saved?.tried ?? {});
  const [stats, setStats] = useState<Stats>(() => getStoredJson<Stats>(STATS_KEY) ?? NO_STATS);
  // Coming back to a finished daily puzzle opens straight on its result.
  const [resultOpen, setResultOpen] = useState(() => isDaily && (saved?.game?.status === 'won' || saved?.game?.status === 'failed'));
  const resultTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(resultTimer.current), []);
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(wrongTimer.current), []);

  // Shown once per browser (see storage.ts). The full rules are a sheet behind "How to play".
  const [onboardingVisible, setOnboardingVisible] = useState(() => getStoredFlag(ONBOARDING_KEY) !== '1');
  const [rulesVisible, setRulesVisible] = useState(false);
  // Each board waits on a Start button ('ready'), then shows the finished photo briefly
  // ('previewing'), then play and its clocks start ('playing'). The photo only shows once the
  // player asks for it, so opening the page (or switching puzzles) while looking away wastes nothing.
  // On a reload today's preview carries on with the time it had left, and never restarts.
  const [previewMs, setPreviewMs] = useState(() =>
    saved?.previewStartedAt ? Math.max(0, FLASH_MS - (Date.now() - saved.previewStartedAt)) : FLASH_MS,
  );
  const [phase, setPhase] = useState<'ready' | 'previewing' | 'playing'>(() => {
    if (saved?.game) return 'playing';
    if (saved?.previewStartedAt) return previewMs > 0 ? 'previewing' : 'playing';
    return 'ready';
  });
  const started = phase === 'playing';
  const startPreview = () => {
    if (isDaily) setStoredJson(SAVE_KEY, { puzzle: puzzle.number, previewStartedAt: Date.now() } satisfies SavedGame);
    setPhase('previewing');
  };
  const endPreview = useCallback(() => {
    setPhase('playing');
    setGame(newGame(puzzle, now()));
    setMoves([]);
    setTried({});
  }, [puzzle]);

  const dismissOnboarding = () => {
    setStoredFlag(ONBOARDING_KEY, '1');
    setOnboardingVisible(false);
    // The popup's "Start playing" is the first visit's Start button, so that's one tap, not two.
    if (phase === 'ready') startPreview();
  };

  // Save today's game as it changes, so closing the page can't give a second go at it.
  useEffect(() => {
    if (isDaily && phase === 'playing') setStoredJson(SAVE_KEY, { puzzle: puzzle.number, game, moves, tried } satisfies SavedGame);
  }, [isDaily, phase, puzzle.number, game, moves, tried]);

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
  // A placement's points fly from the piece into the score card (where the sum then plays out),
  // and the board shakes a little, more for bigger points. With reduced motion, the old rising
  // "+N" over the cell stands in.
  const [flights, setFlights] = useState<Flight[]>([]);
  const nextFlightId = useRef(0);
  const removeFlight = useCallback((id: number) => setFlights((fs) => fs.filter((f) => f.id !== id)), []);
  const landingRef = useRef<View>(null);
  const [boardShake] = useState(() => new Animated.Value(0));
  const shakeBoard = (points: number) => {
    const amp = Math.min(4, 0.8 + points / 60);
    boardShake.setValue(0);
    Animated.sequence(
      [amp, -amp, amp * 0.6, -amp * 0.4, 0].map((v) =>
        Animated.timing(boardShake, { toValue: v, duration: 45, easing: Easing.linear, useNativeDriver: nativeDriver }),
      ),
    ).start();
  };
  const showPlacement = (p: Placement) => {
    const lines: { text: string; color: string; large: boolean }[] = [];
    if (reducedMotion) lines.push({ text: `+${p.points}`, color: colors.text, large: p.island });
    if (p.pulse) lines.push({ text: 'PULSE', color: colors.text, large: false });
    if (lines.length) showFloats(p.cell, lines);
    if (reducedMotion) return;
    shakeBoard(p.points);
    const board = rects.current.board;
    if (!board) return;
    const [row, col] = rowColOf(p.cell);
    const from = { x: board.x + ((col + 0.5) * board.width) / COLS, y: board.y + ((row + 0.5) * board.height) / ROWS };
    const base = p.island ? ISLAND_POINTS : SNAP_POINTS;
    landingRef.current?.measureInWindow((x, y, w, h) => {
      // Aim at the start of the last-move sum, where the worth chip appears.
      const to = { x: x + Math.min(30, w / 2), y: y + h / 2 };
      setFlights((fs) => [...fs, { id: nextFlightId.current++, text: `+${base}`, from, to, big: p.island }]);
    });
  };

  // A miss has to read as costing the multiplier: red text at the cell, and the score card flashes.
  const [missFlash, setMissFlash] = useState<{ id: number; multLostTenths: number } | null>(null);
  const nextMissId = useRef(0);
  const showMiss = (m: Miss) => {
    const lines = [{ text: 'MISS', color: colors.bad, large: true }];
    if (m.multLostTenths > 0) lines.push({ text: `−${(m.multLostTenths / 10).toFixed(1)}×`, color: colors.bad, large: false });
    showFloats(m.cell, lines);
    setMissFlash({ id: nextMissId.current++, multLostTenths: m.multLostTenths });
  };

  // Layout: board beside the hand on wide screens, hand under the board on narrow ones.
  // The board is as large as fits (3:2), leaving room for the score card and, when narrow, the hand.
  const screen = useWindowDimensions();
  const wide = screen.width >= WIDE_LAYOUT_MIN;
  const gap = wide ? GAP_WIDE : GAP_NARROW;
  const boardWidth = wide
    ? Math.min(screen.width - 2 * SIDE_PADDING - PANEL_WIDTH - gap, (screen.height - ABOVE_BOARD - 64) * (COLS / ROWS), 900)
    : Math.min(screen.width - 2 * SIDE_PADDING, (screen.height - 434) * (COLS / ROWS));
  const cell = boardWidth / COLS;
  // Side panel: a hand piece drawn about the size it will be on the board, as long as three fit
  // beside the board column with How to play under them.
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
  // Out of misses, carrying on just to complete the picture: pieces still move, nothing counts.
  const finishing = game.status === 'finishing';
  const ended = game.status === 'won' || game.status === 'failed';
  const canPlay = (playing || finishing) && !onboardingVisible && !rulesVisible && !resultOpen && started;

  const place = (piece: number, cell: number | null) => {
    const { state, result, placement, miss } = dropPiece(game, piece, cell, now());
    setGame(state);
    const nowEnded = state.status === 'won' || state.status === 'failed';
    if (nowEnded && game.status !== state.status) {
      // The score is final at the win or the last miss; finishing the picture afterwards changes nothing.
      if (isDaily && game.status === 'playing') {
        const next = recordResult(stats, { puzzle: puzzle.number, won: state.status === 'won', score: state.score });
        setStats(next);
        setStoredJson(STATS_KEY, next);
      }
      clearTimeout(resultTimer.current);
      resultTimer.current = setTimeout(() => setResultOpen(true), reducedMotion ? 0 : RESULT_DELAY_MS);
    }
    if (placement) {
      showPlacement(placement);
      // The fast bonus is applied before scoring, so the state's multiplier is the one it was paid at.
      const base = placement.island ? ISLAND_POINTS : SNAP_POINTS;
      setMoves((ms) => [...ms, { kind: placement.island ? 'lone' : 'joined', base, points: placement.points, multTenths: state.multTenths }]);
    }
    if (miss) {
      showMiss(miss);
      setMoves((ms) => [...ms, { kind: 'miss', multLostTenths: miss.multLostTenths }]);
    }
    if (result === 'wrong') {
      if (cell !== null) setTried((t) => ({ ...t, [piece]: [...(t[piece] ?? []), cell] }));
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

  /** Practice games only: play the puzzle again. Today's puzzle is one play. */
  const replay = () => {
    setResultOpen(false);
    setPreviewMs(FLASH_MS);
    setSelected(null);
    setFloats([]);
    setMissFlash(null);
    setMoves([]);
    setTried({});
    // Pressing it is itself the go-ahead, so skip the Start button.
    setPhase('previewing');
    setGame(newGame(puzzle, now()));
  };

  // The piece being moved, by drag or by tap: its already-tried spots get marked on the board.
  const heldPiece = drag.dragged ?? selectedPiece;

  const howToPlay = (
    <Pressable
      testID="help-button"
      accessibilityRole="button"
      style={[styles.button, styles.howButton]}
      onPress={() => setRulesVisible(true)}
    >
      <Text numberOfLines={1} style={styles.howButtonText}>
        How to play
      </Text>
    </Pressable>
  );
  // Once the game is over the result stays one tap away, beside How to play.
  const bottomButtons = ended ? (
    <View style={styles.bottomRow}>
      <View style={styles.grow}>
        <Pressable testID="open-result" accessibilityRole="button" style={[styles.button, styles.howButton]} onPress={() => setResultOpen(true)}>
          <Text numberOfLines={1} style={styles.howButtonText}>
            Your result
          </Text>
        </Pressable>
      </View>
      <View style={styles.grow}>{howToPlay}</View>
    </View>
  ) : (
    howToPlay
  );

  const feed = (
    <FeedPanel
      cuts={puzzle.cuts}
      image={image}
      hand={game.hand}
      hold={game.hold}
      canHold={canHold(game)}
      dragHandlers={drag.handlersFor}
      dragged={drag.dragged}
      selected={selectedPiece}
      onHoldPress={holdSelected}
      holdHovered={(drag.hoverHold && drag.dragged !== game.hold) || (selectedPiece !== null && selectedPiece !== game.hold)}
      showPieces={started}
      showControls={started && playing && moves.length === 0}
      note={finishing ? 'Score locked. Finish the picture' : undefined}
      holdRef={holdRef}
      compactWidth={wide ? undefined : boardWidth}
      sideSlot={wide ? sideSlot : undefined}
    />
  );

  return (
    <View style={[styles.root, noTouchZoomOnWeb]}>
      {/* Scrolls on short screens. Drags on a piece don't scroll (see usePieceDrag). */}
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.screen, wide ? styles.screenWide : styles.screenNarrow]}>
        <View style={[{ gap }, wide ? styles.layoutWide : styles.layoutNarrow]}>
          <View style={{ width: boardWidth, gap: wide ? 16 : 12 }}>
            <ScoreCard
              puzzleNumber={puzzle.number}
              practice={!isDaily}
              score={game.score}
              multTenths={game.multTenths}
              missesLeft={missesLeft(game)}
              moves={moves}
              cuts={puzzle.cuts}
              missFlash={missFlash}
              decayCountdown={
                playing && game.multTenths > MULT_MIN_TENTHS ? { from: game.lastPlacedAt, until: decayStartsAt(game) } : null
              }
              compact={!wide}
              landingRef={landingRef}
              reducedMotion={reducedMotion}
            />
            <Animated.View style={{ transform: [{ translateX: boardShake }] }}>
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
                triedCells={heldPiece === null ? NO_CELLS : (tried[heldPiece] ?? NO_CELLS)}
                touchHandlers={boardHandlers}
              >
                {phase === 'previewing' && !onboardingVisible && (
                  <PhotoPreview image={image} ms={previewMs} onDone={endPreview} />
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
            </Animated.View>
          </View>

          {wide ? (
            <View style={[styles.sideColumn, { width: PANEL_WIDTH }]}>
              {feed}
              {bottomButtons}
            </View>
          ) : (
            <>
              {feed}
              {bottomButtons}
            </>
          )}
        </View>
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

      {/* Points on their way to the score card, over everything, in window coordinates. */}
      {flights.map((f) => (
        <FlyingPoints key={f.id} flight={f} onDone={removeFlight} />
      ))}

      {/* The rules, one tap away. Covers the viewport; its backdrop blocks the game underneath. */}
      {rulesVisible && (
        <View testID="rules-sheet" style={styles.sheetBackdrop}>
          <ScrollView contentContainerStyle={styles.sheetScroll}>
            <HowToPlay width={Math.min(screen.width - 32, wide ? 1000 : 520)} wide={screen.width >= 900} cuts={puzzle.cuts} />
            <Pressable accessibilityRole="button" style={[styles.button, styles.primaryButton, styles.sheetClose]} onPress={() => setRulesVisible(false)}>
              <Text style={styles.primaryButtonText}>Back to the puzzle</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {resultOpen && (
        <ResultSheet
          puzzleNumber={puzzle.number}
          game={game}
          moves={moves}
          stats={isDaily ? stats : null}
          onClose={() => setResultOpen(false)}
          onFinishPicture={() => {
            setResultOpen(false);
            setGame(finishPicture);
          }}
          onReplay={replay}
        />
      )}

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
  scroll: { flex: 1, backgroundColor: pageBackground },
  // Grows to at least the screen height, so the game stays centred when everything fits.
  screen: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIDE_PADDING },
  screenWide: { paddingTop: 32, paddingBottom: 48 },
  // Phones: top-aligned, so a tall screen doesn't leave dead space above the score.
  screenNarrow: { paddingTop: 20, paddingBottom: 32, justifyContent: 'flex-start' },
  layoutWide: { flexDirection: 'row', alignItems: 'stretch' },
  layoutNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  sideColumn: { gap: 16 },
  bottomRow: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  button: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  // Easy to find (full width, at the end of the column) but light, so it doesn't compete with the hand.
  howButton: { alignItems: 'center', paddingVertical: 7, paddingHorizontal: 8, backgroundColor: 'transparent', borderColor: colors.pieceOutline },
  howButtonText: { ...type.button, color: colors.text },
  // White, not lemon: lemon only ever means what a piece is worth.
  primaryButton: { backgroundColor: colors.text, borderColor: colors.text, marginTop: 6 },
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
  endText: { ...type.body, color: colors.muted },
  startText: { textAlign: 'center', maxWidth: 240, marginTop: 2 },
  startButton: { marginTop: 10, paddingVertical: 11, paddingHorizontal: 28 },
  startButtonText: { ...type.buttonLarge },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: overlays.backdrop },
  sheetScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 16 },
  sheetClose: { paddingVertical: 10, paddingHorizontal: 24 },
  dragLayer: { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' },
  flight: { position: 'absolute', left: 0, top: 0, width: 80, textAlign: 'center', color: colors.accent, pointerEvents: 'none' },
});
