/**
 * PROBLEMA CONOCIDO — este fichero fija comportamiento que QUEREMOS CAMBIAR.
 *
 * El backend emite bandera `'Negra'` (`CruzRojaDTO.bandera` la incluye en su
 * unión), pero el frontend no la contempla en ningún sitio:
 *
 *   - `flagColorClass` (beachHelpers.ts:46) solo reconoce roja/amarilla/verde
 *     → devuelve 'unknown'
 *   - `isFlagAvailable` (beachHelpers.ts:54) devuelve false
 *     → `estadoBandera` da 'sinDatos' y el banner NO se pinta
 *   - `claveBandera` (apiText.ts:234) cae en 'bandera.sinDatos'
 *   - no existe la clave `bandera.negra` ni en `es.ts` ni en `en.ts`
 *
 * O sea: la señal MÁS grave de todas (prohibido el baño) se muestra igual que
 * "no tenemos datos". El propio texto de la app lo contradice: la ayuda de la
 * puntuación dice "roja o negra hunden la nota" (`detalle.scoreInfo.bandera`).
 *
 * Arreglo previsto en F5f: añadir `bandera.negra`, ampliar `FlagColor` con
 * 'black' y pintarla. Este fichero se invierte en ese mismo commit.
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

const AHORA = new Date('2026-07-27T12:00:00.000Z'); // 14:00 Madrid, en horario

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

  // Lo correcto sería un banner negro con aviso de prohibición.
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
  // El dato "Negra" llegó del backend y se descarta por el camino.
  expect(screen.queryByText('Negra')).not.toBeInTheDocument();
});
