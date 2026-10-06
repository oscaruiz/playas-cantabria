/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down the CURRENT behaviour of `getBeaches()`: the 2.5 s race against the
 * local JSON, the 5 min cache, the deduplication of in-flight requests and the
 * guarantee that it NEVER rejects.
 *
 * It is written against the public signature (`getBeaches(options)`) on purpose:
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

// Isolation between tests: `getBeaches` saves the last REAL backend listing in
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

describe('getBeaches — race against the local fallback', () => {
  it('returns the backend data when it responds before the timeout', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getBeaches } = await loadApi();
    const onBackendData = jest.fn();

    const result = await getBeaches({ timeoutMs: 50, onBackendData });

    expect(result).toEqual(beachesResponse);
    // If the backend wins the race nobody has seen fallback data, so there is
    // nothing to "update" and the callback must not fire.
    expect(onBackendData).not.toHaveBeenCalled();
  });

  it('returns the local JSON when the backend takes longer than the timeout', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 200 })]);
    const { getBeaches } = await loadApi();
    const onBackendData = jest.fn();

    const result = await getBeaches({ timeoutMs: 20, onBackendData });

    // The fallback is the whole `src/data/beaches.json`, not the fixture.
    expect(result).toHaveLength(LOCAL_CATALOG_SIZE);
    expect(result[0]).toHaveProperty('codigo');
  });

  it('notifies via `onBackendData` exactly once when the backend arrives late', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 100 })]);
    const { getBeaches } = await loadApi();
    const onBackendData = jest.fn();

    await getBeaches({ timeoutMs: 20, onBackendData });

    await waitFor(() => expect(onBackendData).toHaveBeenCalledTimes(1));
    expect(onBackendData).toHaveBeenCalledWith(beachesResponse);
  });

  it('uses 2500 ms as the default timeout', async () => {
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

describe('getBeaches — never rejects', () => {
  it('falls back to the local JSON if the backend answers 500', async () => {
    installFetchMock([route(BEACHES, { status: 500 })]);
    const { getBeaches } = await loadApi();

    await expect(getBeaches({ timeoutMs: 50 })).resolves.toHaveLength(LOCAL_CATALOG_SIZE);
  });

  it('falls back to the local JSON if the network fails', async () => {
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getBeaches } = await loadApi();

    await expect(getBeaches({ timeoutMs: 50 })).resolves.toHaveLength(LOCAL_CATALOG_SIZE);
  });
});

describe('getBeaches — cache and deduplication', () => {
  it('reuses the cache within 5 min (a single request)', async () => {
    jest.useFakeTimers();
    const fetchMock = installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getBeaches } = await loadApi();

    await getBeaches({ timeoutMs: 50 });
    await getBeaches({ timeoutMs: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requests again when the cache has expired', async () => {
    jest.useFakeTimers();
    const fetchMock = installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getBeaches } = await loadApi();

    await getBeaches({ timeoutMs: 50 });
    jest.advanceTimersByTime(TTL_MS + 1);
    await getBeaches({ timeoutMs: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplicates two concurrent calls into a single request', async () => {
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
