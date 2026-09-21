import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { createPuzzle, imageIndexFor, puzzleNumber } from './src/engine/daily';
import { PUZZLE_IMAGES } from './src/puzzleImages';
import { GameScreen } from './src/ui/GameScreen';

/** Today's puzzle number. In development on web, `?puzzle=N` in the URL picks a specific day. */
function currentPuzzleNumber(): number {
  if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined') {
    const n = Number(new URLSearchParams(window.location.search).get('puzzle'));
    if (Number.isInteger(n) && n >= 1) return n;
  }
  return puzzleNumber(new Date());
}

export default function App() {
  const puzzle = useMemo(() => createPuzzle(currentPuzzleNumber()), []);
  const image = PUZZLE_IMAGES[imageIndexFor(puzzle.number, PUZZLE_IMAGES.length)];
  return (
    <>
      <GameScreen puzzle={puzzle} image={image} />
      <StatusBar style="light" />
    </>
  );
}
