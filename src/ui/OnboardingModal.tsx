import type { ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType, type ViewStyle } from 'react-native';

import { FLASH_MS, ISLAND_POINTS, MISS_LIMIT, SNAP_POINTS } from '../engine/constants';
import type { Cut } from '../engine/cuts';
import { PIECE_SCALE } from '../engine/geometry';
import { colors, overlays } from './colors';
import { Cluster, loneShape, Meter, MiniSlot, PhotoPiece, Pips, plainShape, spotShape } from './Pictures';
import { Rich } from './Rich';
import { type } from './type';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /** Today's cuts and photo, so the pictures show real pieces. */
  cuts: Cut[];
  image: ImageSourcePropType;
  /** Narrow screens: the steps stack as rows instead of sitting side by side. */
  narrow: boolean;
};

// Web only: a soft shadow under the piece being "dragged" in step 3.
const liftedOnWeb =
  Platform.OS === 'web' ? ({ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.55))' } as unknown as ViewStyle) : null;

/**
 * A quick first-visit primer, dismissed once and remembered (see storage.ts): three picture steps
 * and three one-line rules, each picture made of the game's own parts. The full rules stay below
 * the board.
 */
export function OnboardingModal({ visible, onDismiss, cuts, image, narrow }: Props) {
  if (!visible) return null;
  const s = narrow ? 0.8 : 1;
  const steps: { head: string; sub: string; picture: ReactNode }[] = [
    {
      head: 'Memorize it',
      sub: `you get ${FLASH_MS / 1000} seconds`,
      picture: (
        <View style={styles.center}>
          <Image source={image} style={[styles.thumb, { width: 78 * s, height: 52 * s }]} resizeMode="cover" />
          <View style={[styles.timer, { marginTop: -10 * s }]}>
            <Text style={[type.valueCount, styles.accent]}>{FLASH_MS / 1000}s</Text>
          </View>
        </View>
      ),
    },
    {
      head: 'Pick a piece',
      sub: 'from your hand of 3',
      picture: (
        <View style={styles.hand}>
          <MiniSlot cuts={cuts} image={image} row={1} col={0} size={34 * s} />
          <MiniSlot cuts={cuts} image={image} row={2} col={4} size={34 * s} selected />
          <MiniSlot cuts={cuts} image={image} row={0} col={2} size={34 * s} />
        </View>
      ),
    },
    {
      head: 'Drop it in',
      sub: 'drag it or tap to place',
      picture: <DropPicture cuts={cuts} image={image} size={30 * s} />,
    },
  ];
  const islandTimes = ISLAND_POINTS / SNAP_POINTS;
  const rules: { picture: ReactNode; text: string }[] = [
    { picture: <Pips left={4} used={2} size={9} />, text: `{${MISS_LIMIT} misses} and the puzzle ends` },
    {
      picture: (
        <>
          <Cluster cuts={cuts} cells={[[1, 1]]} size={26} shapeFor={() => loneShape} />
          <Text style={[type.floatSmall, styles.accent]}>{ISLAND_POINTS}</Text>
          <Cluster cuts={cuts} cells={[[1, 1], [1, 2]]} size={26} shapeFor={() => plainShape} />
          <Text style={[type.floatSmall, styles.muted]}>{SNAP_POINTS}</Text>
        </>
      ),
      text: `{Lone pieces: ${islandTimes}× points}, but a guess`,
    },
    {
      picture: (
        <>
          <Text style={[type.valueMultiplier, styles.accent]}>×1.6</Text>
          <Meter level={0.6} width={44} />
        </>
      ),
      text: '{Place fast} to grow your multiplier',
    },
  ];

  return (
    <View testID="onboarding-modal" style={styles.backdrop}>
      <View style={[styles.card, narrow && styles.cardNarrow]}>
        <Text accessibilityRole="header" style={[type.titleScreen, styles.text, styles.title]}>
          A daily jigsaw from memory
        </Text>
        <View style={narrow ? styles.stepsColumn : styles.stepsRow}>
          {steps.map((step, i) => (
            <View key={step.head} style={narrow ? styles.stepRow : styles.stepTile}>
              <View style={[styles.picture, { width: 128 * s, height: 92 * s }]}>
                {step.picture}
                <View style={styles.number}>
                  <Text style={[type.small, styles.numberText]}>{i + 1}</Text>
                </View>
              </View>
              <View style={narrow ? styles.stepTextLeft : styles.stepTextCentre}>
                <Text style={[type.bodyStrong, styles.text, !narrow && styles.centred]}>{step.head}</Text>
                <Text style={[type.small, styles.muted, !narrow && styles.centred]}>{step.sub}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.rules}>
          {rules.map((rule) => (
            <View key={rule.text} style={styles.ruleRow}>
              <View style={[styles.ruleVisual, { width: narrow ? 140 : 160 }]}>{rule.picture}</View>
              <Rich text={rule.text} style={[type.body, styles.text, styles.ruleText]} />
            </View>
          ))}
        </View>
        <Pressable testID="onboarding-start" accessibilityRole="button" style={styles.button} onPress={onDismiss}>
          <Text style={[type.buttonPrimary, styles.buttonText]}>Start playing</Text>
        </Pressable>
        <Text style={[type.small, styles.muted, styles.centred]}>Full rules are always below the board.</Text>
      </View>
    </View>
  );
}

/** Step 3: a few placed pieces, the empty spot, and the picked piece sliding into it. */
function DropPicture({ cuts, image, size }: { cuts: Cut[]; image: ImageSourcePropType; size: number }) {
  const cell = size / PIECE_SCALE;
  return (
    <View>
      <Cluster
        cuts={cuts}
        cells={[[1, 3], [1, 4], [2, 3], [2, 4]]}
        size={size}
        shapeFor={(row, col) => (row === 2 && col === 4 ? spotShape : plainShape)}
      />
      <View style={[styles.dragged, liftedOnWeb, { left: cell + cell * 0.45, top: cell + cell * 0.3 }]}>
        <PhotoPiece cuts={cuts} image={image} row={2} col={4} size={size} stroke={colors.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: overlays.backdrop,
  },
  card: {
    width: '100%',
    maxWidth: 468,
    gap: 22,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 28,
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
  },
  cardNarrow: { maxWidth: 358, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, gap: 20 },
  title: { textAlign: 'center' },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  stepsColumn: { gap: 10 },
  stepTile: { flex: 1, alignItems: 'center', gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepTextCentre: { alignItems: 'center', gap: 2 },
  stepTextLeft: { flex: 1, gap: 2 },
  picture: { alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.board, overflow: 'hidden' },
  center: { alignItems: 'center' },
  thumb: { borderRadius: 6, borderWidth: 1, borderColor: colors.pieceOutline },
  timer: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderWidth: 1,
  },
  hand: { flexDirection: 'row', gap: 6, marginTop: 6 },
  number: {
    position: 'absolute',
    top: 7,
    left: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  numberText: { color: colors.text, lineHeight: 14 },
  dragged: { position: 'absolute' },
  rules: { gap: 10 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruleVisual: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { flex: 1 },
  button: {
    alignSelf: 'center',
    minWidth: 240,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  buttonText: { color: colors.onAccent },
  centred: { textAlign: 'center' },
  text: { color: colors.text },
  muted: { color: colors.muted },
  accent: { color: colors.accent },
});
