/**
 * CHARACTERIZATION — FROZEN.
 *
 * The hero's "priorizada por cercanía" note and the alternative's ⭐ "mejor
 * puntuación" chip are the same editorial signal: they light up together when
 * the beach that presides is NOT the one with the highest raw score, so as not
 * to make it look like the score shown is the best available one.
 *
 * It goes in its own file with its own fixture because with Cantabria's real
 * geography the case does not occur (see `featuredProximityResponse`).
 */

import React from 'react';
import { screen } from '@testing-library/react';
import HomePage from '../../pages/HomePage';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredProximityResponse } from '../fixtures/featured';
import { RUTA_DESTACADAS as FEATURED, RUTA_PLAYAS as BEACHES } from '../apiRoutes';


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
  // We wait for the heading, which also confirms that there is already a
  // location: beach names appear twice (hero/alternative and "Cerca de ti").
  await screen.findByText('La mejor para ti hoy');

  // Cercana: 70 - 0 = 70 adjusted. Lejana: 90 - 25 (cap) = 65 adjusted.
  expect(container.querySelector('#hp-hero-nombre')).toHaveTextContent('Cercana');
  expect(container.querySelector('.hp-hero-score-num')).toHaveTextContent('70');

  // The two signals appear at the same time.
  expect(screen.getByText(/Priorizada por cercanía/)).toBeInTheDocument();
  const chip = container.querySelector('.hp-alt-chip-mejor');
  expect(chip).toHaveTextContent('Mejor puntuación');

  // And the chip is in the Lejana row, not in another one.
  const filaLejana = container.querySelector('.hp-alt-row') as HTMLElement;
  expect(filaLejana).toHaveTextContent('Lejana');
  expect(filaLejana.querySelector('.hp-alt-chip-mejor')).not.toBeNull();
});
