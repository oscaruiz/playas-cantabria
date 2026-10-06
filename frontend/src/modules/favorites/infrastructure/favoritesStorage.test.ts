import { readFavorites, saveFavorites } from './favoritesStorage';

const KEY = 'playas:favoritas';

beforeEach(() => {
  localStorage.clear();
});

describe('guardar y leer favoritas', () => {
  it('sobrevive al ciclo guardar → leer conservando el orden', () => {
    saveFavorites(['3908503', '3900101']);
    expect(readFavorites()).toEqual(['3908503', '3900101']);
  });

  it('deduplica al guardar', () => {
    saveFavorites(['a', 'a', 'b', 'a']);
    expect(readFavorites()).toEqual(['a', 'b']);
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({
      version: 1,
      beachCodes: ['a', 'b'],
    });
  });

  it('una lista vacía también persiste (quitar la última favorita)', () => {
    saveFavorites(['a']);
    saveFavorites([]);
    expect(readFavorites()).toEqual([]);
  });
});

describe('leerFavoritas con almacenamiento corrupto', () => {
  it.each([
    ['JSON roto', '{no es json'],
    ['un array a pelo', '["a","b"]'],
    ['un primitivo', '42'],
    ['versión desconocida', '{"version":2,"beachCodes":["a"]}'],
    ['sin versión', '{"beachCodes":["a"]}'],
    ['beachCodes no-array', '{"version":1,"beachCodes":"a"}'],
    ['sin beachCodes', '{"version":1}'],
  ])('%s → sin favoritas, sin explotar', (_case, raw) => {
    localStorage.setItem(KEY, raw);
    expect(readFavorites()).toEqual([]);
  });

  it('filtra las entradas que no son códigos y deduplica', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, beachCodes: [1, null, 'ok', '', 'ok', {}, 'otro'] })
    );
    expect(readFavorites()).toEqual(['ok', 'otro']);
  });
});

describe('fallos del propio localStorage', () => {
  it('guardar no explota cuando setItem lanza (modo privado, cuota)', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveFavorites(['a'])).not.toThrow();
    spy.mockRestore();
  });

  it('leer no explota cuando getItem lanza', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readFavorites()).toEqual([]);
    spy.mockRestore();
  });
});
