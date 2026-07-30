/**
 * KNOWN ISSUE — this file pins down behaviour that WE WANT TO CHANGE.
 *
 * The backend emits the `'Negra'` flag (`CruzRojaDTO.bandera` includes it in its
 * union), but the frontend does not account for it anywhere:
 *
 *   - `flagColorClass` (beachHelpers.ts:46) only recognises red/yellow/green
 *     → returns 'unknown'
 *   - `isFlagAvailable` (beachHelpers.ts:54) returns false
 *     → `estadoBandera` yields 'sinDatos' and the banner is NOT rendered
 *   - `claveBandera` (apiText.ts:234) falls back to 'bandera.sinDatos'
 *   - the `bandera.negra` key does not exist in either `es.ts` or `en.ts`
 *
 * In other words: the MOST serious signal of all (swimming forbidden) is shown
 * the same as "we have no data". The app's own text contradicts it: the score
 * help says "roja o negra hunden la nota" (`detalle.scoreInfo.bandera`).
 *
 * Fix planned in F5f: add `bandera.negra`, extend `FlagColor` with 'black' and
 * render it. This file gets inverted in that same commit.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import { es } from '../../../i18n/es';
import PlayaDetallePage from '../../../pages/PlayaDetalle';
import { renderWithProviders } from '../../render';
import { installFetchMock, restoreFetch, route } from '../../http/fakeFetch';
import { featuredResponse } from '../../fixtures/featured';
import { buildBlackFlagDetail } from '../../fixtures/beachDetail';

const FEATURED = '/api/beaches/featured';
const DETAILS = /\/api\/beaches\/[^/]+\/details$/;

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

it('no existe una clave de traducción para la bandera negra', () => {
  expect(Object.keys(es)).not.toContain('bandera.negra');
});

it('la bandera negra no pinta banner: se comporta como "sin datos"', async () => {
  const { container } = renderWithProviders(<PlayaDetallePage />, {
    route: '/playas/3906002',
    path: '/playas/:codigo',
  });
  await screen.findByText('Langre');

  // The correct thing would be a black banner with a prohibition notice.
  expect(screen.queryByText('Estado para bañarse (según Cruz Roja)')).not.toBeInTheDocument();
  expect(container.querySelector('.flag-pennant')).toBeNull();
});

it('la tarjeta de Cruz Roja dice "Información aún no disponible" con bandera negra', async () => {
  renderWithProviders(<PlayaDetallePage />, {
    route: '/playas/3906002',
    path: '/playas/:codigo',
  });
  await screen.findByText('Cruz Roja');

  expect(screen.getByText('Información de Cruz Roja aún no disponible')).toBeInTheDocument();
  // The "Negra" value arrived from the backend and is discarded along the way.
  expect(screen.queryByText('Negra')).not.toBeInTheDocument();
});
