/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down `resolveApiBaseUrl()` and `buildApiUrl()`. In F2 this logic moves to
 * `core/infrastructure/http/{client,endpoints}.ts`; the observable contract
 * (default URL, normalization, rejection of odd protocols) does not change.
 */

// The file only uses dynamic `import()`; without this export it would not be a
// module and `isolatedModules` rejects it at compile time.
export {};

const DEFAULT_URL = 'https://playas-cantabria.onrender.com';

async function loadConfig(value?: string) {
  if (value === undefined) {
    delete process.env.REACT_APP_API_BASE_URL;
  } else {
    process.env.REACT_APP_API_BASE_URL = value;
  }
  jest.resetModules();
  return import('../../config/api');
}

const ORIGINAL = process.env.REACT_APP_API_BASE_URL;

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  // `resolveApiBaseUrl` warns on the console with invalid values; that is
  // intentional and must not pollute the tests' output.
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
  if (ORIGINAL === undefined) {
    delete process.env.REACT_APP_API_BASE_URL;
  } else {
    process.env.REACT_APP_API_BASE_URL = ORIGINAL;
  }
});

describe('API_BASE_URL', () => {
  it('usa la URL de producción cuando no hay variable de entorno', async () => {
    const { API_BASE_URL } = await loadConfig(undefined);
    expect(API_BASE_URL).toBe(DEFAULT_URL);
  });

  it('ignora una variable vacía o solo con espacios', async () => {
    const { API_BASE_URL } = await loadConfig('   ');
    expect(API_BASE_URL).toBe(DEFAULT_URL);
  });

  it('respeta un override válido', async () => {
    const { API_BASE_URL } = await loadConfig('http://localhost:4000');
    expect(API_BASE_URL).toBe('http://localhost:4000');
  });

  it('quita las barras finales', async () => {
    const { API_BASE_URL } = await loadConfig('https://api.example.test///');
    expect(API_BASE_URL).toBe('https://api.example.test');
  });

  it('descarta protocolos no http(s)', async () => {
    const { API_BASE_URL } = await loadConfig('ftp://api.example.test');
    expect(API_BASE_URL).toBe(DEFAULT_URL);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('descarta un valor que no es una URL', async () => {
    const { API_BASE_URL } = await loadConfig('no-es-una-url');
    expect(API_BASE_URL).toBe(DEFAULT_URL);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('buildApiUrl', () => {
  it('acepta rutas con y sin barra inicial', async () => {
    const { buildApiUrl } = await loadConfig('https://api.example.test');

    expect(buildApiUrl('/api/beaches')).toBe('https://api.example.test/api/beaches');
    expect(buildApiUrl('api/beaches')).toBe('https://api.example.test/api/beaches');
  });

  it('devuelve la base cuando la ruta está vacía', async () => {
    const { buildApiUrl, API_BASE_URL } = await loadConfig('https://api.example.test');
    expect(buildApiUrl('')).toBe(API_BASE_URL);
  });
});
