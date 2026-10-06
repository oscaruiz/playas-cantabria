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
  return import('../../shared/config/api');
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
  it('uses the production URL when there is no env variable', async () => {
    const { API_BASE_URL } = await loadConfig(undefined);
    expect(API_BASE_URL).toBe(DEFAULT_URL);
  });

  it('ignores an empty or whitespace-only variable', async () => {
    const { API_BASE_URL } = await loadConfig('   ');
    expect(API_BASE_URL).toBe(DEFAULT_URL);
  });

  it('honours a valid override', async () => {
    const { API_BASE_URL } = await loadConfig('http://localhost:4000');
    expect(API_BASE_URL).toBe('http://localhost:4000');
  });

  it('strips trailing slashes', async () => {
    const { API_BASE_URL } = await loadConfig('https://api.example.test///');
    expect(API_BASE_URL).toBe('https://api.example.test');
  });

  it('discards non-http(s) protocols', async () => {
    const { API_BASE_URL } = await loadConfig('ftp://api.example.test');
    expect(API_BASE_URL).toBe(DEFAULT_URL);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('discards a value that is not a URL', async () => {
    const { API_BASE_URL } = await loadConfig('no-es-una-url');
    expect(API_BASE_URL).toBe(DEFAULT_URL);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('buildApiUrl', () => {
  it('accepts paths with and without a leading slash', async () => {
    const { buildApiUrl } = await loadConfig('https://api.example.test');

    expect(buildApiUrl('/api/beaches')).toBe('https://api.example.test/api/beaches');
    expect(buildApiUrl('api/beaches')).toBe('https://api.example.test/api/beaches');
  });

  it('returns the base when the path is empty', async () => {
    const { buildApiUrl, API_BASE_URL } = await loadConfig('https://api.example.test');
    expect(buildApiUrl('')).toBe(API_BASE_URL);
  });
});
