import { PIECE_COUNT } from '../constants';
import { createPuzzle, imageIndexFor, puzzleNumber, seedFor } from '../daily';

const launch = { year: 2026, month: 3, day: 1 };

describe('puzzleNumber', () => {
  it('is 1 on launch day, at any time of day', () => {
    expect(puzzleNumber(new Date(2026, 2, 1, 0, 0, 0), launch)).toBe(1);
    expect(puzzleNumber(new Date(2026, 2, 1, 23, 59, 59), launch)).toBe(1);
  });

  it('goes up by one per local calendar day', () => {
    expect(puzzleNumber(new Date(2026, 2, 2, 0, 0, 1), launch)).toBe(2);
    expect(puzzleNumber(new Date(2026, 2, 31, 12), launch)).toBe(31);
    expect(puzzleNumber(new Date(2027, 2, 1, 12), launch)).toBe(366);
  });

  it('is not thrown off by daylight-saving changes', () => {
    // Run in a zone with clock changes (US: 8 Mar and 1 Nov 2026), and prove it took effect.
    process.env.TZ = 'America/New_York';
    expect(new Date(2026, 0, 1).getTimezoneOffset()).not.toBe(new Date(2026, 6, 1).getTimezoneOffset());
    for (let day = 1; day <= 300; day++) {
      const early = new Date(2026, 2, day, 0, 30);
      const late = new Date(2026, 2, day, 23, 30);
      expect(puzzleNumber(early, launch)).toBe(day);
      expect(puzzleNumber(late, launch)).toBe(day);
    }
  });

  it('never goes below 1 before launch', () => {
    expect(puzzleNumber(new Date(2025, 0, 1), launch)).toBe(1);
  });
});

describe('seedFor', () => {
  it('gives different seeds for neighbouring puzzles', () => {
    const seeds = new Set(Array.from({ length: 1000 }, (_, i) => seedFor(i + 1)));
    expect(seeds.size).toBe(1000);
  });
});

describe('createPuzzle', () => {
  it('is identical for the same puzzle number', () => {
    expect(createPuzzle(5)).toEqual(createPuzzle(5));
  });

  it('differs between days', () => {
    expect(createPuzzle(1).cuts).not.toEqual(createPuzzle(2).cuts);
    expect(createPuzzle(1).order).not.toEqual(createPuzzle(2).order);
  });

  it('deals every piece exactly once', () => {
    const { order } = createPuzzle(3);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: PIECE_COUNT }, (_, i) => i));
  });
});

describe('imageIndexFor', () => {
  it('cycles through the images', () => {
    expect([1, 2, 3, 4].map((n) => imageIndexFor(n, 3))).toEqual([0, 1, 2, 0]);
  });
});
