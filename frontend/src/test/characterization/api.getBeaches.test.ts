/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down the CURRENT behaviour of `getPlayas()`: the 2.5 s race against the
 * local JSON, the 5 min cache, the deduplication of in-flight requests and the
 * guarantee that it NEVER rejects.
 *
 * It is written against the public signature (`getPlayas(options)`) on purpose:
 * in F2 the implementation moves to `core/application/use-cases/getBeaches.ts`
 * and `services/api.ts` is left as a shim, and this file must keep passing
 * WITHOUT TOUCHING IT. If it has to be edited, the refactor changed behaviour.
 *
 * Each test reloads the module (`jest.resetModules()`) because `services/api.ts`
 * keeps the cache and the in-flight requests in module variables. That need is,
 * in itself, the documentation of the problem that F2 fixes.
 */

import { waitFor } from '@testing-library/react';
import { installFetchMock, restoreFetch, route, flushMicrotasks } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { BEACHES_PATH as BEACHES } from '../apiRoutes';
import { LOCAL_CATALOG_SIZE } from '../localCatalog';


const TTL_MS = 5 * 60 * 1000;

async function loadApi() {
  jest.resetModules();
  return import('../../services/api');
}

// Isolation between tests: `getPlayas` saves the last REAL backend listing in
// localStorage and prefers it over the build's JSON as a fallback. Without
// clearing, the listing one test leaves behind contaminates the next one's
// fallback. What these tests pin down is the "there is no saved copy" path →
// the build's JSON; the path with a saved copy lives in
// api.getBeaches.persistencia.test.ts.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  restoreFetch();
  jest.useRealTimers();
  localStorage.clear();
});

describe('getPlayas — carrera contra el fallback local', () => {
  it('devuelve los datos del backend cuando responde antes del timeout', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getBeaches } = await loadApi();
    const onBackendData = jest.fn();

    const result = await getBeaches({ timeoutMs: 50, onBackendData });

    expect(result).toEqual(beachesResponse);
    // If the backend wins the race nobody has seen fallback data, so there is
    // nothing to "update" and the callback must not fire.
    expect(onBackendData).not.toHaveBeenCalled();
  });

  it('devuelve el JSON local cuando el backend tarda más que el timeout', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 200 })]);
    const { getBeaches } = await loadApi();
    const onBackendData = jest.fn();

    const result = await getBeaches({ timeoutMs: 20, onBackendData });

    // The fallback is the whole `src/data/beaches.json`, not the fixture.
    expect(result).toHaveLength(LOCAL_CATALOG_SIZE);
    expect(result[0]).toHaveProperty('codigo');
  });

  it('avisa por `onBackendData` exactamente una vez cuando el backend llega tarde', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 100 })]);
    const { getBeaches } = await loadApi();
    const onBackendData = jest.fn();

    await getBeaches({ timeoutMs: 20, onBackendData });

    await waitFor(() => expect(onBackendData).toHaveBeenCalledTimes(1));
    expect(onBackendData).toHaveBeenCalledWith(beachesResponse);
  });

  it('usa 2500 ms como timeout por defecto', async () => {
    jest.useFakeTimers();
    // The backend never answers within the observed window.
    installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 60_000 })]);
    const { getBeaches } = await loadApi();

    let resolved: unknown = null;
    const pending = getBeaches().then((value) => {
      resolved = value;
    });

    jest.advanceTimersByTime(2499);
    await flushMicrotasks();
    expect(resolved).toBeNull();

    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    await pending;

    expect(resolved).toHaveLength(LOCAL_CATALOG_SIZE);
  });
});

describe('getPlayas — nunca rechaza', () => {
  it('cae al JSON local si el backend responde 500', async () => {
    installFetchMock([route(BEACHES, { status: 500 })]);
    const { getBeaches } = await loadApi();

    await expect(getBeaches({ timeoutMs: 50 })).resolves.toHaveLength(LOCAL_CATALOG_SIZE);
  });

  it('cae al JSON local si falla la red', async () => {
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getBeaches } = await loadApi();

    await expect(getBeaches({ timeoutMs: 50 })).resolves.toHaveLength(LOCAL_CATALOG_SIZE);
  });
});

describe('getPlayas — caché y deduplicación', () => {
  it('reutiliza la caché dentro de los 5 min (una sola petición)', async () => {
    jest.useFakeTimers();
    const fetchMock = installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getBeaches } = await loadApi();

    await getBeaches({ timeoutMs: 50 });
    await getBeaches({ timeoutMs: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('vuelve a pedir cuando la caché ha caducado', async () => {
    jest.useFakeTimers();
    const fetchMock = installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getBeaches } = await loadApi();

    await getBeaches({ timeoutMs: 50 });
    jest.advanceTimersByTime(TTL_MS + 1);
    await getBeaches({ timeoutMs: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplica dos llamadas concurrentes en una sola petición', async () => {
    const fetchMock = installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 10 })]);
    const { getBeaches } = await loadApi();

    const [a, b] = await Promise.all([
      getBeaches({ timeoutMs: 500 }),
      getBeaches({ timeoutMs: 500 }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(beachesResponse);
    expect(b).toEqual(beachesResponse);
  });
});
