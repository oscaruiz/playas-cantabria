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
import { installFetchMock, restoreFetch, route, deferred } from './http/fakeFetch';
import type { RouteSpec } from './http/fakeFetch';
import { beachesResponse } from './fixtures/beaches';
import { featuredResponse } from './fixtures/featured';
import { FEATURED_PATH as FEATURED, BEACHES_PATH as BEACHES } from './apiRoutes';
import { API_UPDATED_MESSAGE } from '../hooks/useRefrescoDelServiceWorker';

const URL_FEATURED = 'https://api.example/api/cantabria/beaches/featured';
const WARNING = /última visita/i;

/** jsdom no trae `navigator.serviceWorker`: basta un EventTarget. */
const channel = new EventTarget();

beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', { value: channel, configurable: true });
});

/**
 * El ranking en vigor vive en variables de módulo de `services/api` y NO se
 * reinicia entre tests —igual que no se reinicia entre dos pantallas de la app,
 * que es justo para lo que está—. Así que la portada abre pintando lo que dejó
 * el caso anterior y se corrige cuando llega su respuesta, exactamente como le
 * pasa a una pantalla que se abre con un ranking viejo en vigor: por eso los
 * casos esperan a que la pantalla SE ASIENTE, en vez de mirarla al instante.
 * Cada test arranca además dos minutos después, con el memo de 60 s caducado.
 */
let now = Date.now();

beforeEach(() => {
  now += 2 * 60 * 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  localStorage.removeItem('user_location');
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => restoreFetch());

/** Lo que el service worker manda cuando llega la respuesta que abandonó. */
function deliverFromSW(data: unknown) {
  act(() => {
    const event = new Event('message') as Event & { data?: unknown };
    event.data = { type: API_UPDATED_MESSAGE, url: URL_FEATURED, datos: data };
    channel.dispatchEvent(event);
  });
}

function withAge(hours: number) {
  return { ...featuredResponse, timestamp: Date.now() - hours * 60 * 60 * 1000 };
}

describe('HomePage — respuesta servida por el service worker', () => {
  it('avisa cuando lo pintado lo construyó el backend hace horas', async () => {
    installFetchMock([
      route(FEATURED, { json: withAge(12) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    expect(await screen.findByText(WARNING)).toBeInTheDocument();
  });

  it('no avisa de nada cuando el dato es de ahora mismo', async () => {
    installFetchMock([
      route(FEATURED, { json: withAge(0) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    await screen.findByText('La Concha');
    await waitFor(() => expect(screen.queryByText(WARNING)).not.toBeInTheDocument());
  });

  it('se repinta con lo que trae el mensaje, y el aviso se retira solo', async () => {
    installFetchMock([
      route(FEATURED, { json: withAge(12) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText(WARNING);

    deliverFromSW(withAge(0));

    await waitFor(() => expect(screen.queryByText(WARNING)).not.toBeInTheDocument());
  });

  it('vuelve a pedir el ranking por su cuenta cuando lo pintado es viejo', async () => {
    // El mensaje del worker puede no llegar nunca: la petición que abandonó
    // falla, o el backend devuelve el mismo ranking viejo. Por eso la portada
    // vuelve a pedir sola — y sola es la palabra: el aviso es un párrafo, no un
    // botón, porque el toque no tenía forma de ganar.
    let calls = 0;
    installFetchMock([
      route(FEATURED, () => ({ json: calls++ === 0 ? withAge(12) : withAge(0) })),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    await screen.findByText(WARNING);
    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(screen.queryByText(WARNING)).not.toBeInTheDocument());
  });

  it('dice la hora de Madrid del ranking aunque no haya ninguna recomendada', async () => {
    // El chip colgaba de `featured.playas.length`, así que el día sin ninguna
    // playa recomendada —el día en que más importa saber de cuándo es el
    // dato— era justo el día en que no se decía.
    installFetchMock([
      route(FEATURED, { json: { ...withAge(0), playas: [], mejores: [] } }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    const hour = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(Date.now()));
    expect(await screen.findByText(new RegExp(hour))).toBeInTheDocument();
  });

  it('ignora la entrega de otro endpoint: el ranking no es el catálogo', async () => {
    installFetchMock([
      route(FEATURED, { json: withAge(12) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText(WARNING);

    act(() => {
      const event = new Event('message') as Event & { data?: unknown };
      event.data = {
        type: API_UPDATED_MESSAGE,
        url: 'https://api.example/api/cantabria/beaches',
        datos: beachesResponse,
      };
      channel.dispatchEvent(event);
    });

    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it('enseña que está actualizando mientras la petición está en vuelo', async () => {
    // La app pide sola, pero callada parecía atascada: el reloj del chip de
    // frescura se vuelve spinner mientras hay una petición DE VERDAD en vuelo,
    // y vuelve a ser reloj cuando termina — traiga algo nuevo o no.
    const inFlight = deferred<RouteSpec>();
    let calls = 0;
    installFetchMock([
      route(FEATURED, () => (calls++ === 0 ? { json: withAge(12) } : inFlight.promise)),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    expect(await screen.findByLabelText(/actualizando/i)).toBeInTheDocument();

    await act(async () => {
      inFlight.resolve({ json: withAge(0) });
    });

    await waitFor(() =>
      expect(screen.queryByLabelText(/actualizando/i)).not.toBeInTheDocument(),
    );
  });
});
