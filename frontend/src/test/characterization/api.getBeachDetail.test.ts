/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Fija `getDetallePlaya()`. Lo importante aquí es lo que NO hace: a diferencia
 * de `getPlayas`, no tiene timeout, ni fallback local, ni caché, y SÍ rechaza
 * cuando el backend contesta mal. Con un Render frío eso significa un spinner
 * indefinido en `/playas/:codigo`.
 *
 * Añadir timeout o fallback aquí sería un cambio de comportamiento, no un
 * refactor: está apuntado como arreglo señalizado de F5, con su propio commit.
 */

import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { buildAemetDetail } from '../fixtures/beachDetail';
import { localNoon } from '../time';

const DETAILS = /\/api\/beaches\/[^/]+\/details$/;

async function loadApi() {
  jest.resetModules();
  return import('../../services/api');
}

afterEach(() => {
  restoreFetch();
});

describe('getDetallePlaya', () => {
  it('pide /api/beaches/{codigo}/details y devuelve el cuerpo tal cual', async () => {
    const detail = buildAemetDetail(localNoon('2026-07-27'));
    const fetchMock = installFetchMock([route(DETAILS, { json: detail })]);
    const { getDetallePlaya } = await loadApi();

    const result = await getDetallePlaya('3908503');

    expect(result).toEqual(detail);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/beaches/3908503/details');
  });

  it('rechaza cuando la respuesta no es ok', async () => {
    installFetchMock([route(DETAILS, { status: 500 })]);
    const { getDetallePlaya } = await loadApi();

    await expect(getDetallePlaya('3908503')).rejects.toThrow(
      'No se pudo cargar el detalle de la playa',
    );
  });

  it('rechaza cuando falla la red: no hay fallback local', async () => {
    installFetchMock([route(DETAILS, { networkError: 'offline' })]);
    const { getDetallePlaya } = await loadApi();

    await expect(getDetallePlaya('3908503')).rejects.toThrow();
  });

  it('no cachea: dos llamadas seguidas hacen dos peticiones', async () => {
    const detail = buildAemetDetail(localNoon('2026-07-27'));
    const fetchMock = installFetchMock([route(DETAILS, { json: detail })]);
    const { getDetallePlaya } = await loadApi();

    await getDetallePlaya('3908503');
    await getDetallePlaya('3908503');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
