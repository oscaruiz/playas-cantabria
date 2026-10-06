/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down `getBeachDetail()`. What matters here is what it does NOT do:
 * unlike `getBeaches`, it has no timeout, no local fallback and no cache, and it
 * DOES reject when the backend answers badly. With a cold Render that means an
 * indefinite spinner on `/playas/:codigo`.
 *
 * Adding a timeout or a fallback here would be a behaviour change, not a
 * refactor: it is noted down as a flagged F5 fix, with its own commit.
 */

import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { buildAemetDetail } from '../fixtures/beachDetail';
import { localNoon } from '../time';
import { DETAIL_PATH as DETAILS } from '../apiRoutes';
import { REGION_API_PATH } from '../../shared/config/region';


async function loadApi() {
  jest.resetModules();
  return import('../../services/api');
}

afterEach(() => {
  restoreFetch();
});

describe('getBeachDetail', () => {
  it('requests /api/{region}/beaches/{codigo}/details and returns the body as is', async () => {
    const detail = buildAemetDetail(localNoon('2026-07-27'));
    const fetchMock = installFetchMock([route(DETAILS, { json: detail })]);
    const { getBeachDetail } = await loadApi();

    const result = await getBeachDetail('3908503');

    expect(result).toEqual(detail);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`${REGION_API_PATH}/beaches/3908503/details`);
  });

  it('rejects when the response is not ok', async () => {
    installFetchMock([route(DETAILS, { status: 500 })]);
    const { getBeachDetail } = await loadApi();

    await expect(getBeachDetail('3908503')).rejects.toThrow(
      'No se pudo cargar el detalle de la playa',
    );
  });

  it('rejects when the network fails: there is no local fallback', async () => {
    installFetchMock([route(DETAILS, { networkError: 'offline' })]);
    const { getBeachDetail } = await loadApi();

    await expect(getBeachDetail('3908503')).rejects.toThrow();
  });

  it('does not cache: two consecutive calls make two requests', async () => {
    const detail = buildAemetDetail(localNoon('2026-07-27'));
    const fetchMock = installFetchMock([route(DETAILS, { json: detail })]);
    const { getBeachDetail } = await loadApi();

    await getBeachDetail('3908503');
    await getBeachDetail('3908503');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
