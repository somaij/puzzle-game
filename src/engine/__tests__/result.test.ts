import { currentStreak, NO_STATS, recordResult, shareText, type ScoredMove } from '../result';

describe('share text', () => {
  const url = 'https://example.test/';
  const joined = (multTenths = 10): ScoredMove => ({ kind: 'joined', base: 25, points: Math.round(2.5 * multTenths), multTenths });
  const miss: ScoredMove = { kind: 'miss' };

  it('gives each fact of a solved game its own line and emoji', () => {
    expect(shareText({ puzzle: 49, won: true, score: 2349, placed: 24, moves: [joined(20)] }, url)).toBe(
      `🧩 Daily Jigsaw #49\n✅ Solved\n🎯 No misses\n⭐ 2,349 points\n⚡ Top speed ×2.0\n${url}`,
    );
  });

  it('counts misses, with the right plural', () => {
    expect(shareText({ puzzle: 1, won: true, score: 1, placed: 24, moves: [miss] }, url)).toContain('\n❌ 1 miss\n');
    expect(shareText({ puzzle: 1, won: true, score: 1, placed: 24, moves: [miss, miss, miss] }, url)).toContain('\n❌ 3 misses\n');
  });

  it('leaves out the top speed when there was no bonus', () => {
    expect(shareText({ puzzle: 1, won: true, score: 600, placed: 24, moves: [joined()] }, url)).not.toContain('Top speed');
  });

  it('says how far a failed game got', () => {
    const text = shareText({ puzzle: 2, won: false, score: 554, placed: 11, moves: [joined(11), ...Array<ScoredMove>(12).fill(miss)] }, url);
    expect(text).toBe(`🧩 Daily Jigsaw #2\n💔 Out of misses at 11/24 pieces\n⭐ 554 points\n⚡ Top speed ×1.1\n${url}`);
  });
});

describe('stats', () => {
  it('counts a first game', () => {
    expect(recordResult(NO_STATS, { puzzle: 5, won: true, score: 900 })).toEqual({
      played: 1,
      won: 1,
      streak: 1,
      bestStreak: 1,
      bestScore: 900,
      lastPuzzle: 5,
    });
  });

  it('never counts the same puzzle twice', () => {
    const once = recordResult(NO_STATS, { puzzle: 5, won: true, score: 900 });
    expect(recordResult(once, { puzzle: 5, won: true, score: 2000 })).toBe(once);
    expect(recordResult(once, { puzzle: 4, won: true, score: 2000 })).toBe(once);
  });

  it('keeps the streak across a failed day, and resets it after a skipped one', () => {
    let s = recordResult(NO_STATS, { puzzle: 5, won: true, score: 900 });
    s = recordResult(s, { puzzle: 6, won: false, score: 100 });
    expect(s).toMatchObject({ streak: 2, bestStreak: 2, played: 2, won: 1, bestScore: 900 });
    s = recordResult(s, { puzzle: 9, won: true, score: 1000 });
    expect(s).toMatchObject({ streak: 1, bestStreak: 2, bestScore: 1000 });
  });

  it('shows a streak until a whole day has been missed', () => {
    const s = recordResult(NO_STATS, { puzzle: 5, won: true, score: 900 });
    expect(currentStreak(s, 5)).toBe(1);
    expect(currentStreak(s, 6)).toBe(1);
    expect(currentStreak(s, 7)).toBe(0);
  });
});
