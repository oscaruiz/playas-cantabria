/**
 * Local copy of the last REAL listing from the backend.
 *
 * `data/beaches.json` is a snapshot taken at build time, so yesterday's backend
 * response is always a better fallback. It matters above all with the backend
 * asleep: Render free puts the process to sleep after 15 min and takes tens of
 * seconds to wake up, well above the 2.5 s timeout.
 */

import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';

const BEACHES = /\/api\/beaches$/;
const CLAVE = 'playas:ultimoListado';

async function loadApi() {
  jest.resetModules();
  return import('../../services/api');
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  restoreFetch();
  localStorage.clear();
  jest.useRealTimers();
});

describe('getPlayas — persistencia del último listado', () => {
  it('guarda la respuesta del backend para futuras visitas', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getPlayas } = await loadApi();

    await getPlayas({ timeoutMs: 50 });

    const guardado = JSON.parse(localStorage.getItem(CLAVE) as string);
    expect(guardado.playas).toEqual(beachesResponse);
    expect(typeof guardado.guardadoEn).toBe('number');
  });

  it('sirve la copia guardada, en vez del JSON del build, cuando el backend no responde', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const primeraVisita = await loadApi();
    await primeraVisita.getPlayas({ timeoutMs: 50 });

    // Second visit with the backend down: same storage, new module.
    restoreFetch();
    installFetchMock([route(BEACHES, { networkError: true })]);
    const segundaVisita = await loadApi();

    const resultado = await segundaVisita.getPlayas({ timeoutMs: 50 });

    expect(resultado).toEqual(beachesResponse);
  });

  it('descarta la copia si tiene más de un día y vuelve al JSON del build', async () => {
    const haceDosDias = Date.now() - 48 * 60 * 60 * 1000;
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ guardadoEn: haceDosDias, playas: beachesResponse }),
    );
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getPlayas } = await loadApi();

    const resultado = await getPlayas({ timeoutMs: 50 });

    expect(resultado).toHaveLength(46);
  });

  it('ignora una copia corrupta sin romper la carga', async () => {
    localStorage.setItem(CLAVE, 'esto no es JSON');
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getPlayas } = await loadApi();

    await expect(getPlayas({ timeoutMs: 50 })).resolves.toHaveLength(46);
  });

  it('no guarda una respuesta vacía: dejaría a la app sin fallback útil', async () => {
    installFetchMock([route(BEACHES, { json: [] })]);
    const { getPlayas } = await loadApi();

    await getPlayas({ timeoutMs: 50 });

    expect(localStorage.getItem(CLAVE)).toBeNull();
  });
});
