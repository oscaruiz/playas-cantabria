/**
 * The interface must be able to say three different things about the flag:
 * which one is flying, that there is no reading right now, and that HERE THERE
 * IS NO flag service at all. The third one did not exist: everything was
 * labelled "Cruz Roja", which for a region with another operator — or none —
 * meant naming a service that does not cover the beach.
 *
 * The discriminator is `fuenteBanderas` (backend, phase 3):
 *   name   → that operator watches the beach
 *   null   → nobody does
 *   ABSENT → the source does not report it (the local fallback catalog and the
 *            backend deployed before this): keep showing what was always shown.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import type { Beach, BeachDetail } from '../../services/api';
import { clearBeachDetailCacheForTests } from '../../services/api';
import BeachList from '../../pages/BeachList';
import BeachDetailPage from '../../pages/BeachDetailPage';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { buildAemetDetail } from '../fixtures/beachDetail';
import { localNoon } from '../time';
import { FEATURED_PATH as FEATURED, BEACHES_PATH as BEACHES, DETAIL_PATH as DETAILS } from '../apiRoutes';

const MIDDAY = localNoon('2026-07-27');

function badgeFor(name: string): Element | null {
  const card = Array.from(document.querySelectorAll('.beach-card')).find(
    (c) => c.querySelector('.beach-card-name')?.textContent === name,
  ) as HTMLElement | undefined;
  if (!card) throw new Error(`No hay tarjeta para ${name}`);
  return card.querySelector('.badge-lifeguarded');
}

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => {
  restoreFetch();
  jest.useRealTimers();
  // The detail is cached for 60 s in a module variable; each test brings its own.
  clearBeachDetailCacheForTests();
});

describe('the list names the operator the backend reports', () => {
  const withOtherOperator: Beach = {
    ...beachesResponse[0],
    nombre: 'Playa con otro operador',
    // Shape emitted for a non-Cruz Roja primary FlagRef: compatibility fields
    // cannot be what makes this badge appear.
    idCruzRoja: 0,
    cruzRojaStations: undefined,
    fuenteBanderas: 'DYA',
  };
  const noService: Beach = {
    ...beachesResponse[0],
    nombre: 'Playa sin servicio',
    codigo: '9999999',
    idCruzRoja: 0,
    cruzRojaStations: undefined,
    fuenteBanderas: null,
  };

  // A single render for both cases: `services/api.ts` caches the list for 5 min
  // in a module variable, so a second render would be served the first payload.
  beforeEach(async () => {
    installFetchMock([
      route(FEATURED, { json: featuredResponse }),
      route(BEACHES, { json: [withOtherOperator, noService] }),
    ]);
    renderWithProviders(<BeachList />, { route: '/playas' });
    await screen.findByText(withOtherOperator.nombre);
  });

  it('uses the region operator, not a fixed brand', () => {
    expect(badgeFor('Playa con otro operador')).toHaveTextContent('DYA');
  });

  it('does not mark as watched a beach nobody watches', () => {
    expect(badgeFor('Playa sin servicio')).toBeNull();
  });
});

describe('the detail attributes the bathing status to whoever watches', () => {
  function renderDetail(flagSource: BeachDetail['fuenteBanderas']) {
    const detail = { ...buildAemetDetail(MIDDAY), fuenteBanderas: flagSource };
    jest.useFakeTimers().setSystemTime(MIDDAY);
    installFetchMock([
      route(FEATURED, { json: featuredResponse }),
      route(DETAILS, { json: detail }),
    ]);
    return renderWithProviders(<BeachDetailPage />, {
      route: `/playas/${detail.codigo}`,
      path: '/playas/:codigo',
    });
  }

  it('names the operator watching the beach', async () => {
    renderDetail('DYA');
    expect(await screen.findByText('Estado para bañarse (según DYA)')).toBeInTheDocument();
  });

  it('without an operator it shows no flags section', async () => {
    const { container } = renderDetail(null);
    // Waits for the same content the previous test waits for, so the absence is
    // checked on a rendered page and not on one that had not painted yet.
    await screen.findByText('Cómo llegar');
    expect(screen.queryByText(/Estado para bañarse/)).not.toBeInTheDocument();
    expect(container.querySelector('.flag-banner')).toBeNull();
  });
});
