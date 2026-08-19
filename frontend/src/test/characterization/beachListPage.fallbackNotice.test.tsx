/**
 * CHARACTERIZATION — FROZEN.
 *
 * The local data notice of `PlayasList`. It replaces the error state that
 * existed before and that was unreachable: `getPlayas` never rejects, so with
 * the backend down the user saw the full listing without any hint that it
 * was a build-time copy.
 *
 * Each test advances the clock by more than 5 min so that the module cache of
 * `services/api.ts` does not prevent exercising the declared HTTP route.
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import PlayasList from '../../pages/PlayasList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route, deferred, RouteSpec } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { RUTA_DESTACADAS as FEATURED, RUTA_PLAYAS as BEACHES } from '../apiRoutes';


const AVISO = 'Sin conexión: mostrando datos guardados, puede que estén desactualizados';
let ahora = Date.now();

beforeEach(() => {
  ahora += 5 * 60 * 1000 + 1;
  jest.spyOn(Date, 'now').mockReturnValue(ahora);
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => {
  restoreFetch();
  jest.restoreAllMocks();
});

it('avisa cuando el backend está caído, y sigue mostrando el listado', async () => {
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, { networkError: true }),
  ]);

  renderWithProviders(<PlayasList />, { route: '/playas' });

  await screen.findByText('49 playas');
  const aviso = screen.getByText(AVISO);
  expect(aviso).toBeInTheDocument();
  // `role="status"` so that screen readers announce it without stealing focus.
  expect(aviso.closest('[role="status"]')).not.toBeNull();
});

it('el aviso se traduce', async () => {
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, { networkError: true }),
  ]);

  renderWithProviders(<PlayasList />, { route: '/playas', idioma: 'en' });

  await screen.findByText('49 beaches');
  expect(
    screen.getByText('Offline: showing saved data, it may be out of date'),
  ).toBeInTheDocument();
});

it('el aviso desaparece si el backend acaba respondiendo', async () => {
  const tardio = deferred<RouteSpec>();
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, () => tardio.promise),
  ]);

  renderWithProviders(<PlayasList />, { route: '/playas' });

  // After the default 2.5 s the local JSON is served and the notice shows up.
  await screen.findByText('49 playas', undefined, { timeout: 4000 });
  expect(screen.getByText(AVISO)).toBeInTheDocument();

  // And when the backend finally answers, both data and notice are replaced.
  tardio.resolve({ json: beachesResponse });

  await waitFor(() => expect(screen.getByText('7 playas')).toBeInTheDocument());
  expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
}, 10000);

it('no avisa cuando el backend responde a tiempo', async () => {
  const fetchMock = installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(BEACHES, { json: beachesResponse }),
  ]);

  renderWithProviders(<PlayasList />, { route: '/playas' });

  await screen.findByText('7 playas');
  expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  expect(
    fetchMock.mock.calls.filter(([url]) => BEACHES.test(String(url))),
  ).toHaveLength(1);
});
