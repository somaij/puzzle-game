import { parseEvent } from '../parse';

const finish = { event: 'puzzle-finish', puzzle: 51, result: 'solved', score: 1834, misses: 6, top_speed: 2, seconds_per_piece: 3.4, islands: 5, streak: 2 };

describe('parseEvent', () => {
  it('accepts a finished game', () => {
    expect(parseEvent(finish)).toEqual(finish);
  });

  it('accepts start and share events, leaving the game fields empty', () => {
    expect(parseEvent({ event: 'puzzle-start', puzzle: 51 })).toMatchObject({ event: 'puzzle-start', puzzle: 51, score: null, streak: null });
    expect(parseEvent({ event: 'result-share', puzzle: 51 })).toMatchObject({ event: 'result-share', puzzle: 51, result: null });
  });

  it('drops fields it does not know about', () => {
    expect(parseEvent({ ...finish, player: 'someone' })).toEqual(finish);
  });

  it.each([
    ['an unknown event', { ...finish, event: 'other' }],
    ['a missing puzzle', { event: 'puzzle-start' }],
    ['a fractional puzzle', { ...finish, puzzle: 1.5 }],
    ['an unknown result', { ...finish, result: 'won' }],
    ['a negative score', { ...finish, score: -1 }],
    ['a score given as text', { ...finish, score: '1834' }],
    ['an impossible multiplier', { ...finish, top_speed: 50 }],
    ['a missing streak', { ...finish, streak: undefined }],
    ['not an object', 'puzzle-start'],
    ['null', null],
  ])('rejects %s', (_name, body) => {
    expect(parseEvent(body)).toBeNull();
  });
});
