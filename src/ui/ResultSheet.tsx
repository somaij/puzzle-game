import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { PIECE_COUNT } from '../engine/constants';
import type { GameState } from '../engine/game';
import { currentStreak, shareText, type Stats } from '../engine/result';
import { trackEvent } from '../analytics';
import { colors, overlays } from './colors';
import { withCommas, type MoveRecord } from './ScoreCard';
import { type } from './type';

type Props = {
  puzzleNumber: number;
  game: GameState;
  moves: readonly MoveRecord[];
  /** Null for a practice game (`?puzzle=N`), which doesn't count. */
  stats: Stats | null;
  onClose: () => void;
  onFinishPicture: () => void;
  /** Practice games only: today's puzzle is one play. */
  onReplay: () => void;
};

const SITE_URL = 'https://somaij.github.io/puzzle-game/';
const shareUrl = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + window.location.pathname : SITE_URL);

/** Phones get the system share sheet; desktops copy, since a share dialog there is rarely what's wanted. */
async function shareOrCopy(text: string): Promise<'shared' | 'copied' | 'failed' | 'cancelled'> {
  if (Platform.OS !== 'web') {
    await Share.share({ message: text });
    return 'shared';
  }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav?.share && nav.maxTouchPoints > 0) {
    try {
      await nav.share({ text });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // Otherwise fall through and try the clipboard.
    }
  }
  try {
    await nav?.clipboard.writeText(text);
    return nav?.clipboard ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}

function msToMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

/** Time until the next puzzle, at local midnight. */
function NextPuzzle() {
  const [ms, setMs] = useState(msToMidnight);
  useEffect(() => {
    const id = setInterval(() => setMs(msToMidnight()), 1000);
    return () => clearInterval(id);
  }, []);
  const total = Math.ceil(ms / 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  return (
    <View testID="next-puzzle" style={styles.next}>
      <Text style={styles.nextLabel}>Next puzzle in</Text>
      <Text style={styles.nextTime}>
        {two(Math.floor(total / 3600))}:{two(Math.floor(total / 60) % 60)}:{two(total % 60)}
      </Text>
    </View>
  );
}

/** Where the total came from: pieces (lemon), speed (magenta), unused misses (white). */
function Breakdown({ pieces, speed, bonus }: { pieces: number; speed: number; bonus: number }) {
  const parts = [
    { label: 'Pieces', value: pieces, color: colors.accent },
    { label: 'Speed', value: speed, color: colors.multiplier },
    { label: 'Unused misses', value: bonus, color: colors.text },
  ].filter((p) => p.value > 0);
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (total === 0) return null;
  return (
    <View testID="score-breakdown" style={styles.breakdown}>
      <View style={styles.stack}>
        {parts.map((p) => (
          <View key={p.label} style={{ flex: p.value / total, backgroundColor: p.color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: p.color }]} />
            <Text style={styles.small}>
              {p.label} {withCommas(p.value)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

/** The result of a finished game: what you scored, your stats, and sharing it. */
export function ResultSheet({ puzzleNumber, game, moves, stats, onClose, onFinishPicture, onReplay }: Props) {
  const won = game.status === 'won';
  const unfinished = game.status === 'failed' && game.placedCount < PIECE_COUNT;
  // Pieces placed before the score locked: finishing the picture afterwards doesn't add to these.
  const placed = game.moves.filter((m) => m !== 'miss').length;

  let pieces = 0;
  let speed = 0;
  for (const m of moves) {
    if (m.kind === 'miss') continue;
    pieces += m.base;
    speed += m.points - m.base;
  }

  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(id);
  }, [feedback]);
  const share = async () => {
    const outcome = await shareOrCopy(shareText({ puzzle: puzzleNumber, won, score: game.score, placed, moves }, shareUrl()));
    if (outcome === 'copied') setFeedback('Copied!');
    if (outcome === 'failed') setFeedback("Couldn't copy");
    if (stats && (outcome === 'shared' || outcome === 'copied')) trackEvent('result-share', { puzzle: puzzleNumber });
  };

  const summary = won
    ? `All ${PIECE_COUNT} pieces placed.`
    : game.placedCount === PIECE_COUNT
      ? 'Out of misses. Picture finished; your score locked at the last miss.'
      : `Out of misses at ${placed} of ${PIECE_COUNT} pieces. Your score is locked.`;

  return (
    <View testID="result-sheet" style={styles.backdrop}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View testID="end-card" style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {won ? 'Solved' : 'The jig is up'}
          </Text>
          <Text testID="final-score" style={styles.score}>
            {withCommas(game.score)}
          </Text>
          <Text style={styles.summary}>{summary}</Text>
          <Breakdown pieces={pieces} speed={speed} bonus={game.missBonus} />

          {stats ? (
            <View testID="stats" style={styles.stats}>
              <Stat value={String(stats.played)} label="played" />
              <Stat value={`${stats.played ? Math.round((100 * stats.won) / stats.played) : 0}%`} label="solved" />
              <Stat value={String(currentStreak(stats, puzzleNumber))} label="day streak" />
              <Stat value={withCommas(stats.bestScore)} label="best score" />
            </View>
          ) : (
            <Text style={styles.small}>Practice puzzle: this one doesn’t count.</Text>
          )}
          {stats && <NextPuzzle />}

          <View style={styles.buttons}>
            {unfinished && (
              <Pressable testID="finish-picture" accessibilityRole="button" style={[styles.button, styles.primary]} onPress={onFinishPicture}>
                <Text style={styles.primaryText}>Finish the picture</Text>
              </Pressable>
            )}
            <Pressable testID="share-result" accessibilityRole="button" style={[styles.button, unfinished ? styles.secondary : styles.primary]} onPress={share}>
              <Text style={unfinished ? styles.secondaryText : styles.primaryText}>{feedback ?? 'Share'}</Text>
            </Pressable>
            {!stats && (
              <Pressable accessibilityRole="button" style={[styles.button, styles.secondary]} onPress={onReplay}>
                <Text style={styles.secondaryText}>{won ? 'Play again' : 'Try again'}</Text>
              </Pressable>
            )}
          </View>
          <Pressable testID="close-result" accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>See the board</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: overlays.backdrop },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 8,
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  title: { ...type.titleCard, color: colors.text },
  score: { ...type.valueEndScore, fontSize: 40, lineHeight: 48, color: colors.text },
  summary: { ...type.body, color: colors.muted, textAlign: 'center' },
  breakdown: { alignSelf: 'stretch', gap: 8, marginTop: 6 },
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  small: { ...type.small, color: colors.muted, textAlign: 'center' },
  stats: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...type.valueScore, color: colors.text },
  next: { alignItems: 'center', marginTop: 4 },
  nextLabel: { ...type.small, color: colors.muted },
  nextTime: { ...type.valueScore, color: colors.text },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  button: { minWidth: 120, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1 },
  primary: { backgroundColor: colors.text, borderColor: colors.text },
  primaryText: { ...type.buttonPrimary, color: colors.onAccent },
  secondary: { backgroundColor: 'transparent', borderColor: colors.pieceOutline },
  secondaryText: { ...type.buttonPrimary, color: colors.text },
  close: { paddingVertical: 8, paddingHorizontal: 12 },
  closeText: { ...type.button, color: colors.muted },
});
