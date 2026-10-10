/**
 * TODAY's headline is read as "now". A sky nobody observed says so: AEMET's
 * forecast standing in (`previsto`), or the half-day forecast below it, is
 * labelled; with no sky at all it says so instead of leaving a gap.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import BeachDetailPage from '../BeachDetailPage';
import type { BeachDetail } from '../../services/api';
import { clearBeachDetailCacheForTests } from '../../services/api';
import { renderWithProviders } from '../../test/render';
import { installFetchMock, restoreFetch, route } from '../../test/http/fakeFetch';
import { featuredResponse } from '../../test/fixtures/featured';
import { buildAemetDetail } from '../../test/fixtures/beachDetail';
import { localNoon } from '../../test/time';
import { FEATURED_PATH as FEATURED, DETAIL_PATH as DETAILS } from '../../test/apiRoutes';

const MIDDAY = localNoon('2026-07-27');

async function heroSky(detail: BeachDetail): Promise<string> {
  installFetchMock([route(FEATURED, { json: featuredResponse }), route(DETAILS, { json: detail })]);
  const { container } = renderWithProviders(<BeachDetailPage />, {
    route: '/playas/3908503',
    path: '/playas/:codigo',
  });
  await screen.findByText('Hoy');
  return container.querySelector('.forecast-hero-sky')?.textContent ?? '';
}

/** The fixture's today, checked once instead of asserted at every use. */
function today() {
  const base = buildAemetDetail(MIDDAY);
  const { tiempoActual: now, prediccionCompleta: pred } = base;
  if (!now || !pred) throw new Error('the AEMET fixture must carry today');
  return { base, now, pred };
}

beforeEach(() => jest.useFakeTimers().setSystemTime(MIDDAY));
afterEach(() => {
  restoreFetch();
  jest.useRealTimers();
  clearBeachDetailCacheForTests();
});

describe('ForecastHero sky for today', () => {
  it('an observed sky carries no label', async () => {
    expect(await heroSky(buildAemetDetail(MIDDAY))).not.toContain('previsto');
  });

  it("AEMET's forecast standing in for the sky now is labelled «previsto»", async () => {
    const { base, now } = today();
    const detail = { ...base, tiempoActual: { ...now, cielo: 'nuboso', fuente: 'AEMET' as const, previsto: true } };
    expect(await heroSky(detail)).toContain('previsto');
  });

  it('with no sky now, the half-day forecast below it is labelled too', async () => {
    const { base, now } = today();
    expect(await heroSky({ ...base, tiempoActual: { ...now, cielo: null } })).toContain('previsto');
  });

  it('with no sky anywhere, it says the sky is not available', async () => {
    const { base, now, pred } = today();
    const emptyDay = {
      ...pred.dias[0],
      manana: { ...pred.dias[0].manana, cielo: null },
      tarde: { ...pred.dias[0].tarde, cielo: null },
    };
    const detail = {
      ...base,
      tiempoActual: { ...now, cielo: null },
      prediccionCompleta: { ...pred, dias: [emptyDay, ...pred.dias.slice(1)] },
    };
    expect(await heroSky(detail)).toBe('Cielo no disponible');
  });
});
