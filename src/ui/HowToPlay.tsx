import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  DECAY_TICK_MS,
  FAST_MS,
  HOLD_SLOT,
  ISLAND_POINTS,
  MISS_LIMIT,
  MULT_MAX_TENTHS,
  MULT_MIN_TENTHS,
  MULT_STEP_TENTHS,
  PIECE_COUNT,
  PULSE_MS,
  SNAP_POINTS,
  STALL_MS,
  UNUSED_MISS_POINTS,
  WRONG_PENALTY_TENTHS,
} from '../engine/constants';
import type { Cut } from '../engine/cuts';
import { colors } from './colors';
import { Arrow, Chip, Cluster, DoodlePiece, loneShape, plainShape, spotShape } from './Pictures';
import { Rich } from './Rich';
import { type } from './type';

// Numbers come from the engine's constants, so tuning them can't leave these rules out of date.
// A non-breaking space keeps "3 s" on one line.
const secs = (ms: number) => `${ms / 1000} s`;
const tenths = (t: number) => (t / 10).toFixed(1);
const mult = (t: number) => `×${tenths(t)}`;
const every = (ms: number) => (ms === 1000 ? 'every second' : `every ${secs(ms)}`);
const PIECE = 30;

/** A few meter segments, as in the score card. `last` (0–1) is how full the newest lit one is. */
function MiniSegments({ lit, total, color, last = 1 }: { lit: number; total: number; color: string; last?: number }) {
  return (
    <View style={styles.segs}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={styles.seg}>
          {i < lit && <View style={{ width: `${(i === lit - 1 ? last : 1) * 100}%`, height: '100%', backgroundColor: color }} />}
        </View>
      ))}
    </View>
  );
}

/** A tiny move strip: lemon for what a piece was worth, a magenta cap for what speed added. */
function MiniBars() {
  const bars: [number, number][] = [[20, 0], [5, 1], [5, 2], [20, 5], [5, 3]];
  return (
    <View style={styles.bars}>
      {bars.map(([base, bonus], i) => (
        <View key={i} style={[styles.bar, i === bars.length - 1 && styles.barNewest]}>
          {bonus > 0 && <View style={{ height: bonus, backgroundColor: colors.multiplier, borderRadius: 1 }} />}
          <View style={{ height: base, backgroundColor: colors.accent, borderRadius: 1 }} />
        </View>
      ))}
    </View>
  );
}

type Card = { title: string; text: string; picture: (cuts: Cut[]) => ReactNode };

/**
 * A reference for mid-game questions ("why only 25?", "what's the 3.2s?"), not a tutorial: each
 * card leads with a picture of the thing on screen it explains, and the key numbers are in the
 * accent colour. Controls live under the hand, where they are needed.
 */
const CARDS: Card[] = [
  {
    title: 'Moving pieces',
    text: '[Drag] a piece from your hand onto its spot, or [tap it, then tap its spot]. Dropping it off the board puts it back, no harm done.',
    picture: (cuts) => (
      <>
        <Cluster cuts={cuts} cells={[[2, 4]]} size={PIECE} shapeFor={() => loneShape} />
        <Arrow />
        <Cluster cuts={cuts} cells={[[2, 4]]} size={PIECE} shapeFor={() => spotShape} />
      </>
    ),
  },
  {
    title: 'Where to start',
    text: '[Flat edges go on the border], and tabs have to fit the pieces already down. Each corner piece has only one home, so start there and build outward.',
    picture: (cuts) => <Cluster cuts={cuts} cells={[[0, 0], [0, 1]]} size={PIECE} shapeFor={() => plainShape} />,
  },
  {
    title: 'Your score card',
    text: 'One bar per move: {lemon} is what the piece was worth, a <magenta> cap is what speed added, a red × is a miss. The newest bar is outlined, with its sum beside it.',
    picture: () => (
      <>
        <MiniBars />
        <View style={[styles.chip, { backgroundColor: colors.accent }]}>
          <Text style={styles.chipText}>25</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.multiplier }]}>
          <Text style={styles.chipText}>×1.6</Text>
        </View>
      </>
    ),
  },
  {
    title: 'Points',
    text: `Nothing next to it? That’s a bold guess worth {${ISLAND_POINTS}}. Snuggle it up to a placed piece for a safe {${SNAP_POINTS}}. Diagonal neighbours don’t count.`,
    picture: (cuts) => (
      <>
        <Cluster cuts={cuts} cells={[[1, 1]]} size={PIECE} shapeFor={() => loneShape} />
        <Text style={[type.floatSmall, styles.accent]}>{ISLAND_POINTS}</Text>
        <View style={styles.spacer} />
        <Cluster cuts={cuts} cells={[[1, 1], [1, 2]]} size={PIECE} shapeFor={() => plainShape} />
        <Text style={[type.floatSmall, styles.muted]}>{SNAP_POINTS}</Text>
      </>
    ),
  },
  {
    title: 'Speed',
    text: `Keep the rhythm going: place within [${secs(FAST_MS)}] of your last piece and another segment lights, <+${tenths(MULT_STEP_TENTHS)}> each, from <${mult(MULT_MIN_TENTHS)}> up to <${mult(MULT_MAX_TENTHS)}>. Every piece's worth is multiplied by it.`,
    picture: () => (
      <>
        <Text style={[type.valueMultiplier, styles.magenta]}>×1.6</Text>
        <MiniSegments lit={6} total={10} color={colors.multiplier} />
      </>
    ),
  },
  {
    title: 'When it drops',
    text: `The newest speed segment drains as your warning. Dawdle for [${secs(STALL_MS + DECAY_TICK_MS)}] and speed starts slipping, <${tenths(MULT_STEP_TENTHS)}> ${every(DECAY_TICK_MS)}. A miss knocks off <${tenths(WRONG_PENALTY_TENTHS)}> too.`,
    picture: () => <MiniSegments lit={6} total={10} color={colors.multiplier} last={0.35} />,
  },
  {
    title: 'Misses',
    text: `Only a wrong spot counts; fumbling it off the board is free. Spots you’ve tried with a piece get an ×. Miss [${MISS_LIMIT}] times and your score locks, but you can still finish the picture.`,
    picture: () => (
      <>
        <Text style={[type.valueMultiplier, styles.text]}>{MISS_LIMIT - 1}</Text>
        <MiniSegments lit={MISS_LIMIT - 1} total={MISS_LIMIT} color={colors.text} />
      </>
    ),
  },
  {
    title: 'Pulse',
    text: `Land a lone piece and its neighbours glow for [${secs(PULSE_MS)}]: a sneaky peek at what goes where.`,
    picture: (cuts) => (
      <Cluster cuts={cuts} cells={[[1, 0], [1, 1], [1, 2]]} size={PIECE} shapeFor={(_, col) => (col === 1 ? loneShape : spotShape)} />
    ),
  },
  ...(HOLD_SLOT
    ? [
        {
          title: 'Hold',
          text: 'Drag a piece onto the Hold slot (or tap it, then Hold) to set it aside and draw a new one. Once per placement; you can play the held piece straight from the slot.',
          picture: () => <Text style={[type.valueCount, styles.text]}>Hold</Text>,
        },
      ]
    : []),
  {
    title: 'Finishing',
    text: `Fit all [${PIECE_COUNT}] to finish. Every miss you didn’t use is worth {${UNUSED_MISS_POINTS}} at the end. Tomorrow, a fresh photo.`,
    picture: () => (
      <>
        <Text style={[type.valueCount, styles.text]}>
          {PIECE_COUNT}
          <Text style={[type.small, styles.muted]}> /{PIECE_COUNT}</Text>
        </Text>
        <Text style={[type.floatSmall, styles.accent]}>+{(MISS_LIMIT - 1) * UNUSED_MISS_POINTS}</Text>
      </>
    ),
  },
];

const COLUMNS = 3;
const WIDE_PAD = 28;
const NARROW_PAD = 20;
const WIDE_GAP = 40;

/** The rules, below the game: a grid of picture cards on wide screens, one column on narrow ones. */
export function HowToPlay({ width, wide, cuts }: { width: number; wide: boolean; cuts: Cut[] }) {
  const pad = wide ? WIDE_PAD : NARROW_PAD;
  const cardWidth = wide ? (width - 2 * pad - 2 - (COLUMNS - 1) * WIDE_GAP) / COLUMNS : undefined;
  return (
    <View testID="how-to-play" style={[styles.panel, { width, padding: pad, paddingBottom: pad + 4, gap: wide ? 28 : 24 }]}>
      <View style={styles.titleRow}>
        <DoodlePiece cuts={cuts} />
        <Text accessibilityRole="header" style={[type.titleSection, styles.text]}>
          How to play
        </Text>
        <Text style={[type.small, styles.muted]}>the short version, for mid-game panics</Text>
      </View>
      <View style={wide ? styles.grid : styles.column}>
        {CARDS.map((card) => {
          const picture = <Chip>{card.picture(cuts)}</Chip>;
          const title = <Text style={[type.titleSection, styles.text]}>{card.title}</Text>;
          return (
            <View key={card.title} style={[styles.card, cardWidth !== undefined && { width: cardWidth }]}>
              {wide ? (
                <>
                  {picture}
                  <View style={styles.titleGap}>{title}</View>
                </>
              ) : (
                // Narrow: the picture and title share a line, which saves a row per card.
                <View style={styles.cardTop}>
                  {picture}
                  {title}
                </View>
              )}
              <Rich text={card.text} style={[type.rules, styles.muted]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Recessed (the board colour) so the rules sit behind the game, not compete with it.
  panel: { backgroundColor: colors.board, borderColor: colors.line, borderWidth: 1, borderRadius: 16 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: WIDE_GAP, rowGap: WIDE_GAP },
  column: { gap: 24 },
  card: { gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  titleGap: { marginTop: 12 },
  spacer: { width: 4 },
  text: { color: colors.text },
  muted: { color: colors.muted },
  accent: { color: colors.accent },
  magenta: { color: colors.multiplier },
  segs: { flexDirection: 'row', gap: 2 },
  seg: { width: 9, height: 7, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.meterTrack },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 28 },
  bar: { width: 6 },
  barNewest: { outlineColor: colors.text, outlineWidth: 1, outlineStyle: 'solid', outlineOffset: 1 },
  chip: { paddingVertical: 1, paddingHorizontal: 6, borderRadius: 6 },
  chipText: { ...type.valueCount, fontSize: 12, color: colors.onAccent },
  bad: { color: colors.bad },
});
