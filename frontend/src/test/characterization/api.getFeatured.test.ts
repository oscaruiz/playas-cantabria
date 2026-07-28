/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Fija `getFeaturedBeaches()`: misma caché de 5 min y misma deduplicación que
 * `getPlayas` pero implementadas por separado (F2 las unifica en `ttlCache` /
 * `inFlight`), con la diferencia de que aquí SÍ existe `{ force: true }` para
 * saltarse la caché — es lo que usa el botón de reintento de la home.
 *
 * Nota: el backend manda `Cache-Control: max-age=60` para este endpoint, pero
 * el cliente aplica 300 s igualmente. Queda fijado como está.
 */

import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { featuredResponse } from '../fixtures/featured';

const FEATURED = '/api/beaches/featured';
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
