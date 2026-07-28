/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Estados de carga, error y reintento de `HomePage`. Fichero aparte porque cada
 * test necesita una respuesta distinta de `/featured` y la caché de 5 min de
 * `services/api.ts` vive en variables de módulo.
 *
 * EL ORDEN DE LOS TESTS IMPORTA, y esa es justamente la deuda que F2 salda:
 * una respuesta correcta llena la caché para los 5 min siguientes, así que los
 * casos que necesitan un fallo tienen que ir ANTES del único que termina bien.
 * Cuando la caché sea inyectable, esta dependencia desaparece.
 *
 * Detalle que queda fijado: el error solo puede venir de `/featured`. La lista
 * de playas (`getPlayas`) nunca rechaza, así que el contador se pinta igual
 * aunque el backend esté caído.
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

    // Se suelta la petición: si se dejara colgada, `featuredRequest` quedaría
    // ocupado y contaminaría el resto del fichero. Se rechaza (y no se resuelve)
    // para no llenar la caché.
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
    // El listado sí llegó: el contador se pinta pese al error de featured.
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
