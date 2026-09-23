import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { colors } from './colors';

type Props = {
  image: ImageSourcePropType;
  /** How long to show it. */
  ms: number;
  onDone: () => void;
};

const TICK_MS = 100;

/**
 * The finished photo, shown over the board for `ms` with a countdown before play starts. Place
 * it over the board's play area. (A future Zen mode would show the photo as a persistent dim
 * reference instead; this is the one-time flash.)
 */
export function PhotoPreview({ image, ms, onDone }: Props) {
  const [left, setLeft] = useState(ms);
  useEffect(() => {
    const endsAt = performance.now() + ms;
    const id = setInterval(() => {
      const remaining = endsAt - performance.now();
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        onDone();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [ms, onDone]);

  return (
    <View testID="photo-preview" style={styles.fill}>
      {/* Explicit size: without one, react-native-web sizes the image to the photo's own pixels. */}
      <Image source={image} style={[styles.fill, styles.fullSize]} resizeMode="stretch" />
      <View style={styles.badge}>
        <Text style={styles.badgeLabel}>Memorise it</Text>
        <Text style={styles.count}>{Math.max(0, Math.ceil(left / 1000))}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fullSize: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 20, 28, 0.82)',
    borderColor: colors.line,
    borderWidth: 1,
  },
  badgeLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  count: { color: colors.gold, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 14, textAlign: 'center' },
});
