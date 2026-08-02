import { leerFavoritas, guardarFavoritas } from './favoritesStorage';

const CLAVE = 'playas:favoritas';

beforeEach(() => {
  localStorage.clear();
});

describe('guardar y leer favoritas', () => {
  it('sobrevive al ciclo guardar → leer conservando el orden', () => {
    guardarFavoritas(['3908503', '3900101']);
    expect(leerFavoritas()).toEqual(['3908503', '3900101']);
  });

  it('deduplica al guardar', () => {
    guardarFavoritas(['a', 'a', 'b', 'a']);
    expect(leerFavoritas()).toEqual(['a', 'b']);
    expect(JSON.parse(localStorage.getItem(CLAVE) as string)).toEqual({
      version: 1,
      beachCodes: ['a', 'b'],
    });
  });

  it('una lista vacía también persiste (quitar la última favorita)', () => {
    guardarFavoritas(['a']);
    guardarFavoritas([]);
    expect(leerFavoritas()).toEqual([]);
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
  ])('%s → sin favoritas, sin explotar', (_caso, crudo) => {
    localStorage.setItem(CLAVE, crudo);
    expect(leerFavoritas()).toEqual([]);
  });

  it('filtra las entradas que no son códigos y deduplica', () => {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ version: 1, beachCodes: [1, null, 'ok', '', 'ok', {}, 'otro'] })
    );
    expect(leerFavoritas()).toEqual(['ok', 'otro']);
  });
});

describe('fallos del propio localStorage', () => {
  it('guardar no explota cuando setItem lanza (modo privado, cuota)', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => guardarFavoritas(['a'])).not.toThrow();
    spy.mockRestore();
  });

  it('leer no explota cuando getItem lanza', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(leerFavoritas()).toEqual([]);
    spy.mockRestore();
  });
});
