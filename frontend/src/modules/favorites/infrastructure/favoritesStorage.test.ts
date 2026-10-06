import { readFavorites, saveFavorites } from './favoritesStorage';

const KEY = 'playas:favoritas';

beforeEach(() => {
  localStorage.clear();
});

describe('saving and reading favorites', () => {
  it('survives the save → read cycle keeping the order', () => {
    saveFavorites(['3908503', '3900101']);
    expect(readFavorites()).toEqual(['3908503', '3900101']);
  });

  it('deduplicates on save', () => {
    saveFavorites(['a', 'a', 'b', 'a']);
    expect(readFavorites()).toEqual(['a', 'b']);
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({
      version: 1,
      beachCodes: ['a', 'b'],
    });
  });

  it('an empty list also persists (removing the last favorite)', () => {
    saveFavorites(['a']);
    saveFavorites([]);
    expect(readFavorites()).toEqual([]);
  });
});

describe('readFavorites with corrupt storage', () => {
  it.each([
    ['broken JSON', '{no es json'],
    ['a bare array', '["a","b"]'],
    ['a primitive', '42'],
    ['unknown version', '{"version":2,"beachCodes":["a"]}'],
    ['no version', '{"beachCodes":["a"]}'],
    ['non-array beachCodes', '{"version":1,"beachCodes":"a"}'],
    ['no beachCodes', '{"version":1}'],
  ])('%s → no favorites, no blow-up', (_case, raw) => {
    localStorage.setItem(KEY, raw);
    expect(readFavorites()).toEqual([]);
  });

  it('filters out entries that are not codes and deduplicates', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, beachCodes: [1, null, 'ok', '', 'ok', {}, 'otro'] })
    );
    expect(readFavorites()).toEqual(['ok', 'otro']);
  });
});

describe('failures of localStorage itself', () => {
  it('saving does not blow up when setItem throws (private mode, quota)', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveFavorites(['a'])).not.toThrow();
    spy.mockRestore();
  });

  it('reading does not blow up when getItem throws', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readFavorites()).toEqual([]);
    spy.mockRestore();
  });
});
