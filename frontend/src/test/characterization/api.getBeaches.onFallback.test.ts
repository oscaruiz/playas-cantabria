/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down the `onFallback` callback of `getPlayas()`, which is the signal for
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
import { RUTA_PLAYAS as BEACHES } from '../apiRoutes';


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

describe('getPlayas — señal de datos locales', () => {
  it('no avisa cuando el backend gana la carrera', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getPlayas } = await loadApi();
    const onFallback = jest.fn();

    await getPlayas({ timeoutMs: 50, onFallback });

    expect(onFallback).not.toHaveBeenCalled();
  });

  it('avisa una vez cuando salta el timeout, y luego llega el backend', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 100 })]);
    const { getPlayas } = await loadApi();
    const onFallback = jest.fn();
    const onBackendData = jest.fn();

    const result = await getPlayas({ timeoutMs: 20, onFallback, onBackendData });

    expect(result).toHaveLength(47);
    expect(onFallback).toHaveBeenCalledTimes(1);
    // The notice is emitted BEFORE the backend arrives.
    expect(onBackendData).not.toHaveBeenCalled();

    await waitFor(() => expect(onBackendData).toHaveBeenCalledTimes(1));
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('avisa una vez cuando falla la petición, y el backend ya no llega', async () => {
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getPlayas } = await loadApi();
    const onFallback = jest.fn();
    const onBackendData = jest.fn();

    const result = await getPlayas({ timeoutMs: 500, onFallback, onBackendData });

    expect(result).toHaveLength(47);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onBackendData).not.toHaveBeenCalled();
  });

  it('avisa también con un 500 del backend', async () => {
    installFetchMock([route(BEACHES, { status: 500 })]);
    const { getPlayas } = await loadApi();
    const onFallback = jest.fn();

    await getPlayas({ timeoutMs: 500, onFallback });

    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('sigue funcionando sin pasar el callback', async () => {
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getPlayas } = await loadApi();

    await expect(getPlayas({ timeoutMs: 500 })).resolves.toHaveLength(47);
  });

  it('resuelve vacío y avisa si tampoco se puede cargar la copia local', async () => {
    jest.doMock('../../data/beaches.json', () => {
      throw new Error('chunk local no disponible');
    });
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getPlayas } = await loadApi();
    const onFallback = jest.fn();
    const onFallbackUnavailable = jest.fn();

    await expect(
      getPlayas({ timeoutMs: 500, onFallback, onFallbackUnavailable }),
    ).resolves.toEqual([]);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallbackUnavailable).toHaveBeenCalledTimes(1);
  });
});
