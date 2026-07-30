/**
 * CHARACTERIZATION — FROZEN.
 *
 * Loading, error and retry states of `HomePage`. Separate file because each test
 * needs a different response from `/featured` and the 5 min cache in
 * `services/api.ts` lives in module variables.
 *
 * TEST ORDER MATTERS, and that is precisely the debt F2 pays off: a successful
 * response fills the cache for the next 5 min, so the cases that need a failure
 * have to go BEFORE the only one that ends well. Once the cache is injectable,
 * this dependency disappears.
 *
 * Detail that gets pinned down: the error can only come from `/featured`. The
 * beach list (`getPlayas`) never rejects, so the counter is rendered all the
 * same even when the backend is down.
 */

import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import HomePage from '../../pages/HomePage';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route, deferred, RouteSpec } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;

beforeEach(() => {
  localStorage.removeItem('user_location');
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => {
  restoreFetch();
});

describe('HomePage — estados', () => {
  it('muestra el mensaje de búsqueda y da paso al error si falla', async () => {
    const pending = deferred<RouteSpec>();
    installFetchMock([
      route(FEATURED, () => pending.promise),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    expect(screen.getByText('Buscando las mejores playas cerca de ti...')).toBeInTheDocument();

    // The request is released: if it were left hanging, `featuredRequest` would
    // stay busy and contaminate the rest of the file. It is rejected (and not
    // resolved) so as not to fill the cache.
    pending.reject(new Error('backend caído'));

    await screen.findByText('No se pudieron cargar las condiciones actuales');
    expect(
      screen.queryByText('Buscando las mejores playas cerca de ti...'),
    ).not.toBeInTheDocument();
  });

  it('muestra el error de condiciones cuando /featured responde 500', async () => {
    installFetchMock([
      route(FEATURED, { status: 500 }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    await screen.findByText('No se pudieron cargar las condiciones actuales');
    expect(screen.getByText('Reintentar')).toBeInTheDocument();
    // The listing did arrive: the counter is rendered despite the featured error.
    expect(await screen.findByText('7 playas')).toBeInTheDocument();
  });

  it('el botón de reintentar vuelve a pedir y recupera la página', async () => {
    let intentos = 0;
    const fetchMock = installFetchMock([
      route(FEATURED, () => {
        intentos += 1;
        return intentos === 1 ? { status: 500 } : { json: featuredResponse };
      }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText('No se pudieron cargar las condiciones actuales');

    fireEvent.click(screen.getByText('Reintentar'));

    await screen.findByText('La Concha');
    expect(
      screen.queryByText('No se pudieron cargar las condiciones actuales'),
    ).not.toBeInTheDocument();

    const featuredCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes(FEATURED));
    expect(featuredCalls).toHaveLength(2);
  });
});
