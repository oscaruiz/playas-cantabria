/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down the `onFallback` callback of `getBeaches()`, which is the signal for
 * "what I am returning to you does NOT come from the backend". It lives in a
 * file separate from `api.getBeaches.test.ts` so that the latter stays intact:
 * the public signature and the resolved value do not change, `onFallback` is
 * purely additive.
 *
 * What matters is the asymmetry between the two paths that serve local data:
 *  - by TIMEOUT, the backend can still arrive → `onBackendData` removes the notice
 *  - by request FAILURE, it will never arrive → the notice stays
 */

import { waitFor } from '@testing-library/react';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { BEACHES_PATH as BEACHES } from '../apiRoutes';
import { LOCAL_CATALOG_SIZE } from '../localCatalog';


async function loadApi() {
  jest.resetModules();
  return import('../../services/api');
}

// See the note in api.getBeaches.test.ts: the real listing that one test saves
// in localStorage would be the next one's fallback.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  restoreFetch();
  jest.dontMock('../../data/beaches.json');
  localStorage.clear();
});

describe('getBeaches — local data signal', () => {
  it('does not notify when the backend wins the race', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getBeaches } = await loadApi();
    const onFallback = jest.fn();

    await getBeaches({ timeoutMs: 50, onFallback });

    expect(onFallback).not.toHaveBeenCalled();
  });

  it('notifies once when the timeout fires, and then the backend arrives', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 100 })]);
    const { getBeaches } = await loadApi();
    const onFallback = jest.fn();
    const onBackendData = jest.fn();

    const result = await getBeaches({ timeoutMs: 20, onFallback, onBackendData });

    expect(result).toHaveLength(LOCAL_CATALOG_SIZE);
    expect(onFallback).toHaveBeenCalledTimes(1);
    // The notice is emitted BEFORE the backend arrives.
    expect(onBackendData).not.toHaveBeenCalled();

    await waitFor(() => expect(onBackendData).toHaveBeenCalledTimes(1));
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('notifies once when the request fails, and the backend never arrives', async () => {
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getBeaches } = await loadApi();
    const onFallback = jest.fn();
    const onBackendData = jest.fn();

    const result = await getBeaches({ timeoutMs: 500, onFallback, onBackendData });

    expect(result).toHaveLength(LOCAL_CATALOG_SIZE);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onBackendData).not.toHaveBeenCalled();
  });

  it('also notifies on a backend 500', async () => {
    installFetchMock([route(BEACHES, { status: 500 })]);
    const { getBeaches } = await loadApi();
    const onFallback = jest.fn();

    await getBeaches({ timeoutMs: 500, onFallback });

    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('keeps working without passing the callback', async () => {
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getBeaches } = await loadApi();

    await expect(getBeaches({ timeoutMs: 500 })).resolves.toHaveLength(LOCAL_CATALOG_SIZE);
  });

  it('resolves empty and notifies if the local copy cannot be loaded either', async () => {
    jest.doMock('../../data/beaches.json', () => {
      throw new Error('chunk local no disponible');
    });
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getBeaches } = await loadApi();
    const onFallback = jest.fn();
    const onFallbackUnavailable = jest.fn();

    await expect(
      getBeaches({ timeoutMs: 500, onFallback, onFallbackUnavailable }),
    ).resolves.toEqual([]);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallbackUnavailable).toHaveBeenCalledTimes(1);
  });
});
