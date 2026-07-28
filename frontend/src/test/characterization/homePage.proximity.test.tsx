/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * La nota "priorizada por cercanía" del hero y el chip ⭐ "mejor puntuación" de
 * la alternativa son la misma señal editorial: se encienden juntos cuando la
 * playa que preside NO es la de mayor puntuación cruda, para no aparentar que
 * la nota que se enseña es la mejor disponible.
 *
 * Va en su propio fichero con su propio fixture porque con la geografía real de
 * Cantabria el caso no se da (ver `featuredProximityResponse`).
 */

import React from 'react';
import { screen } from '@testing-library/react';
import HomePage from '../../pages/HomePage';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredProximityResponse } from '../fixtures/featured';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;

beforeEach(() => {
  localStorage.removeItem('user_location');
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success: (p: unknown) => void) =>
        success({ coords: { latitude: 43.42, longitude: -3.43 } }),
    },
  });
  installFetchMock([
    route(FEATURED, { json: featuredProximityResponse }),
    route(BEACHES, { json: beachesResponse }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

it('avisa cuando preside una playa cercana con menos puntos que otra mostrada', async () => {
  const { container } = renderWithProviders(<HomePage />, { route: '/' });
  // Se espera al encabezado, que además confirma que ya hay ubicación: los
  // nombres de playa aparecen dos veces (hero/alternativa y "Cerca de ti").
  await screen.findByText('La mejor para ti hoy');

  // Cercana: 70 - 0 = 70 ajustado. Lejana: 90 - 25 (tope) = 65 ajustado.
  expect(container.querySelector('#hp-hero-nombre')).toHaveTextContent('Cercana');
  expect(container.querySelector('.hp-hero-score-num')).toHaveTextContent('70');

  // Las dos señales aparecen a la vez.
  expect(screen.getByText(/Priorizada por cercanía/)).toBeInTheDocument();
  const chip = container.querySelector('.hp-alt-chip-mejor');
  expect(chip).toHaveTextContent('Mejor puntuación');

  // Y el chip está en la fila de Lejana, no en otra.
  const filaLejana = container.querySelector('.hp-alt-row') as HTMLElement;
  expect(filaLejana).toHaveTextContent('Lejana');
  expect(filaLejana.querySelector('.hp-alt-chip-mejor')).not.toBeNull();
});
