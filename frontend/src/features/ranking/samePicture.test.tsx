/**
 * One picture per beach: the detail is built from a ranking generation and
 * says which (`rankingGeneradoEn`); the phone fetches again whichever of the
 * two it holds is older, so the card and the detail never disagree.
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { reconcile } from './samePicture';
import BeachDetailPage from '../../pages/BeachDetailPage';
import { renderWithProviders } from '../../test/render';
import { installFetchMock, restoreFetch, route } from '../../test/http/fakeFetch';
import { featuredResponse } from '../../test/fixtures/featured';
import { buildOpenWeatherDetail } from '../../test/fixtures/beachDetail';
import { clearBeachDetailCacheForTests } from '../../services/api';
import { FEATURED_PATH as FEATURED, DETAIL_PATH as DETAILS } from '../../test/apiRoutes';

const iso = (ms: number) => new Date(ms).toISOString();

describe('reconcile', () => {
  const PAINTED = Date.parse('2026-10-10T12:00:00Z');

  it('fetches the ranking again when the detail comes from a newer one', () => {
    expect(reconcile(iso(PAINTED + 1000), PAINTED)).toBe('ranking');
  });

  it('fetches the detail again when the painted ranking is newer, or the detail predates any ranking', () => {
    expect(reconcile(iso(PAINTED - 1000), PAINTED)).toBe('detail');
    expect(reconcile(null, PAINTED)).toBe('detail');
  });

  it('does nothing for the same picture, with no ranking yet, or with a backend that does not say', () => {
    expect(reconcile(iso(PAINTED), PAINTED)).toBe('none');
    expect(reconcile(iso(PAINTED), null)).toBe('none');
    expect(reconcile(undefined, PAINTED)).toBe('none');
  });
});

describe('BeachDetailPage keeps the detail and the ranking on one picture', () => {
  afterEach(() => {
    restoreFetch();
    clearBeachDetailCacheForTests();
  });

  const renderDetail = () =>
    renderWithProviders(<BeachDetailPage />, { route: '/playas/3908503', path: '/playas/:codigo' });

  it('asks for the detail again when it was built from an older ranking, once', async () => {
    // Fresh, so the ranking's own revalidation stays out of the way.
    const ranking = Date.now() - 60_000;
    let detailCalls = 0;
    installFetchMock([
      route(FEATURED, { json: { ...featuredResponse, timestamp: ranking } }),
      route(DETAILS, () => {
        detailCalls += 1;
        const detail = buildOpenWeatherDetail(new Date());
        return {
          json: {
            ...detail,
            rankingGeneradoEn: iso(detailCalls === 1 ? ranking - 10 * 60_000 : ranking),
          },
        };
      }),
    ]);

    renderDetail();

    await waitFor(() => expect(detailCalls).toBe(2));
    // Same picture now: nothing else goes out.
    await new Promise((r) => setTimeout(r, 50));
    expect(detailCalls).toBe(2);
    expect(screen.queryByText('No se pudo cargar el detalle de la playa')).not.toBeInTheDocument();
  });

  it('tries once, not in a loop, if the backend keeps answering with the older picture', async () => {
    const ranking = Date.now() - 50_000;
    let detailCalls = 0;
    installFetchMock([
      route(FEATURED, { json: { ...featuredResponse, timestamp: ranking } }),
      route(DETAILS, () => {
        detailCalls += 1;
        return { json: { ...buildOpenWeatherDetail(new Date()), rankingGeneradoEn: iso(ranking - 60_000) } };
      }),
    ]);

    renderDetail();

    await waitFor(() => expect(detailCalls).toBe(2));
    await new Promise((r) => setTimeout(r, 100));
    expect(detailCalls).toBe(2);
  });

  it('asks for the ranking again when the detail comes from a newer one', async () => {
    const newer = Date.now() - 30_000;
    let featuredCalls = 0;
    let detailCalls = 0;
    installFetchMock([
      route(FEATURED, () => {
        featuredCalls += 1;
        return { json: { ...featuredResponse, timestamp: newer } };
      }),
      route(DETAILS, () => {
        detailCalls += 1;
        return { json: { ...buildOpenWeatherDetail(new Date()), rankingGeneradoEn: iso(newer) } };
      }),
    ]);

    renderDetail();

    await waitFor(() => expect(featuredCalls).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 50));
    expect(detailCalls).toBe(1);
  });
});
