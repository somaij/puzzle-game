import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { createPuzzle, imageIndexFor, puzzleNumber } from './src/engine/daily';
import { PUZZLE_IMAGES } from './src/puzzleImages';
import { GameScreen } from './src/ui/GameScreen';

const onWeb = Platform.OS === 'web' && typeof window !== 'undefined';

/**
 * The puzzles you can switch between (a testing aid until checkpoint 4 decides what players can
 * reach): every day up to today, and far enough ahead to reach every bundled photo.
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
  const [number, setNumber] = useState(initialPuzzleNumber);
  const puzzle = useMemo(() => createPuzzle(number), [number]);
  const image = PUZZLE_IMAGES[imageIndexFor(puzzle.number, PUZZLE_IMAGES.length)];

  const selectPuzzle = (n: number) => {
    setNumber(n);
    // Keep the choice in the URL, so a reload (or a shared link) opens the same puzzle.
    if (onWeb) {
      const url = new URL(window.location.href);
      url.searchParams.set('puzzle', String(n));
      window.history.replaceState(null, '', url);
    }
  };

  return (
    <>
      {/* Keyed by number, so switching starts a fresh game (and its photo preview). */}
      <GameScreen key={number} puzzle={puzzle} image={image} lastPuzzle={lastPuzzle} onSelectPuzzle={selectPuzzle} />
      <StatusBar style="light" />
    </>
  );
}
