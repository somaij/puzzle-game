import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FLASH_MS, MISS_LIMIT } from '../engine/constants';
import { colors } from './colors';

type Props = { visible: boolean; onDismiss: () => void };

/**
 * A quick first-visit primer, dismissed once and remembered (see storage.ts). The full rules
 * (HowToPlay) stay below the board for anyone who wants more, or wants it again later.
 */
export function OnboardingModal({ visible, onDismiss }: Props) {
  if (!visible) return null;
  return (
    <View testID="onboarding-modal" style={styles.backdrop}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Welcome
        </Text>
        <Text style={styles.body}>
          Rebuild today&rsquo;s photo. You&rsquo;ll see it for {FLASH_MS / 1000} seconds, then it hides: read
          each piece&rsquo;s image and cut to work out where it goes. Drag any piece from your hand onto the
          board, or tap it and then tap its spot. Quick, correct placements raise your score multiplier; a wrong spot costs one of your{' '}
          {MISS_LIMIT} misses. Full rules are always below the board.
        </Text>
        <Pressable style={styles.button} onPress={onDismiss}>
          <Text style={styles.buttonText}>Start playing</Text>
        </Pressable>
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
    backgroundColor: 'rgba(8, 12, 18, 0.82)',
  },
  card: {
    gap: 14,
    width: '100%',
    maxWidth: 420,
    padding: 22,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  button: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 18 },
  buttonText: { color: '#06201d', fontSize: 14, fontWeight: '700' },
});
