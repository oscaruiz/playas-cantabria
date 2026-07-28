/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * El aviso de datos locales de `PlayasList`. Sustituye al estado de error que
 * existía antes y que era inalcanzable: `getPlayas` nunca rechaza, así que con
 * el backend caído el usuario veía el listado completo sin ninguna pista de que
 * era una copia de build-time.
 *
 * Cada test avanza el reloj más de 5 min para que la caché de módulo de
 * `services/api.ts` no impida ejercitar la ruta HTTP declarada.
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import PlayasList from '../../pages/PlayasList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route, deferred, RouteSpec } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;

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

  await screen.findByText('46 playas');
  const aviso = screen.getByText(AVISO);
  expect(aviso).toBeInTheDocument();
  // `role="status"` para que los lectores de pantalla lo anuncien sin robar foco.
  expect(aviso.closest('[role="status"]')).not.toBeNull();
});

it('el aviso se traduce', async () => {
  installFetchMock([
    route(FEATURED, { networkError: true }),
    route(BEACHES, { networkError: true }),
  ]);

  renderWithProviders(<PlayasList />, { route: '/playas', idioma: 'en' });

  await screen.findByText('46 beaches');
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

  // Pasados los 2,5 s por defecto se sirve el JSON local y sale el aviso.
  await screen.findByText('46 playas', undefined, { timeout: 4000 });
  expect(screen.getByText(AVISO)).toBeInTheDocument();

  // Y cuando por fin contesta el backend, se sustituyen datos y aviso.
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
