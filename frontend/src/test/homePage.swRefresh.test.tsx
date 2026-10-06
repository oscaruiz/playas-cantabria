/**
 * On 2-Sep-2026 the first load of the morning painted last night's sky — moon
 * icons and yesterday's temperatures — without saying anything and without
 * correcting itself.
 *
 * The cause is outside the app: `NetworkFirst` gives up on the network after
 * three seconds and resolves with whatever it has stored, and the first request
 * of the day always goes past that because the backend recomputes `/featured`
 * cold. At the `fetch` level that copy is a normal 200.
 *
 * What is pinned here is the home page's part: saying that what is painted is
 * not current, and painting the good response when the service worker delivers
 * it. That the worker delivers it — once, with the body inside and without
 * feeding back on itself — is its own business and was checked against Chrome.
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
import { API_UPDATED_MESSAGE } from '../hooks/useServiceWorkerRefresh';

const URL_FEATURED = 'https://api.example/api/cantabria/beaches/featured';
const WARNING = /última visita/i;

/** jsdom has no `navigator.serviceWorker`: an EventTarget is enough. */
const channel = new EventTarget();

beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', { value: channel, configurable: true });
});

/**
 * The ranking in force lives in module variables of `services/api` and is NOT
 * reset between tests — just as it is not reset between two screens of the app,
 * which is exactly what it is for. So the home page opens painting what the
 * previous case left and corrects itself when its response arrives, exactly as
 * happens to a screen that opens with an old ranking in force: that is why the
 * cases wait for the screen to SETTLE instead of looking at it instantly.
 * Each test also starts two minutes later, with the 60 s memo expired.
 */
let now = Date.now();

beforeEach(() => {
  now += 2 * 60 * 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  localStorage.removeItem('user_location');
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => restoreFetch());

/** What the service worker sends when the response it had given up on arrives. */
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

describe('HomePage — response served by the service worker', () => {
  it('warns when what is painted was built by the backend hours ago', async () => {
    installFetchMock([
      route(FEATURED, { json: withAge(12) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    expect(await screen.findByText(WARNING)).toBeInTheDocument();
  });

  it('warns of nothing when the data is current', async () => {
    installFetchMock([
      route(FEATURED, { json: withAge(0) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });

    await screen.findByText('La Concha');
    await waitFor(() => expect(screen.queryByText(WARNING)).not.toBeInTheDocument());
  });

  it('repaints with what the message carries, and the notice withdraws by itself', async () => {
    installFetchMock([
      route(FEATURED, { json: withAge(12) }),
      route(BEACHES, { json: beachesResponse }),
    ]);

    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText(WARNING);

    deliverFromSW(withAge(0));

    await waitFor(() => expect(screen.queryByText(WARNING)).not.toBeInTheDocument());
  });

  it('requests the ranking again on its own when what is painted is old', async () => {
    // The worker's message may never arrive: the request it gave up on fails,
    // or the backend returns the same old ranking. That is why the home page
    // requests again by itself — and by itself is the word: the notice is a
    // paragraph, not a button, because the tap had no way of winning.
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

  it('states the Madrid time of the ranking even when none is recommended', async () => {
    // The chip hung off `featured.playas.length`, so the day with no recommended
    // beach — the day when it matters most to know how old the data is — was
    // exactly the day it was not stated.
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

  it('ignores the delivery from another endpoint: the ranking is not the catalogue', async () => {
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

  it('shows it is updating while the request is in flight', async () => {
    // The app requests by itself, but silently it looked stuck: the freshness
    // chip's clock turns into a spinner while a REAL request is in flight, and
    // goes back to a clock when it finishes — whether or not it brings anything new.
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
