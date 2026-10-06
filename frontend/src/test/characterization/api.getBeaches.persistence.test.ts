/**
 * Local copy of the last REAL listing from the backend.
 *
 * `data/beaches.json` is a snapshot taken at build time, so yesterday's backend
 * response is always a better fallback. It matters above all with the backend
 * asleep: Render free puts the process to sleep after 15 min and takes tens of
 * seconds to wake up, well above the 2.5 s timeout.
 */

import { installFetchMock, restoreFetch, route } from '../../../../../../Dev/playas-cantabria/frontend/src/test/http/fakeFetch';
import { beachesResponse } from '../../../../../../Dev/playas-cantabria/frontend/src/test/fixtures/beaches';
import { BEACHES_PATH as BEACHES } from '../../../../../../Dev/playas-cantabria/frontend/src/test/apiRoutes';
import { LOCAL_CATALOG_SIZE } from '../../../../../../Dev/playas-cantabria/frontend/src/test/localCatalog';

const KEY = 'playas:ultimoListado';

async function loadApi() {
  jest.resetModules();
  return import('../../../../../../Dev/playas-cantabria/frontend/src/services/api');
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
    const { getBeaches } = await loadApi();

    await getBeaches({ timeoutMs: 50 });

    const saved = JSON.parse(localStorage.getItem(KEY) as string);
    expect(saved.playas).toEqual(beachesResponse);
    expect(typeof saved.guardadoEn).toBe('number');
  });

  it('sirve la copia guardada, en vez del JSON del build, cuando el backend no responde', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const firstVisit = await loadApi();
    await firstVisit.getBeaches({ timeoutMs: 50 });

    // Second visit with the backend down: same storage, new module.
    restoreFetch();
    installFetchMock([route(BEACHES, { networkError: true })]);
    const secondVisit = await loadApi();

    const result = await secondVisit.getBeaches({ timeoutMs: 50 });

    expect(result).toEqual(beachesResponse);
  });

  it('descarta la copia si tiene más de un día y vuelve al JSON del build', async () => {
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    localStorage.setItem(
      KEY,
      JSON.stringify({ guardadoEn: twoDaysAgo, playas: beachesResponse }),
    );
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getBeaches } = await loadApi();

    const result = await getBeaches({ timeoutMs: 50 });

    expect(result).toHaveLength(LOCAL_CATALOG_SIZE);
  });

  it('ignora una copia corrupta sin romper la carga', async () => {
    localStorage.setItem(KEY, 'esto no es JSON');
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getBeaches } = await loadApi();

    await expect(getBeaches({ timeoutMs: 50 })).resolves.toHaveLength(LOCAL_CATALOG_SIZE);
  });

  it('no guarda una respuesta vacía: dejaría a la app sin fallback útil', async () => {
    installFetchMock([route(BEACHES, { json: [] })]);
    const { getBeaches } = await loadApi();

    await getBeaches({ timeoutMs: 50 });

    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
