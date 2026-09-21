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
  type ImageSourcePropType,
} from 'react-native';

import { COLS, MULT_MIN_TENTHS, PIECE_COUNT, ROWS } from '../engine/constants';
import { indexOf, rowColOf } from '../engine/cuts';
import type { Puzzle } from '../engine/daily';
import {
  canHold,
  currentPiece,
  decayStartsAt,
  dropPiece,
  holdPiece,
  missesLeft,
  newGame,
  tick,
  upcomingPieces,
  type Miss,
  type Placement,
} from '../engine/game';
import { Board, type FloatText } from './Board';
import { colors } from './colors';
import { FeedPanel } from './FeedPanel';
import { HowToPlay } from './HowToPlay';
import { PieceSvg } from './PieceSvg';
import { ScoreBar, withCommas } from './ScoreBar';
import { usePieceDrag } from './usePieceDrag';

type Props = { puzzle: Puzzle; image: ImageSourcePropType };

type Rect = { x: number; y: number; width: number; height: number };

const WIDE_LAYOUT_MIN = 760;
const PANEL_WIDTH = 240;
const GAP = 20;
const WRONG_FLASH_MS = 300;
/** How often the clocks (flow decay, ghost fade) are advanced. */
const TICK_MS = 100;
/** The dragged piece's box relative to a cell, as in the POC: its body is ~82% of a cell, so the outline of the cell under it stays visible. */
const DRAG_SCALE = 1.12;

/** One monotonic clock for everything the engine times. */
const now = () => performance.now();

export function GameScreen({ puzzle, image }: Props) {
  const [game, setGame] = useState(() => newGame(puzzle, now()));
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(wrongTimer.current), []);

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
    const lines = [{ text: `+${p.points}`, color: p.island ? colors.accent : colors.gold, large: p.island }];
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
  const boardWidth = wide
    ? Math.min(screen.width - 32 - PANEL_WIDTH - GAP, (screen.height - 160) * (COLS / ROWS), 900)
    : Math.min(screen.width - 32, (screen.height - 390) * (COLS / ROWS));
  const cell = boardWidth / COLS;
  const dragPieceSize = Math.max(48, cell * DRAG_SCALE);

  // Where the board is on screen, for turning a drop point into a cell.
  const boardRef = useRef<View>(null);
  const boardRect = useRef<Rect | null>(null);
  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y, width, height) => {
      boardRect.current = { x, y, width, height };
    });
  }, []);
  useEffect(measureBoard, [measureBoard, screen.width, screen.height]);

  const cellAt = (x: number, y: number): number | null => {
    const rect = boardRect.current;
    if (!rect) return null;
    const col = Math.floor(((x - rect.x) / rect.width) * COLS);
    const row = Math.floor(((y - rect.y) / rect.height) * ROWS);
    return col >= 0 && col < COLS && row >= 0 && row < ROWS ? indexOf(row, col) : null;
  };

  const current = currentPiece(game);
  const playing = game.status === 'playing';
  const drag = usePieceDrag({
    enabled: playing && current !== null,
    pieceSize: dragPieceSize,
    cellAt,
    onStart: measureBoard,
    onDrop: (cell) => {
      const { state, result, placement, miss } = dropPiece(game, cell, now());
      setGame(state);
      if (placement) showPlacement(placement);
      if (miss) showMiss(miss);
      if (result === 'wrong') {
        setWrongCell(cell);
        clearTimeout(wrongTimer.current);
        wrongTimer.current = setTimeout(() => setWrongCell(null), WRONG_FLASH_MS);
      }
    },
  });

  // Hold is ignored mid-drag, so the piece in your hand can't change under you.
  const dragging = drag.dragging;
  const hold = () => {
    const t = now();
    if (!dragging) setGame((g) => holdPiece(g, t));
  };

  // Space holds, on web.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      const t = now();
      if (!dragging) setGame((g) => holdPiece(g, t));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging]);

  const restart = () => {
    setFloats([]);
    setMissFlash(null);
    setGame(newGame(puzzle, now()));
  };

  return (
    <View style={styles.root}>
      {/* Scrolls so the rules can sit below the game. Drags on the current piece don't scroll (see usePieceDrag). */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
        <View style={[styles.layout, wide ? styles.layoutWide : styles.layoutNarrow]}>
          <View style={[styles.boardColumn, { width: boardWidth }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Puzzle #{puzzle.number}</Text>
              <View style={styles.headerRight}>
                <Text testID="placed-count" style={styles.count}>
                  {game.placedCount}/{PIECE_COUNT}
                </Text>
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
                ghosts={game.ghosts.map((g) => g.cell)}
                floats={floats}
                onFloatDone={removeFloat}
                width={boardWidth}
                hoverCell={drag.hoverCell}
                wrongCell={wrongCell}
              />
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
            current={current}
            hold={game.hold}
            upcoming={upcomingPieces(game)}
            canHold={canHold(game)}
            onHold={hold}
            dragHandlers={drag.handlers}
            dragging={drag.dragging}
            compactWidth={wide ? undefined : boardWidth}
          />
        </View>

        <HowToPlay width={wide ? boardWidth + GAP + PANEL_WIDTH : boardWidth} />
      </ScrollView>

      {/* The dragged copy, in window coordinates, so it sits in an unpadded root at the window origin. */}
      {drag.dragging && current !== null && (
        <Animated.View style={[styles.dragLayer, { transform: drag.position.getTranslateTransform() }]}>
          <PieceSvg
            cut={puzzle.cuts[current]}
            row={rowColOf(current)[0]}
            col={rowColOf(current)[1]}
            image={image}
            size={dragPieceSize}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, userSelect: 'none' },
  scroll: { flex: 1, backgroundColor: colors.background },
  // Grows to at least the screen height, so the game stays centred when everything fits.
  screen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 28,
  },
  layout: { gap: GAP },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  layoutNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  boardColumn: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  count: { color: colors.muted, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  button: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  buttonText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  primaryButton: { backgroundColor: colors.accent, borderColor: colors.accent, marginTop: 6 },
  primaryButtonText: { color: '#06201d', fontSize: 14, fontWeight: '700' },
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
    borderRadius: 12,
    backgroundColor: 'rgba(14, 20, 28, 0.86)',
    borderColor: colors.line,
    borderWidth: 1,
  },
  endTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
  endScore: { color: colors.gold, fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  endText: { color: colors.muted, fontSize: 14 },
  dragLayer: { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' },
});
