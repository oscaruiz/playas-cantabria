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

import { installFetchMock, restoreFetch, route } from './http/fakeFetch';
import { FEATURED_PATH as FEATURED } from './apiRoutes';
import type { FeaturedBeachesResponse } from '../services/api';

async function loadApiModule() {
  jest.resetModules();
  return import('../services/api');
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

describe('the ranking in force', () => {
  it('replaces the previous one in the cache every screen reads', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'no debería pedirse') })]);
    const { applyFreshFeatured, getFeaturedBeaches } = await loadApiModule();

    applyFreshFeatured(ranking(2000, 'nubes'));
    const newValue = ranking(2001, 'cielo claro');
    applyFreshFeatured(newValue);

    // Writing only to an EMPTY cache would have passed before the fix: what the
    // map re-read on returning to the tab was still the old sky.
    await expect(getFeaturedBeaches()).resolves.toEqual(newValue);
  });

  it('does not let a stale body overwrite the ranking already served', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'no debería pedirse') })]);
    const { applyFreshFeatured, getFeaturedBeaches } = await loadApiModule();

    const newValue = ranking(3001, 'cielo claro');
    applyFreshFeatured(newValue);

    // What is returned is what remains IN FORCE, not what the call brings:
    // painting the discarded body would be the flicker backwards.
    expect(applyFreshFeatured(ranking(3000, 'nubes'))).toEqual(newValue);
    await expect(getFeaturedBeaches()).resolves.toEqual(newValue);
  });

  it('does not let an in-flight request undo the body already applied', async () => {
    let resolver: (r: unknown) => void = () => undefined;
    global.fetch = jest.fn(
      () => new Promise((r) => { resolver = r; }),
    ) as unknown as typeof fetch;
    const { applyFreshFeatured, getFeaturedBeaches } = await loadApiModule();

    // The window the worker's copy travels through: the request resolved with
    // the OLD body and lands afterwards.
    applyFreshFeatured(ranking(4000, 'nubes'));
    const inFlight = getFeaturedBeaches({ force: true });
    const newValue = ranking(4002, 'cielo claro');
    applyFreshFeatured(newValue);
    resolver({ ok: true, json: async () => ranking(4001, 'nubes') });

    await expect(inFlight).resolves.toEqual(newValue);
    await expect(getFeaturedBeaches()).resolves.toEqual(newValue);
  });

  it('with the same ranking, the one that judged the flags later wins', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'no debería pedirse') })]);
    const { applyFreshFeatured, getFeaturedBeaches } = await loadApiModule();

    // The same assembled ranking, served twice. The later reading is the one that
    // already saw the flag expire: letting the earlier one win would hand a
    // lifeguard flag back to a beach whose reading had expired.
    const afternoon = ranking(6000, 'sin bandera', 6_500_000);
    applyFreshFeatured(afternoon);
    applyFreshFeatured(ranking(6000, 'bandera verde', 6_000_000));

    await expect(getFeaturedBeaches()).resolves.toEqual(afternoon);
  });
});
