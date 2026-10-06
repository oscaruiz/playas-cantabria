/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down `getFeaturedBeaches()`: same 5 min cache and same deduplication as
 * `getBeaches` but implemented separately (F2 unifies them into `ttlCache` /
 * `inFlight`), with the difference that here `{ force: true }` DOES exist to
 * skip the cache — it is what the home's retry button uses.
 *
 * Note: the backend sends `Cache-Control: max-age=60` for this endpoint, but
 * the client applies 300 s anyway. It is pinned down as it is.
 */

import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { featuredResponse } from '../fixtures/featured';
import { FEATURED_PATH as FEATURED } from '../apiRoutes';

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
  it('returns the backend response', async () => {
    installFetchMock([route(FEATURED, { json: featuredResponse })]);
    const { getFeaturedBeaches } = await loadApi();

    await expect(getFeaturedBeaches()).resolves.toEqual(featuredResponse);
  });

  it('rejects when the response is not ok', async () => {
    installFetchMock([route(FEATURED, { status: 503 })]);
    const { getFeaturedBeaches } = await loadApi();

    await expect(getFeaturedBeaches()).rejects.toThrow(
      'No se pudieron cargar las playas destacadas',
    );
  });

  it('reuses the cache within 5 min', async () => {
    jest.useFakeTimers();
    const fetchMock = installFetchMock([route(FEATURED, { json: featuredResponse })]);
    const { getFeaturedBeaches } = await loadApi();

    await getFeaturedBeaches();
    await getFeaturedBeaches();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requests again when the cache has expired', async () => {
    jest.useFakeTimers();
    const fetchMock = installFetchMock([route(FEATURED, { json: featuredResponse })]);
    const { getFeaturedBeaches } = await loadApi();

    await getFeaturedBeaches();
    jest.advanceTimersByTime(TTL_MS + 1);
    await getFeaturedBeaches();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('`force: true` skips the cache', async () => {
    const fetchMock = installFetchMock([route(FEATURED, { json: featuredResponse })]);
    const { getFeaturedBeaches } = await loadApi();

    await getFeaturedBeaches();
    await getFeaturedBeaches({ force: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplicates two concurrent calls', async () => {
    const fetchMock = installFetchMock([route(FEATURED, { json: featuredResponse, delayMs: 10 })]);
    const { getFeaturedBeaches } = await loadApi();

    await Promise.all([getFeaturedBeaches(), getFeaturedBeaches()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
