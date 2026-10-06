/**
 * Which of two rankings is the one IN FORCE.
 *
 * There are two writers of the module cache racing: the request the app has in
 * flight, and the body the service worker hands over when the response it had
 * given up on finally lands. They can finish in either order, and whoever wrote
 * last used to win — so a request resolved with the worker's stored copy could
 * put the superseded ranking back on top of the one just delivered.
 *
 * These cases used to be written through the hook that relayed the worker's
 * message. The rule is not the hook's: it lives in `services/api`, and this is
 * where it is asked about — no React, no fake service worker.
 */

import { installFetchMock, restoreFetch, route } from '../../../../../Dev/playas-cantabria/frontend/src/test/http/fakeFetch';
import { FEATURED_PATH as FEATURED } from '../../../../../Dev/playas-cantabria/frontend/src/test/apiRoutes';
import type { FeaturedBeachesResponse } from '../../../../../Dev/playas-cantabria/frontend/src/services/api';

async function loadApiModule() {
  jest.resetModules();
  return import('../../../../../Dev/playas-cantabria/frontend/src/services/api');
}

afterEach(() => restoreFetch());

function ranking(
  timestamp: number,
  sky: string,
  servedAt?: number,
): FeaturedBeachesResponse {
  return {
    timestamp,
    servidoEn: servedAt,
    playas: [],
    revisar: [],
    resumenTodas: [{ codigo: '1', descripcionClima: sky }],
  } as unknown as FeaturedBeachesResponse;
}

describe('el ranking en vigor', () => {
  it('sustituye al anterior en la caché que leen todas las pantallas', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'no debería pedirse') })]);
    const { applyFreshFeatured, getFeaturedBeaches } = await loadApiModule();

    applyFreshFeatured(ranking(2000, 'nubes'));
    const newValue = ranking(2001, 'cielo claro');
    applyFreshFeatured(newValue);

    // Escribir solo en una caché VACÍA habría pasado antes del arreglo: lo que
    // el mapa releía al volver a la pestaña seguía siendo el cielo viejo.
    await expect(getFeaturedBeaches()).resolves.toEqual(newValue);
  });

  it('no deja que un cuerpo atrasado pise el ranking ya servido', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'no debería pedirse') })]);
    const { applyFreshFeatured, getFeaturedBeaches } = await loadApiModule();

    const newValue = ranking(3001, 'cielo claro');
    applyFreshFeatured(newValue);

    // Lo que se devuelve es lo que queda EN VIGOR, no lo que trae la llamada:
    // pintar el cuerpo descartado sería el parpadeo hacia atrás.
    expect(applyFreshFeatured(ranking(3000, 'nubes'))).toEqual(newValue);
    await expect(getFeaturedBeaches()).resolves.toEqual(newValue);
  });

  it('no deja que una petición en vuelo deshaga el cuerpo ya aplicado', async () => {
    let resolver: (r: unknown) => void = () => undefined;
    global.fetch = jest.fn(
      () => new Promise((r) => { resolver = r; }),
    ) as unknown as typeof fetch;
    const { applyFreshFeatured, getFeaturedBeaches } = await loadApiModule();

    // La ventana por la que viaja la copia del worker: la petición se resolvió
    // con el cuerpo VIEJO y aterriza después.
    applyFreshFeatured(ranking(4000, 'nubes'));
    const inFlight = getFeaturedBeaches({ force: true });
    const newValue = ranking(4002, 'cielo claro');
    applyFreshFeatured(newValue);
    resolver({ ok: true, json: async () => ranking(4001, 'nubes') });

    await expect(inFlight).resolves.toEqual(newValue);
    await expect(getFeaturedBeaches()).resolves.toEqual(newValue);
  });

  it('con el mismo ranking, gana el que juzgó las banderas más tarde', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'no debería pedirse') })]);
    const { applyFreshFeatured, getFeaturedBeaches } = await loadApiModule();

    // El mismo ranking ensamblado, servido dos veces. La lectura posterior es la
    // que ya vio caducar la bandera: dejar ganar a la anterior devolvería una
    // bandera de socorrista a una playa cuya lectura había expirado.
    const afternoon = ranking(6000, 'sin bandera', 6_500_000);
    applyFreshFeatured(afternoon);
    applyFreshFeatured(ranking(6000, 'bandera verde', 6_000_000));

    await expect(getFeaturedBeaches()).resolves.toEqual(afternoon);
  });
});
