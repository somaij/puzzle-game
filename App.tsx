import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { createPuzzle, imageIndexFor, puzzleNumber } from './src/engine/daily';
import { reloadWhenDayChanges, setUpOfflinePlay } from './src/pwa';
import { PUZZLE_GLOWS, PUZZLE_IMAGES } from './src/puzzleImages';
import { startBackdrop } from './src/ui/backdrop';
import { pageBackground } from './src/ui/colors';
import { GameScreen } from './src/ui/GameScreen';
import { FONT_FILES } from './src/ui/type';

const onWeb = Platform.OS === 'web' && typeof window !== 'undefined';

/**
 * The puzzles `?puzzle=N` can open: every day up to today, as replayable practice. Future days
 * would let players rehearse a puzzle before it counts, so only dev builds can reach them (to
 * check every bundled photo).
 */
const today = puzzleNumber(new Date());
const lastPuzzle = __DEV__ ? Math.max(today, PUZZLE_IMAGES.length) : today;

/** Today's puzzle, unless `?puzzle=N` in the web URL picks another. */
function initialPuzzleNumber(): number {
  if (onWeb) {
    const n = Number(new URLSearchParams(window.location.search).get('puzzle'));
    if (Number.isInteger(n) && n >= 1 && n <= lastPuzzle) return n;
  }
  return puzzleNumber(new Date());
}

export default function App() {
  const [number] = useState(initialPuzzleNumber);
  // Only today's puzzle is the one-play daily; any other `?puzzle=N` is free practice.
  const [isDaily] = useState(() => number === puzzleNumber(new Date()));
  const puzzle = useMemo(() => createPuzzle(number), [number]);
  useEffect(() => {
    if (onWeb) setUpOfflinePlay(PUZZLE_IMAGES.length);
  }, []);
  useEffect(() => {
    if (onWeb) return startBackdrop(PUZZLE_GLOWS[imageIndexFor(number, PUZZLE_GLOWS.length)][0]);
  }, [number]);
  useEffect(() => {
    if (onWeb && isDaily) return reloadWhenDayChanges(number);
  }, [isDaily, number]);
  // The fonts are bundled and small, so wait for them rather than flash the system font.
  // If one fails, carry on with the fallback rather than show a blank page.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const image = PUZZLE_IMAGES[imageIndexFor(puzzle.number, PUZZLE_IMAGES.length)];

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: pageBackground }} />;

  return (
    <>
      <GameScreen puzzle={puzzle} image={image} isDaily={isDaily} />
      <StatusBar style="light" />
    </>
  );
}
