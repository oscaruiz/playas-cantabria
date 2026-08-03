/**
 * SAFETY — the black flag must never read as "no data".
 *
 * The backend emits `'Negra'` in `CruzRojaDTO.bandera`, and it is the most
 * serious signal of all: swimming forbidden. Until this was fixed, the frontend
 * dropped it at every step — `flagColorClass` returned 'unknown',
 * `isFlagAvailable` returned false so `estadoBandera` yielded 'sinDatos' and no
 * banner rendered, `claveBandera` fell back to 'bandera.sinDatos', and no
 * `bandera.negra` key existed in `es.ts`/`en.ts`. A swimmer saw the same screen
 * as a beach with no information.
 *
 * These tests guard the fix: the key exists, the banner paints with the black
 * pennant, and the value survives to the Cruz Roja card. This file was
 * previously in `known-issues/` pinning the broken behaviour; it now pins the
 * correct behaviour and must not be inverted again.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import { es } from '../../shared/i18n/es';
import PlayaDetallePage from '../../pages/PlayaDetalle';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { featuredResponse } from '../fixtures/featured';
import { buildBlackFlagDetail } from '../fixtures/beachDetail';
import { RUTA_DESTACADAS as FEATURED, RUTA_DETALLE as DETAILS } from '../apiRoutes';


const AHORA = new Date('2026-07-27T12:00:00.000Z'); // 14:00 Madrid, within opening hours

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(AHORA);
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(DETAILS, { json: buildBlackFlagDetail(AHORA) }),
  ]);
});

afterEach(() => {
  restoreFetch();
  jest.useRealTimers();
});

it('existe una clave de traducción para la bandera negra', () => {
  expect(Object.keys(es)).toContain('bandera.negra');
});

it('la bandera negra pinta el banner de prohibición', async () => {
  const { container } = renderWithProviders(<PlayaDetallePage />, {
    route: '/playas/3906002',
    path: '/playas/:codigo',
  });
  await screen.findByText('Langre');

  expect(screen.getByText('Estado para bañarse (según Cruz Roja)')).toBeInTheDocument();
  expect(screen.getByText('Bandera Negra')).toBeInTheDocument();
  expect(container.querySelector('.flag-pennant.black')).toBeInTheDocument();
});

it('la tarjeta de Cruz Roja conserva el valor negro recibido', async () => {
  renderWithProviders(<PlayaDetallePage />, {
    route: '/playas/3906002',
    path: '/playas/:codigo',
  });
  await screen.findByText('Cruz Roja', { selector: '.card-header-title' });

  expect(screen.queryByText('Información de Cruz Roja aún no disponible')).not.toBeInTheDocument();
  expect(screen.getByText('Negra')).toBeInTheDocument();
});
