/**
 * El 2-sep-2026 la primera carga de la mañana pintó el cielo de anoche —iconos
 * de luna y temperaturas de ayer— sin decir nada y sin corregirse.
 *
 * La causa está fuera de la app: `NetworkFirst` abandona la red a los tres
 * segundos y resuelve con lo que tenga guardado, y la primera petición del día
 * siempre pasa de ahí porque el backend recalcula `/featured` en frío. A nivel
 * de `fetch` esa copia es un 200 normal.
 *
 * Aquí se fija la parte que le toca a la portada: decir que lo pintado no es de
 * ahora, y pintar la respuesta buena cuando el service worker la entrega. Que
 * el worker la entregue —una vez, con el cuerpo dentro y sin realimentarse— es
 * cosa suya y se comprobó contra Chrome.
 */

import React from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import HomePage from '../pages/HomePage';
import { renderWithProviders } from './render';
import { installFetchMock, restoreFetch, route } from './http/fakeFetch';
import { beachesResponse } from './fixtures/beaches';
import { featuredResponse } from './fixtures/featured';
import { RUTA_DESTACADAS as FEATURED, RUTA_PLAYAS as BEACHES } from './apiRoutes';
import { MENSAJE_API_ACTUALIZADA } from '../hooks/useRefrescoDelServiceWorker';

const URL_FEATURED = 'https://api.example/api/cantabria/beaches/featured';
const AVISO = /última visita/i;

/** jsdom no trae `navigator.serviceWorker`: basta un EventTarget. */
const canal = new EventTarget();

beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', { value: canal, configurable: true });
});

/**
 * `getFeaturedBeaches` memoriza 60 s en variables de módulo, así que sin esto el
 * payload del primer test se lo comen los siguientes. Cada test arranca dos
 * minutos después del anterior: el memo ha caducado y la respuesta que se
 * declara aquí es la que llega de verdad.
 */
let ahora = Date.now();

beforeEach(() => {
  ahora += 2 * 60 * 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => ahora);
  localStorage.removeItem('user_location');
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => restoreFetch());

/** Lo que el service worker manda cuando llega la respuesta que abandonó. */
function entregarDesdeElSW(datos: unknown) {
  act(() => {
    const evento = new Event('message') as Event & { data?: unknown };
    evento.data = { type: MENSAJE_API_ACTUALIZADA, url: URL_FEATURED, datos };
    canal.dispatchEvent(evento);
  });
}

function conEdad(horas: number) {
  return { ...featuredResponse, timestamp: Date.now() - horas * 60 * 60 * 1000 };
}

describe('HomePage — respuesta servida por el service worker', () => {
  it('avisa cuando lo pintado lo construyó el backend hace horas', async () => {
    installFetchMock([
      route(FEATURED, { json: conEdad(12) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    expect(await screen.findByText(AVISO)).toBeInTheDocument();
  });

  it('no avisa de nada cuando el dato es de ahora mismo', async () => {
    installFetchMock([
      route(FEATURED, { json: conEdad(0) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    await screen.findByText('La Concha');
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });

  it('se repinta con lo que trae el mensaje, y el aviso se retira solo', async () => {
    installFetchMock([
      route(FEATURED, { json: conEdad(12) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText(AVISO);

    entregarDesdeElSW(conEdad(0));

    await waitFor(() => expect(screen.queryByText(AVISO)).not.toBeInTheDocument());
  });

  it('ignora la entrega de otro endpoint: el ranking no es el catálogo', async () => {
    installFetchMock([
      route(FEATURED, { json: conEdad(12) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText(AVISO);

    act(() => {
      const evento = new Event('message') as Event & { data?: unknown };
      evento.data = {
        type: MENSAJE_API_ACTUALIZADA,
        url: 'https://api.example/api/cantabria/beaches',
        datos: beachesResponse,
      };
      canal.dispatchEvent(evento);
    });

    expect(screen.getByText(AVISO)).toBeInTheDocument();
  });
});
