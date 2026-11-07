import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { MISS_LIMIT, MULT_MAX_TENTHS, MULT_MIN_TENTHS } from '../engine/constants';
import type { Cut } from '../engine/cuts';
import { colors } from './colors';
import { Cluster } from './Pictures';
import type { PieceShape } from './PieceSvg';
import { type } from './type';

/**
 * One move, as the score card draws it. Kept by the screen as moves happen: `points` is what
 * the placement earned (base × the multiplier it was scored at), `multTenths` that multiplier.
 */
export type MoveRecord =
  | { kind: 'lone' | 'joined'; base: number; points: number; multTenths: number }
  | { kind: 'miss'; multLostTenths: number };

type Props = {
  puzzleNumber: number;
  score: number;
  multTenths: number;
  missesLeft: number;
  moves: readonly MoveRecord[];
  /** Today's cuts, for the little piece icons. */
  cuts: Cut[];
  /** The latest miss, to flash the card. A new `id` replays it; `multLostTenths` > 0 also shakes it. */
  missFlash: { id: number; multLostTenths: number } | null;
  /**
   * The countdown to the multiplier dropping (performance.now() clock), from the last placement
   * to the first decay step. It drains the newest speed segment. Null at ×1.0.
   */
  decayCountdown: { from: number; until: number } | null;
  /** Narrow screens: the meters go on their own row under the puzzle number. */
  compact: boolean;
  /** Where a placement's points fly to: the last-move sum. Measured by the screen. */
  landingRef?: Ref<View>;
  /** Skip the motion (shake, wiggle, flashes, counting): the numbers just update. */
  reducedMotion: boolean;
};

const MISS_HOLD_MS = 300;
const MISS_FADE_MS = 700;
const MISS_SHAKE_MS = 360;
/** At or below this many misses left, the misses meter turns red. */
const MISSES_LOW = 3;
/** Bar height per point in the move strip; the tallest bar (a lone piece at ×2.0) is 40 px. */
const BAR_PX_PER_POINT = 0.2;
/** The history row's fixed height, so the card (and the board under it) never moves mid-game. */
const HISTORY_HEIGHT = 64;
// The staged score, Balatro-style: the points fly from the piece into the card (FLY_MS), then the
// worth chip steps forward, the multiplier chip slams in beside it, the result rolls up, and the
// total counts up and bumps. About 1 s in all, purely visual: it never holds up the next drop, and
// a new move cuts the previous one short.
export const FLY_MS = 360;
const BEAT_MS = 150;
const ROLL_DELAY_MS = FLY_MS + 2 * BEAT_MS;
const ROLL_MS = 220;
const COUNT_DELAY_MS = FLY_MS + 3 * BEAT_MS;
const COUNT_MS = 300;
const ROW_GAP = 10;

/** 12345 → "12,345" without relying on Intl, which not every JS engine ships in full. */
export const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const multText = (tenths: number) => `×${(tenths / 10).toFixed(1)}`;

/**
 * Everything about the score in one card. Top row, *now*: the puzzle number, misses left and the
 * current speed, as two segmented meters. Bottom row, *what happened*: the total, "=", one bar per
 * move (lemon = what the piece was worth, a magenta cap = what speed added, red × = a miss), the
 * newest outlined and followed by its sum, played out in beats so the formula explains itself.
 */
export function ScoreCard(props: Props) {
  const { puzzleNumber, score, multTenths, missesLeft, moves, cuts, missFlash, decayCountdown, compact, landingRef, reducedMotion } = props;

  // `flash` is 1 at a miss (held, then fading to 0); `shaking` runs 0 → 1 once, right at the miss.
  const [flash] = useState(() => new Animated.Value(0));
  const [shaking] = useState(() => new Animated.Value(0));
  const flashId = missFlash?.id;
  useEffect(() => {
    if (flashId === undefined || reducedMotion) return;
    flash.setValue(1);
    shaking.setValue(0);
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.delay(MISS_HOLD_MS),
        Animated.timing(flash, { toValue: 0, duration: MISS_FADE_MS, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      ]),
      Animated.timing(shaking, { toValue: 1, duration: MISS_SHAKE_MS, easing: Easing.linear, useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [flash, shaking, flashId, reducedMotion]);
  const redBorder = { borderColor: flash.interpolate({ inputRange: [0, 1], outputRange: [colors.line, colors.bad] }) };
  const shake =
    (missFlash?.multLostTenths ?? 0) > 0
      ? { transform: [{ translateX: shaking.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -5, 5, -4, 3, 0] }) }] }
      : null;

  const low = missesLeft <= MISSES_LOW;
  // Desktop: each meter on one line, label | segments | number. Narrow: label and number above.
  const meter = (opts: {
    testID: string;
    a11y: string;
    label: string;
    value: string;
    valueStyle: object;
    segments: ReactNode;
  }) =>
    compact ? (
      <View testID={opts.testID} accessibilityLabel={opts.a11y} style={[styles.meter, styles.meterCompact]}>
        <View style={styles.meterHead}>
          <Text style={styles.meterLabel}>{opts.label}</Text>
          <Text style={[styles.meterValue, opts.valueStyle]}>{opts.value}</Text>
        </View>
        {opts.segments}
      </View>
    ) : (
      <View testID={opts.testID} accessibilityLabel={opts.a11y} style={styles.meterInline}>
        <Text style={styles.meterLabel}>{opts.label}</Text>
        {opts.segments}
        <Text style={[styles.meterValue, styles.meterValueInline, opts.valueStyle]}>{opts.value}</Text>
      </View>
    );
  const meters = (
    <View style={[styles.meters, compact && styles.metersCompact]}>
      {meter({
        testID: 'misses-left',
        a11y: `${missesLeft} of ${MISS_LIMIT} misses left`,
        label: 'misses left',
        value: String(missesLeft),
        valueStyle: low ? styles.bad : {},
        segments: <Segments count={MISS_LIMIT} lit={missesLeft} color={low ? colors.bad : colors.text} width={compact ? undefined : 180} />,
      })}
      {/* Both meters show their number, so they read as a pair. */}
      {meter({
        testID: 'multiplier-box',
        a11y: `Speed multiplier ${multText(multTenths)}`,
        label: 'speed',
        value: multText(multTenths),
        valueStyle: styles.magenta,
        segments: (
          <Segments
            count={MULT_MAX_TENTHS - MULT_MIN_TENTHS}
            lit={multTenths - MULT_MIN_TENTHS}
            color={colors.multiplier}
            width={compact ? undefined : 180}
            countdown={decayCountdown}
            flashNew={!reducedMotion}
            glowWhenFull={!reducedMotion}
          />
        ),
      })}
    </View>
  );

  return (
    <Animated.View style={[styles.card, compact && styles.cardCompact, redBorder, shake]}>
      <View style={styles.top}>
        <Text style={styles.puzzle}>Puzzle #{puzzleNumber}</Text>
        {!compact && meters}
      </View>
      {compact && meters}
      <View style={styles.divider} />
      {/* The total sits on the moves it is the sum of: "822 = bars…", then "+40" for the last one. */}
      <MoveStrip moves={moves} cuts={cuts} compact={compact} total={score} landingRef={landingRef} reducedMotion={reducedMotion} />
    </Animated.View>
  );
}

/**
 * A row of segments. `lit` of them are on. With a `countdown`, the newest lit segment drains
 * from full to empty over it: the time until the multiplier starts dropping.
 */
function Segments({
  count,
  lit,
  color,
  width,
  countdown,
  flashNew = false,
  glowWhenFull = false,
}: {
  count: number;
  lit: number;
  color: string;
  width?: number;
  countdown?: { from: number; until: number } | null;
  /** A segment that just lit flashes white, then settles to its colour. */
  flashNew?: boolean;
  /** At the top (all lit), the meter glows and gently pulses: keep it going. */
  glowWhenFull?: boolean;
}) {
  const [flash] = useState(() => new Animated.Value(0));
  const prevLit = useRef(lit);
  useEffect(() => {
    const grew = lit > prevLit.current;
    prevLit.current = lit;
    if (!flashNew || !grew) return;
    flash.setValue(0);
    const a = Animated.sequence([
      Animated.delay(FLY_MS + BEAT_MS),
      Animated.timing(flash, { toValue: 1, duration: 60, useNativeDriver: false }),
      Animated.timing(flash, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]);
    a.start();
    return () => a.stop();
  }, [lit, flashNew, flash]);

  const full = glowWhenFull && lit >= count;
  const [glow] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!full) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [full, glow]);

  return (
    <View style={[styles.segments, width !== undefined ? { width } : styles.stretch]}>
      {full && (
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { backgroundColor: color, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]}
        />
      )}
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.segment}>
          {i < lit &&
            (i === lit - 1 && countdown ? (
              <Draining key={countdown.until} from={countdown.from} until={countdown.until} color={color} />
            ) : (
              <View style={[styles.segmentFill, { backgroundColor: color }]} />
            ))}
          {i === lit - 1 && flashNew && <Animated.View pointerEvents="none" style={[styles.segmentFlash, { opacity: flash }]} />}
        </View>
      ))}
    </View>
  );
}

function Draining({ from, until, color }: { from: number; until: number; color: string }) {
  const [left] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const remaining = Math.max(0, until - performance.now());
    left.setValue(remaining / (until - from));
    const animation = Animated.timing(left, { toValue: 0, duration: remaining, easing: Easing.linear, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [left, from, until]);
  const width = left.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return <Animated.View testID="decay-timer" style={[styles.segmentFill, { backgroundColor: color, width }]} />;
}

/** The total, counting up to a new value after the beats that explain it, then a bump. */
function CountingTotal({ value, compact, reducedMotion }: { value: number; compact: boolean; reducedMotion: boolean }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const [bump] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    let frame = 0;
    const start = performance.now() + (reducedMotion ? 0 : COUNT_DELAY_MS);
    const duration = reducedMotion ? 0 : COUNT_MS;
    // The bump is bigger for a bigger gain.
    const size = Math.min(0.22, 0.06 + Math.abs(value - from) / 900);
    const step = () => {
      const t = duration === 0 ? 1 : Math.min(1, Math.max(0, (performance.now() - start) / duration));
      const v = Math.round(from + (value - from) * t);
      shownRef.current = v;
      setShown(v);
      if (t < 1) frame = requestAnimationFrame(step);
      else if (!reducedMotion) {
        bump.setValue(1 + size);
        Animated.spring(bump, { toValue: 1, friction: 4, tension: 220, useNativeDriver: false }).start();
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion, bump]);
  return (
    <Animated.Text
      testID="score"
      accessibilityLabel={`Score ${value}`}
      style={[styles.total, compact && styles.totalCompact, { transform: [{ scale: bump }] }]}
    >
      {withCommas(shown)}
    </Animated.Text>
  );
}

/** The last move's result, rolling up from what the piece was worth to what it earned. */
function RollingSum({ from, to, reducedMotion }: { from: number; to: number; reducedMotion: boolean }) {
  const [shown, setShown] = useState(reducedMotion ? to : from);
  useEffect(() => {
    let frame = 0;
    const start = performance.now() + (reducedMotion ? 0 : ROLL_DELAY_MS);
    const duration = reducedMotion ? 0 : ROLL_MS;
    const step = () => {
      const t = duration === 0 ? 1 : Math.min(1, Math.max(0, (performance.now() - start) / duration));
      setShown(Math.round(from + (to - from) * t));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [from, to, reducedMotion]);
  return <>+{withCommas(shown)}</>;
}

/** One bar per move, as many as fit (newest on the right), the newest outlined, then its sum. */
function MoveStrip({
  moves,
  cuts,
  compact,
  total,
  landingRef,
  reducedMotion,
}: {
  moves: readonly MoveRecord[];
  cuts: Cut[];
  compact: boolean;
  total: number;
  landingRef?: Ref<View>;
  reducedMotion: boolean;
}) {
  const last = moves[moves.length - 1];
  const lastPoints = last && last.kind !== 'miss' ? last.points : 0;
  // Beats for each new move, after the points land: 1 the bar and what the piece was worth steps
  // forward, 2 the multiplier slams in, 3 the sum. Springier (more wobble) for bigger points.
  const [beats] = useState(() => [new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]);
  useEffect(() => {
    if (moves.length === 0) return;
    if (reducedMotion) {
      beats.forEach((b) => b.setValue(1));
      return;
    }
    beats.forEach((b) => b.setValue(0));
    const friction = lastPoints >= 150 ? 3.2 : lastPoints >= 75 ? 4 : 5;
    const a = Animated.sequence([
      Animated.delay(FLY_MS),
      Animated.stagger(
        BEAT_MS,
        beats.map((b) => Animated.spring(b, { toValue: 1, friction, tension: 210, useNativeDriver: false })),
      ),
    ]);
    a.start();
    return () => a.stop();
  }, [beats, moves.length, reducedMotion, lastPoints]);
  // Step forward: pop in past full size with a little tilt (the spring's overshoot is the wiggle).
  const pop = (b: Animated.Value) => ({
    opacity: b.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      { scale: b.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
      { rotate: b.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
    ],
  });
  // The multiplier chip slams in from the right, into the worth chip.
  const slam = (b: Animated.Value) => ({
    opacity: b.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      { translateX: b.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
      { scale: b.interpolate({ inputRange: [0, 1], outputRange: [1.3, 1] }) },
    ],
  });

  // Only as many bars as fit between the total and the last sum, so the row (and the board below)
  // never changes height, and the sum always sits right after the newest bar it describes.
  const [widths, setWidths] = useState({ row: 0, total: 0, sum: 0 });
  const measure = (key: 'row' | 'total' | 'sum') => (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidths((ws) => (ws[key] === w ? ws : { ...ws, [key]: w }));
  };
  const barWidth = compact ? 6 : 9;
  const gap = compact ? 2 : 3;
  const room = widths.row > 0 ? widths.row - widths.total - widths.sum - 2 * ROW_GAP : 0;
  const fit = room > 0 ? Math.max(1, Math.floor((room - 10 + gap) / (barWidth + gap))) : moves.length;
  const shown = moves.slice(-fit);
  const cut = moves.length - shown.length;

  // Every part of the row has a small caption under it, so it reads like a receipt:
  // score = your moves · joined 25 · speed ×1.6 · added +40.
  const captioned = (node: ReactNode, caption: string, key?: string) => (
    <View key={key} style={styles.captioned}>
      {node}
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );

  return (
    <View testID="move-strip" style={styles.history} onLayout={measure('row')}>
      <View style={styles.sumOf} onLayout={measure('total')}>
        {captioned(<CountingTotal value={total} compact={compact} reducedMotion={reducedMotion} />, 'score')}
        {captioned(<Text style={styles.equals}>=</Text>, ' ')}
      </View>
      <View style={[styles.barsBox, room > 0 && { maxWidth: room }]}>
        {last === undefined ? (
          <Text numberOfLines={2} style={styles.empty}>
            your moves add up here
          </Text>
        ) : (
          captioned(
            <View style={[styles.bars, { gap }]}>
              {shown.map((m, i) => {
                const newest = i === shown.length - 1;
                // Older moves that scroll off fade out at the left edge.
                const fade = cut > 0 && i < 2 ? (i === 0 ? 0.3 : 0.6) : 1;
                const bar =
                  m.kind === 'miss' ? (
                    <Text style={styles.missMark}>×</Text>
                  ) : (
                    <View style={{ width: barWidth }}>
                      {m.points > m.base && (
                        <View style={[styles.barPart, { height: (m.points - m.base) * BAR_PX_PER_POINT, backgroundColor: colors.multiplier }]} />
                      )}
                      <View style={[styles.barPart, { height: m.base * BAR_PX_PER_POINT, backgroundColor: colors.accent }]} />
                    </View>
                  );
                return newest ? (
                  <Animated.View key={moves.length} style={[styles.newest, pop(beats[0])]}>
                    {bar}
                  </Animated.View>
                ) : (
                  <View key={cut + i} style={{ opacity: fade }}>
                    {bar}
                  </View>
                );
              })}
            </View>,
            'your moves',
          )
        )}
      </View>
      {/* Always mounted: it is also where a placement's points fly to. */}
      <View testID="last-move" ref={landingRef} collapsable={false} style={styles.lastSum} onLayout={measure('sum')}>
        {last === undefined ? null : last.kind === 'miss' ? (
            <>
              {captioned(
                <Animated.View style={[styles.chip, { backgroundColor: colors.bad }, pop(beats[0])]}>
                  <Text style={styles.chipText}>Miss</Text>
                </Animated.View>,
                'wrong spot',
                'miss',
              )}
              {last.multLostTenths > 0 &&
                captioned(
                  <Animated.Text style={[styles.sumText, styles.bad, pop(beats[1])]}>−{(last.multLostTenths / 10).toFixed(1)}×</Animated.Text>,
                  'speed',
                  'lost',
                )}
            </>
          ) : (
            <>
              {captioned(
                <Animated.View style={[styles.chip, { backgroundColor: colors.accent }, pop(beats[0])]}>
                  {!compact && (
                    <Cluster cuts={cuts} cells={last.kind === 'lone' ? [[1, 1]] : [[1, 1], [1, 2]]} size={14} shapeFor={() => iconShape} />
                  )}
                  <Text style={styles.chipText}>{last.base}</Text>
                </Animated.View>,
                last.kind,
                'worth',
              )}
              {captioned(
                <Animated.View style={[styles.chip, { backgroundColor: colors.multiplier }, slam(beats[1])]}>
                  <Text style={styles.chipText}>{multText(last.multTenths)}</Text>
                </Animated.View>,
                'speed',
                'speed',
              )}
              {captioned(
                <Animated.Text style={[styles.sumText, pop(beats[2])]}>
                  <RollingSum key={moves.length} from={last.base} to={last.points} reducedMotion={reducedMotion} />
                </Animated.Text>,
                'added',
                'added',
              )}
            </>
          )}
      </View>
    </View>
  );
}

const iconShape: PieceShape = { stroke: colors.onAccent, strokeWidth: 7 };

const styles = StyleSheet.create({
  card: {
    gap: 12,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardCompact: { paddingHorizontal: 16, gap: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, minHeight: 16 },
  puzzle: { ...type.small, color: colors.muted },
  meters: { flexDirection: 'row', alignItems: 'center', gap: 28 },
  metersCompact: { gap: 20 },
  meter: { gap: 6, alignItems: 'flex-end' },
  // Narrow: the two meters share the row, each left-aligned with its segments full width.
  meterCompact: { flex: 1, alignItems: 'stretch' },
  stretch: { alignSelf: 'stretch' },
  meterHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  meterInline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Fixed width, so the segments don't shift when the number changes width.
  meterValueInline: { minWidth: 36 },
  meterLabel: { ...type.small, color: colors.muted },
  meterValue: { ...type.valueMultiplier, color: colors.text },
  bad: { color: colors.bad },
  magenta: { color: colors.multiplier },
  segments: { flexDirection: 'row', gap: 3 },
  // The outline keeps empty segments visible against the card (3:1); a lit one fills inside it.
  segment: { flex: 1, height: 8, borderRadius: 3, backgroundColor: colors.meterTrack, borderWidth: 1, borderColor: colors.pieceOutline, overflow: 'hidden' },
  segmentFill: { width: '100%', height: '100%', borderRadius: 3 },
  segmentFlash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.text },
  glow: { position: 'absolute', top: -4, bottom: -4, left: -4, right: -4, borderRadius: 8 },
  divider: { height: 1, backgroundColor: colors.line },
  history: { flexDirection: 'row', alignItems: 'flex-end', gap: ROW_GAP, height: HISTORY_HEIGHT },
  sumOf: { flexDirection: 'row', alignItems: 'flex-end', gap: ROW_GAP },
  total: { ...type.valueEndScore, color: colors.text, lineHeight: 36 },
  totalCompact: { fontSize: 26, lineHeight: 32 },
  equals: { ...type.valueMultiplier, color: colors.muted, marginBottom: 6 },

  barsBox: { flexShrink: 1, height: '100%', justifyContent: 'flex-end', overflow: 'hidden' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 2, paddingLeft: 3 },
  barPart: { width: '100%', borderRadius: 2 },
  newest: { padding: 2, borderRadius: 3, borderWidth: 1.5, borderColor: colors.text },
  missMark: { ...type.small, lineHeight: 12, color: colors.bad },
  lastSum: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  captioned: { alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  caption: { ...type.small, fontSize: 10, lineHeight: 12, color: colors.muted },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 8 },
  chipText: { ...type.valueCount, color: colors.onAccent },
  sumText: { ...type.valueCount, color: colors.text },
  empty: { ...type.small, color: colors.muted, marginBottom: 8 },
});
