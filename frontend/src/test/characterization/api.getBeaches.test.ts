/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Fija el comportamiento ACTUAL de `getPlayas()`: la carrera de 2,5 s contra el
 * JSON local, la caché de 5 min, la deduplicación de peticiones en vuelo y la
 * garantía de que NUNCA rechaza.
 *
 * Está escrito contra la firma pública (`getPlayas(options)`) a propósito: en F2
 * la implementación se muda a `core/application/use-cases/getBeaches.ts` y
 * `services/api.ts` queda como shim, y este fichero debe seguir pasando SIN
 * TOCARLO. Si hay que editarlo, es que el refactor cambió comportamiento.
 *
 * Cada test recarga el módulo (`jest.resetModules()`) porque `services/api.ts`
 * guarda la caché y las peticiones en vuelo en variables de módulo. Esa
 * necesidad es, en sí misma, la documentación del problema que F2 arregla.
 */

import { waitFor } from '@testing-library/react';
import { installFetchMock, restoreFetch, route, flushMicrotasks } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';

/** Solo `/api/beaches`, sin capturar `/api/beaches/featured` ni los detalles. */
const BEACHES = /\/api\/beaches$/;

const TTL_MS = 5 * 60 * 1000;

async function loadApi() {
  jest.resetModules();
  return import('../../services/api');
}

// Aislamiento entre tests: `getPlayas` guarda en localStorage el último listado
// REAL del backend y lo prefiere al JSON del build como fallback. Sin limpiar,
// el listado que deja un test contamina el fallback del siguiente. Lo que estos
// tests fijan es el camino "no hay copia guardada" → JSON del build; el camino
// con copia guardada vive en api.getBeaches.persistencia.test.ts.
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
    const { getPlayas } = await loadApi();
    const onBackendData = jest.fn();

    const result = await getPlayas({ timeoutMs: 50, onBackendData });

    expect(result).toEqual(beachesResponse);
    // Si el backend gana la carrera nadie ha visto datos de fallback, así que
    // no hay nada que "actualizar" y el callback no debe dispararse.
    expect(onBackendData).not.toHaveBeenCalled();
  });

  it('devuelve el JSON local cuando el backend tarda más que el timeout', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 200 })]);
    const { getPlayas } = await loadApi();
    const onBackendData = jest.fn();

    const result = await getPlayas({ timeoutMs: 20, onBackendData });

    // El fallback es `src/data/beaches.json` entero, no el fixture.
    expect(result).toHaveLength(46);
    expect(result[0]).toHaveProperty('codigo');
  });

  it('avisa por `onBackendData` exactamente una vez cuando el backend llega tarde', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 100 })]);
    const { getPlayas } = await loadApi();
    const onBackendData = jest.fn();

    await getPlayas({ timeoutMs: 20, onBackendData });

    await waitFor(() => expect(onBackendData).toHaveBeenCalledTimes(1));
    expect(onBackendData).toHaveBeenCalledWith(beachesResponse);
  });

  it('usa 2500 ms como timeout por defecto', async () => {
    jest.useFakeTimers();
    // El backend no contesta nunca dentro de la ventana observada.
    installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 60_000 })]);
    const { getPlayas } = await loadApi();

    let resolved: unknown = null;
    const pending = getPlayas().then((value) => {
      resolved = value;
    });

    jest.advanceTimersByTime(2499);
    await flushMicrotasks();
    expect(resolved).toBeNull();

    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    await pending;

    expect(resolved).toHaveLength(46);
  });
});

describe('getPlayas — nunca rechaza', () => {
  it('cae al JSON local si el backend responde 500', async () => {
    installFetchMock([route(BEACHES, { status: 500 })]);
    const { getPlayas } = await loadApi();

    await expect(getPlayas({ timeoutMs: 50 })).resolves.toHaveLength(46);
  });

  it('cae al JSON local si falla la red', async () => {
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getPlayas } = await loadApi();

    await expect(getPlayas({ timeoutMs: 50 })).resolves.toHaveLength(46);
  });
});

describe('getPlayas — caché y deduplicación', () => {
  it('reutiliza la caché dentro de los 5 min (una sola petición)', async () => {
    jest.useFakeTimers();
    const fetchMock = installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getPlayas } = await loadApi();

    await getPlayas({ timeoutMs: 50 });
    await getPlayas({ timeoutMs: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('vuelve a pedir cuando la caché ha caducado', async () => {
    jest.useFakeTimers();
    const fetchMock = installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getPlayas } = await loadApi();

    await getPlayas({ timeoutMs: 50 });
    jest.advanceTimersByTime(TTL_MS + 1);
    await getPlayas({ timeoutMs: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplica dos llamadas concurrentes en una sola petición', async () => {
    const fetchMock = installFetchMock([route(BEACHES, { json: beachesResponse, delayMs: 10 })]);
    const { getPlayas } = await loadApi();

    const [a, b] = await Promise.all([
      getPlayas({ timeoutMs: 500 }),
      getPlayas({ timeoutMs: 500 }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(beachesResponse);
    expect(b).toEqual(beachesResponse);
  });
});
