import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { MISS_LIMIT, MULT_MAX_TENTHS, MULT_MIN_TENTHS } from '../engine/constants';
import { colors } from './colors';

type Props = {
  score: number;
  multTenths: number;
  missesLeft: number;
  /**
   * The countdown to the multiplier dropping (performance.now() clock): from the last placement
   * to the first decay step. Null hides it, e.g. at 1.0× where there is nothing left to lose.
   */
  decayCountdown: { from: number; until: number } | null;
  /** Narrow screens: score and misses on one row, the multiplier full width below. */
  compact: boolean;
};

/** 12345 → "12,345" without relying on Intl, which not every JS engine ships in full. */
export const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Score, score multiplier (with its level meter and the countdown to it dropping), and misses left. */
export function ScoreBar({ score, multTenths, missesLeft, decayCountdown, compact }: Props) {
  const level = (multTenths - MULT_MIN_TENTHS) / (MULT_MAX_TENTHS - MULT_MIN_TENTHS);

  const scoreBox = (
    <View style={styles.box}>
      <Text style={styles.label}>Score</Text>
      <Text testID="score" style={styles.score}>
        {withCommas(score)}
      </Text>
    </View>
  );

  const missesBox = (
    <View style={[styles.box, compact && styles.grow]}>
      <Text style={styles.label}>Misses</Text>
      <View testID="misses-left" accessibilityLabel={`${missesLeft} misses left`} style={styles.pips}>
        {Array.from({ length: MISS_LIMIT }, (_, i) => (
          <View key={i} style={[styles.pip, i >= missesLeft && styles.pipUsed]} />
        ))}
      </View>
    </View>
  );

  const multiplierBox = (
    <View style={[styles.box, styles.multiplierBox, !compact && styles.grow]}>
      <View style={styles.multiplierHead}>
        <Text style={styles.label}>Score multiplier</Text>
        <Text testID="multiplier" style={styles.multiplier}>
          ×{(multTenths / 10).toFixed(1)}
        </Text>
      </View>
      <View style={styles.meterRow}>
        <View style={[styles.meter, styles.grow]}>
          <View style={[styles.meterFill, { width: `${level * 100}%` }]} />
        </View>
        {/* Fixed width, so the meter doesn't jump when the seconds appear or disappear. */}
        <View style={styles.secondsSlot}>
          {decayCountdown && <DecaySeconds key={decayCountdown.until} until={decayCountdown.until} />}
        </View>
      </View>
      {decayCountdown && <DecayTimer from={decayCountdown.from} until={decayCountdown.until} />}
    </View>
  );

  return compact ? (
    <View style={styles.stack}>
      <View style={styles.row}>
        {scoreBox}
        {missesBox}
      </View>
      {multiplierBox}
    </View>
  ) : (
    <View style={styles.row}>
      {scoreBox}
      {multiplierBox}
      {missesBox}
    </View>
  );
}

/** A line along the bottom of the multiplier box that drains until the multiplier starts dropping; placing a piece refills it. */
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
  multiplierBox: { gap: 6, paddingBottom: 10, overflow: 'hidden' },
  multiplierHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  score: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  multiplier: { color: colors.gold, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meter: { height: 7, borderRadius: 4, backgroundColor: colors.goldSoft, overflow: 'hidden' },
  secondsSlot: { width: 34, alignItems: 'flex-end' },
  seconds: { color: colors.text, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  secondsOut: { color: colors.bad },
  meterFill: { height: '100%', borderRadius: 4, backgroundColor: colors.gold },
  timer: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: colors.text, opacity: 0.75 },
  pips: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  pip: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.text },
  pipUsed: { backgroundColor: 'transparent', borderColor: colors.bad, borderWidth: 1.5 },
});
