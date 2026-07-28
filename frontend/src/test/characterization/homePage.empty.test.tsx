/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Caso en que ninguna playa llega al umbral de 60 puntos: no hay nada que
 * presidir la home y sale el mensaje de "sin destacadas". Fichero aparte porque
 * necesita su propio payload de `/featured` y la caché es de módulo.
 *
 * Este test es el que fija que el umbral de "recomendada" es 60 y no 59: el
 * fixture incluye una playa con 59 y aun así la sección sale vacía.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import type { FeaturedBeachesResponse } from '../../services/api';
import HomePage from '../../pages/HomePage';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredLaSalve, featuredBerria, featuredSomo } from '../fixtures/featured';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;

/** La mejor puntúa 59: justo por debajo del corte. */
const sinDestacadas: FeaturedBeachesResponse = {
  timestamp: Date.parse('2026-07-27T10:00:00.000Z'),
  playas: [],
  revisar: [featuredBerria],
  resumenTodas: [featuredLaSalve, featuredBerria, featuredSomo],
};

afterEach(() => {
  restoreFetch();
});

it('muestra el aviso de "sin destacadas" cuando ninguna playa llega a 60', async () => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  installFetchMock([
    route(FEATURED, { json: sinDestacadas }),
    route(BEACHES, { json: beachesResponse }),
  ]);

  const { container } = renderWithProviders(<HomePage />, { route: '/' });

  await screen.findByText('Hoy no hay playas destacadas — consulta el listado completo');
  expect(container.querySelector('.hp-hero-card')).toBeNull();
  expect(container.querySelectorAll('.hp-alt-row')).toHaveLength(0);
  // La sección "revisar" sí se pinta: no depende del umbral.
  expect(screen.getByText('Mejor revisar antes de ir')).toBeInTheDocument();
});
