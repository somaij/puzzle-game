import { StyleSheet, Text, View } from 'react-native';

import {
  DECAY_TICK_MS,
  FAST_MS,
  FLASH_MS,
  HAND_SIZE,
  HOLD_SLOT,
  ISLAND_POINTS,
  MISS_LIMIT,
  MULT_MAX_TENTHS,
  MULT_STEP_TENTHS,
  PULSE_MS,
  SNAP_POINTS,
  STALL_MS,
  UNUSED_MISS_POINTS,
  WRONG_PENALTY_TENTHS,
} from '../engine/constants';
import { colors } from './colors';

// Numbers come from the engine's constants, so tuning them can't leave these instructions out of date.
const seconds = (ms: number) => String(ms / 1000);
const tenths = (t: number) => (t / 10).toFixed(1);

const RULES: { lead: string; text: string }[] = [
  {
    lead: 'The goal',
    text: `Rebuild today's photo. It's shown for ${seconds(FLASH_MS)} seconds at the start, then hidden, so read each piece's image and its cut (the tabs and notches) to work out where it goes.`,
  },
  {
    lead: 'Place',
    text: `You hold ${HAND_SIZE} pieces at a time; drag any of them onto the board, or tap one and then tap its spot. The right spot locks it in and a new piece from the deck takes its place. A wrong spot is a miss. Dropping it off the board just puts it back.`,
  },
  ...(HOLD_SLOT
    ? [
        {
          lead: 'Hold',
          text: 'Drag a piece onto the Hold slot (or tap it, then Hold) to set it aside and draw a new one. Once per placement; holding when a piece is already there swaps them. You can play the held piece straight from the slot.',
        },
      ]
    : []),
  {
    lead: 'Islands and snaps',
    text: `A piece with no neighbours on the board yet is an island: ${ISLAND_POINTS} points, but a guess. A piece touching one that's already placed is a snap: ${SNAP_POINTS} points.`,
  },
  {
    lead: 'Score multiplier',
    text: `The ×1.0 to ×${tenths(MULT_MAX_TENTHS)} beside your score multiplies every placement's points. Place a piece within ${seconds(FAST_MS)} seconds of your last one to raise the multiplier by ${tenths(MULT_STEP_TENTHS)}, up to ×${tenths(MULT_MAX_TENTHS)}. Go ${seconds(STALL_MS + DECAY_TICK_MS)} seconds without placing and it starts dropping; the countdown beside the meter shows when. Each miss also costs ${tenths(WRONG_PENALTY_TENTHS)}.`,
  },
  {
    lead: 'Pulse',
    text: `Placing an island correctly shows the pieces around it for ${seconds(PULSE_MS)} seconds, fading as time runs out. Use it to line up your next moves.`,
  },
  {
    lead: 'Misses',
    text: `Dropping a piece on the wrong spot is a miss. You get ${MISS_LIMIT} per puzzle; the Misses left box counts down, and at zero the puzzle ends. Dropping off the board doesn't count. Finish the puzzle and every miss you didn't use is worth ${UNUSED_MISS_POINTS} points.`,
  },
  {
    lead: 'Every day',
    text: "There's a new puzzle each day. Restart plays today's again.",
  },
];

/** Short rules for testers, shown below the game. */
export function HowToPlay({ width }: { width: number }) {
  return (
    <View testID="how-to-play" style={[styles.card, { width }]}>
      <Text accessibilityRole="header" style={styles.title}>
        How to play
      </Text>
      {RULES.map(({ lead, text }) => (
        <Text key={lead} style={styles.rule}>
          <Text style={styles.lead}>{lead}. </Text>
          {text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  // Capped so lines stay readable on wide screens.
  rule: { color: colors.muted, fontSize: 14, lineHeight: 20, maxWidth: 720 },
  lead: { color: colors.text, fontWeight: '700' },
});
