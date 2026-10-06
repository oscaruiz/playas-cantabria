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
import { BEACHES_PATH as BEACHES } from '../apiRoutes';
import { LOCAL_CATALOG_SIZE } from '../localCatalog';

const KEY = 'playas:ultimoListado';

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

describe('getBeaches — persistence of the last listing', () => {
  it('saves the backend response for future visits', async () => {
    installFetchMock([route(BEACHES, { json: beachesResponse })]);
    const { getBeaches } = await loadApi();

    await getBeaches({ timeoutMs: 50 });

    const saved = JSON.parse(localStorage.getItem(KEY) as string);
    expect(saved.playas).toEqual(beachesResponse);
    expect(typeof saved.guardadoEn).toBe('number');
  });

  it('serves the saved copy, instead of the build JSON, when the backend does not respond', async () => {
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

  it('discards the copy if it is more than a day old and goes back to the build JSON', async () => {
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

  it('ignores a corrupt copy without breaking the load', async () => {
    localStorage.setItem(KEY, 'esto no es JSON');
    installFetchMock([route(BEACHES, { networkError: true })]);
    const { getBeaches } = await loadApi();

    await expect(getBeaches({ timeoutMs: 50 })).resolves.toHaveLength(LOCAL_CATALOG_SIZE);
  });

  it('does not save an empty response: it would leave the app with no useful fallback', async () => {
    installFetchMock([route(BEACHES, { json: [] })]);
    const { getBeaches } = await loadApi();

    await getBeaches({ timeoutMs: 50 });

    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
