/**
 * CHARACTERIZATION — FROZEN.
 *
 * Case where no beach reaches the 60 point threshold: there is nothing to
 * preside over the home and the "sin destacadas" message shows up. Separate file
 * because it needs its own `/featured` payload and the cache is module-level.
 *
 * This test is the one that pins down that the "recomendada" threshold is 60 and
 * not 59: the fixture includes a beach with 59 and the section still comes out
 * empty.
 */

import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { Route } from 'react-router-dom';
import type { FeaturedBeachesResponse } from '../../services/api';
import HomePage from '../../pages/HomePage';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredLaSalve, featuredBerria, featuredSomo } from '../fixtures/featured';
import { RUTA_DESTACADAS as FEATURED, RUTA_PLAYAS as BEACHES } from '../apiRoutes';


/** The best one scores 59: just below the cut. */
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
  // The "revisar" section is rendered: it does not depend on the threshold.
  expect(screen.getByText('Mejor revisar antes de ir')).toBeInTheDocument();
});

it('el aviso de "sin destacadas" lleva un botón al listado completo', async () => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  installFetchMock([
    route(FEATURED, { json: sinDestacadas }),
    route(BEACHES, { json: beachesResponse }),
  ]);

  renderWithProviders(
    <>
      <HomePage />
      <Route path="/playas" render={() => <div>EN-LISTADO</div>} />
    </>,
    { route: '/' },
  );

  const boton = await screen.findByRole('button', { name: 'Ver listado de playas' });
  fireEvent.click(boton);

  expect(await screen.findByText('EN-LISTADO')).toBeInTheDocument();
});
