import { StyleSheet, Text, View } from 'react-native';

import { MISS_LIMIT, MULT_MAX_TENTHS, MULT_MIN_TENTHS } from '../engine/constants';
import { colors } from './colors';

type Props = { score: number; multTenths: number; missesLeft: number };

/** 12345 → "12,345" without relying on Intl, which not every JS engine ships in full. */
export const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Score, flow multiplier with its meter, and misses left. */
export function ScoreBar({ score, multTenths, missesLeft }: Props) {
  const flowFraction = (multTenths - MULT_MIN_TENTHS) / (MULT_MAX_TENTHS - MULT_MIN_TENTHS);
  return (
    <View style={styles.bar}>
      <View style={styles.box}>
        <Text style={styles.label}>Score</Text>
        <Text testID="score" style={styles.score}>
          {withCommas(score)}
        </Text>
      </View>

      <View style={[styles.box, styles.flowBox]}>
        <View style={styles.flowHead}>
          <Text style={styles.label}>Flow</Text>
          <Text testID="multiplier" style={styles.mult}>
            ×{(multTenths / 10).toFixed(1)}
          </Text>
        </View>
        <View style={styles.meter}>
          <View style={[styles.meterFill, { width: `${flowFraction * 100}%` }]} />
        </View>
      </View>

      <View style={styles.box}>
        <Text style={styles.label}>Misses</Text>
        <View testID="misses-left" accessibilityLabel={`${missesLeft} misses left`} style={styles.pips}>
          {Array.from({ length: MISS_LIMIT }, (_, i) => (
            <View key={i} style={[styles.pip, i >= missesLeft && styles.pipUsed]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 8 },
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
  flowBox: { flex: 1, gap: 6 },
  flowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { color: colors.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  score: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  mult: { color: colors.gold, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  meter: { height: 7, borderRadius: 4, backgroundColor: colors.goldSoft, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4, backgroundColor: colors.gold },
  pips: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  pip: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.text },
  pipUsed: { backgroundColor: 'transparent', borderColor: colors.bad, borderWidth: 1.5 },
});
