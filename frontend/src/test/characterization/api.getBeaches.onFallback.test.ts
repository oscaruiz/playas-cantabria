/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Fija el callback `onFallback` de `getPlayas()`, que es la señal de "esto que
 * te devuelvo NO viene del backend". Va en un fichero aparte de
 * `api.getBeaches.test.ts` para que aquel siga intacto: la firma pública y el
 * valor resuelto no cambian, `onFallback` es puramente aditivo.
 *
 * Lo que importa es la asimetría entre los dos caminos que sirven datos locales:
 *  - por TIMEOUT, el backend todavía puede llegar → `onBackendData` retira el aviso
 *  - por FALLO de la petición, no llegará nunca → el aviso se queda
 */

import { waitFor } from '@testing-library/react';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';

const BEACHES = /\/api\/beaches$/;

async function loadApi() {
  jest.resetModules();
  return import('../../services/api');
}

afterEach(() => {
  restoreFetch();
  jest.dontMock('../../data/beaches.json');
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

    expect(result).toHaveLength(46);
    expect(onFallback).toHaveBeenCalledTimes(1);
    // El aviso se emite ANTES de que llegue el backend.
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

    expect(result).toHaveLength(46);
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

    await expect(getPlayas({ timeoutMs: 500 })).resolves.toHaveLength(46);
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
