import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { createPuzzle, imageIndexFor, puzzleNumber } from './src/engine/daily';
import { PUZZLE_IMAGES } from './src/puzzleImages';
import { colors } from './src/ui/colors';
import { GameScreen } from './src/ui/GameScreen';
import { FONT_FILES } from './src/ui/type';

const onWeb = Platform.OS === 'web' && typeof window !== 'undefined';

/**
 * The puzzles `?puzzle=N` can open (a testing aid until checkpoint 4 decides what players can
 * reach): every day up to today, and far enough ahead to reach every bundled photo. The ‹ ›
 * switcher was removed from the screen in the quieter design; the URL still works.
 */
const lastPuzzle = Math.max(puzzleNumber(new Date()), PUZZLE_IMAGES.length);

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
  const puzzle = useMemo(() => createPuzzle(number), [number]);
  // The fonts are bundled and small, so wait for them rather than flash the system font.
  // If one fails, carry on with the fallback rather than show a blank page.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const image = PUZZLE_IMAGES[imageIndexFor(puzzle.number, PUZZLE_IMAGES.length)];

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <>
      <GameScreen puzzle={puzzle} image={image} />
      <StatusBar style="light" />
    </>
  );
}
