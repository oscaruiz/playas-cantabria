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
import type { Playa, PlayaDetalle } from '../../services/api';
import PlayasList from '../../pages/PlayasList';
import PlayaDetallePage from '../../pages/PlayaDetalle';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { buildAemetDetail } from '../fixtures/beachDetail';
import { localNoon } from '../time';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;
const DETAILS = /\/api\/beaches\/[^/]+\/details$/;
const MEDIODIA = localNoon('2026-07-27');

function badgeDe(nombre: string): Element | null {
  const card = Array.from(document.querySelectorAll('.beach-card')).find(
    (c) => c.querySelector('.beach-card-name')?.textContent === nombre,
  ) as HTMLElement | undefined;
  if (!card) throw new Error(`No hay tarjeta para ${nombre}`);
  return card.querySelector('.badge-vigilada');
}

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => {
  restoreFetch();
  jest.useRealTimers();
});

describe('el listado nombra al operador que informa el backend', () => {
  const conOtroOperador: Playa = {
    ...beachesResponse[0],
    nombre: 'Playa con otro operador',
    // Shape emitted for a non-Cruz Roja primary FlagRef: compatibility fields
    // cannot be what makes this badge appear.
    idCruzRoja: 0,
    cruzRojaStations: undefined,
    fuenteBanderas: 'DYA',
  };
  const sinServicio: Playa = {
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
      route(BEACHES, { json: [conOtroOperador, sinServicio] }),
    ]);
    renderWithProviders(<PlayasList />, { route: '/playas' });
    await screen.findByText(conOtroOperador.nombre);
  });

  it('usa el operador de la región, no una marca fija', () => {
    expect(badgeDe('Playa con otro operador')).toHaveTextContent('DYA');
  });

  it('no marca como vigilada una playa que nadie vigila', () => {
    expect(badgeDe('Playa sin servicio')).toBeNull();
  });
});

describe('el detalle atribuye el estado del baño a quien vigila', () => {
  function renderDetalle(fuenteBanderas: PlayaDetalle['fuenteBanderas']) {
    const detalle = { ...buildAemetDetail(MEDIODIA), fuenteBanderas };
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    installFetchMock([
      route(FEATURED, { json: featuredResponse }),
      route(DETAILS, { json: detalle }),
    ]);
    return renderWithProviders(<PlayaDetallePage />, {
      route: `/playas/${detalle.codigo}`,
      path: '/playas/:codigo',
    });
  }

  it('nombra al operador que vigila la playa', async () => {
    renderDetalle('DYA');
    expect(await screen.findByText('Estado para bañarse (según DYA)')).toBeInTheDocument();
  });

  it('sin operador no muestra la sección de banderas', async () => {
    const { container } = renderDetalle(null);
    // Waits for the same content the previous test waits for, so the absence is
    // checked on a rendered page and not on one that had not painted yet.
    await screen.findByText('Cómo llegar');
    expect(screen.queryByText(/Estado para bañarse/)).not.toBeInTheDocument();
    expect(container.querySelector('.flag-banner')).toBeNull();
  });
});
