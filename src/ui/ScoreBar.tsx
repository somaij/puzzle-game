import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { MISS_LIMIT, MULT_MAX_TENTHS, MULT_MIN_TENTHS } from '../engine/constants';
import { colors } from './colors';

type Props = {
  score: number;
  multTenths: number;
  missesLeft: number;
  /**
   * The latest miss, to flash the bar. A new `id` replays the flash; `multLostTenths` > 0 also
   * flashes the multiplier and shows what was lost, so the drop reads as caused by the miss.
   */
  missFlash: { id: number; multLostTenths: number } | null;
  /**
   * The countdown to the multiplier dropping (performance.now() clock): from the last placement
   * to the first decay step. Null hides it, e.g. at 1.0× where there is nothing left to lose.
   */
  decayCountdown: { from: number; until: number } | null;
  /** Narrow screens: the score box full width, misses as one slim row below it. */
  compact: boolean;
};

// On a miss the red holds, then fades; the shake plays right away.
const MISS_HOLD_MS = 300;
const MISS_FADE_MS = 700;
const MISS_SHAKE_MS = 360;
/** At or below this many misses left, the count turns red. */
const MISSES_LOW = 3;

/** 12345 → "12,345" without relying on Intl, which not every JS engine ships in full. */
export const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Score with its multiplier (level meter and the countdown to it dropping) in one box, and misses left. */
export function ScoreBar({ score, multTenths, missesLeft, missFlash, decayCountdown, compact }: Props) {
  const level = (multTenths - MULT_MIN_TENTHS) / (MULT_MAX_TENTHS - MULT_MIN_TENTHS);

  // `flash` is 1 at a miss (held, then fading to 0); `shaking` runs 0 → 1 once, right at the miss.
  const [flash] = useState(() => new Animated.Value(0));
  const [shaking] = useState(() => new Animated.Value(0));
  const flashId = missFlash?.id;
  useEffect(() => {
    if (flashId === undefined) return;
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
  }, [flash, shaking, flashId]);

  const multLost = missFlash?.multLostTenths ?? 0;
  const redBorder = { borderColor: flash.interpolate({ inputRange: [0, 1], outputRange: [colors.line, colors.bad] }) };
  const shake = {
    transform: [
      { translateX: shaking.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -5, 5, -4, 3, 0] }) },
    ],
  };
  const redValue = { color: flash.interpolate({ inputRange: [0, 1], outputRange: [colors.gold, colors.bad] }) };

  // Score and multiplier share one box: the multiplier is what the next placement's points are
  // multiplied by, so it sits right beside the score, with its meter and countdown.
  const scoreBox = (
    <Animated.View
      testID="multiplier-box"
      style={[styles.box, styles.scoreBox, styles.grow, multLost > 0 && [redBorder, shake]]}
    >
      <View style={styles.scoreHead}>
        <Text style={styles.label}>Score</Text>
        <View style={styles.valueGroup}>
          {multLost > 0 && (
            <Animated.Text testID="multiplier-lost" style={[styles.lost, { opacity: flash }]}>
              −{(multLost / 10).toFixed(1)}
            </Animated.Text>
          )}
          <Animated.Text
            testID="multiplier"
            accessibilityLabel={`Score multiplier ${(multTenths / 10).toFixed(1)}`}
            style={[styles.multiplier, multLost > 0 && redValue]}
          >
            ×{(multTenths / 10).toFixed(1)}
          </Animated.Text>
        </View>
      </View>
      <View style={styles.meterRow}>
        <Text testID="score" style={styles.score}>
          {withCommas(score)}
        </Text>
        <View style={[styles.meter, styles.grow]}>
          <View style={[styles.meterFill, { width: `${level * 100}%` }]} />
        </View>
        {/* Fixed width, so the meter doesn't jump when the seconds appear or disappear. */}
        <View style={styles.secondsSlot}>
          {decayCountdown && <DecaySeconds key={decayCountdown.until} until={decayCountdown.until} />}
        </View>
      </View>
      {decayCountdown && <DecayTimer from={decayCountdown.from} until={decayCountdown.until} />}
    </Animated.View>
  );

  const missesBox = (
    <Animated.View style={[styles.box, compact ? styles.missesBoxCompact : styles.missesBox, redBorder]}>
      <Text style={styles.label}>Misses left</Text>
      {/* The number says it outright; the pips are the same count at a glance, a used one goes dim. */}
      <View testID="misses-left" accessibilityLabel={`${missesLeft} of ${MISS_LIMIT} misses left`} style={styles.missesRow}>
        <Text style={[styles.missesValue, missesLeft <= MISSES_LOW && styles.missesLow]}>
          {missesLeft}
          <Text style={styles.missesOf}> /{MISS_LIMIT}</Text>
        </Text>
        <View style={styles.pips}>
          {Array.from({ length: MISS_LIMIT }, (_, i) => (
            <View key={i} style={[styles.pip, i >= missesLeft && styles.pipUsed]} />
          ))}
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={compact ? styles.stack : styles.row}>
      {scoreBox}
      {missesBox}
    </View>
  );
}

/** A line along the bottom of the score box that drains until the multiplier starts dropping; placing a piece refills it. */
function DecayTimer({ from, until }: { from: number; until: number }) {
  const [left] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const remaining = Math.max(0, until - performance.now());
    left.setValue(remaining / (until - from));
    const animation = Animated.timing(left, { toValue: 0, duration: remaining, easing: Easing.linear, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [left, from, until]);

  const width = left.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return <Animated.View testID="decay-timer" style={[styles.timer, { width }]} />;
}

/**
 * Seconds until the multiplier drops, in tenths, rounded up so "0.0s" only shows once it is
 * dropping. Keyed on `until` by the parent, so each placement starts a fresh countdown.
 */
function DecaySeconds({ until }: { until: number }) {
  const [msLeft, setMsLeft] = useState(() => Math.max(0, until - performance.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, until - performance.now());
      setMsLeft(left);
      if (left === 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [until]);

  return (
    <Text testID="decay-seconds" style={[styles.seconds, msLeft === 0 && styles.secondsOut]}>
      {(Math.ceil(msLeft / 100) / 10).toFixed(1)}s
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  stack: { gap: 8 },
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 3,
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  scoreBox: { gap: 4, paddingBottom: 10, overflow: 'hidden' },
  scoreHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  missesBox: { width: 230 },
  missesBoxCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  valueGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  score: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  multiplier: { color: colors.gold, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  lost: { color: colors.bad, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meter: { height: 7, borderRadius: 4, backgroundColor: colors.goldSoft, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4, backgroundColor: colors.gold },
  secondsSlot: { width: 34, alignItems: 'flex-end' },
  seconds: { color: colors.text, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  secondsOut: { color: colors.bad },
  timer: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: colors.text, opacity: 0.75 },
  missesRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  missesValue: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  missesOf: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  missesLow: { color: colors.bad },
  pips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flexShrink: 1 },
  pip: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text },
  pipUsed: { backgroundColor: colors.line },
});
