/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down `getFeaturedBeaches()`: same 5 min cache and same deduplication as
 * `getPlayas` but implemented separately (F2 unifies them into `ttlCache` /
 * `inFlight`), with the difference that here `{ force: true }` DOES exist to
 * skip the cache — it is what the home's retry button uses.
 *
 * Note: the backend sends `Cache-Control: max-age=60` for this endpoint, but
 * the client applies 300 s anyway. It is pinned down as it is.
 */

import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { featuredResponse } from '../fixtures/featured';
import { RUTA_DESTACADAS as FEATURED } from '../apiRoutes';

const TTL_MS = 5 * 60 * 1000;

async function loadApi() {
  jest.resetModules();
  return import('../../services/api');
}

afterEach(() => {
  restoreFetch();
  jest.useRealTimers();
});

describe('getFeaturedBeaches', () => {
  it('devuelve la respuesta del backend', async () => {
    installFetchMock([route(FEATURED, { json: featuredResponse })]);
    const { getFeaturedBeaches } = await loadApi();

    await expect(getFeaturedBeaches()).resolves.toEqual(featuredResponse);
  });

  it('rechaza cuando la respuesta no es ok', async () => {
    installFetchMock([route(FEATURED, { status: 503 })]);
    const { getFeaturedBeaches } = await loadApi();

    await expect(getFeaturedBeaches()).rejects.toThrow(
      'No se pudieron cargar las playas destacadas',
    );
  });

  it('reutiliza la caché dentro de los 5 min', async () => {
    jest.useFakeTimers();
    const fetchMock = installFetchMock([route(FEATURED, { json: featuredResponse })]);
    const { getFeaturedBeaches } = await loadApi();

    await getFeaturedBeaches();
    await getFeaturedBeaches();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('vuelve a pedir cuando la caché ha caducado', async () => {
    jest.useFakeTimers();
    const fetchMock = installFetchMock([route(FEATURED, { json: featuredResponse })]);
    const { getFeaturedBeaches } = await loadApi();

    await getFeaturedBeaches();
    jest.advanceTimersByTime(TTL_MS + 1);
    await getFeaturedBeaches();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('`force: true` se salta la caché', async () => {
    const fetchMock = installFetchMock([route(FEATURED, { json: featuredResponse })]);
    const { getFeaturedBeaches } = await loadApi();

    await getFeaturedBeaches();
    await getFeaturedBeaches({ force: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplica dos llamadas concurrentes', async () => {
    const fetchMock = installFetchMock([route(FEATURED, { json: featuredResponse, delayMs: 10 })]);
    const { getFeaturedBeaches } = await loadApi();

    await Promise.all([getFeaturedBeaches(), getFeaturedBeaches()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
