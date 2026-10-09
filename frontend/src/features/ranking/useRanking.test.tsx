/**
 * The module every screen that paints a sky reads.
 *
 * What is asked of it here is what the five pages used to wire by hand: the
 * first answer, the one the service worker delivers late, whether what is
 * painted is a copy from an earlier visit, and asking again when it is.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useRanking } from './useRanking';
import { API_UPDATED_MESSAGE } from '../../hooks/useServiceWorkerRefresh';
import { installFetchMock, restoreFetch, route } from '../../test/http/fakeFetch';
import { FEATURED_PATH as FEATURED } from '../../test/apiRoutes';
import type { FeaturedBeachesResponse } from '../../services/api';

const URL_FEATURED = 'https://api.example/api/cantabria/beaches/featured';

/** jsdom does not ship `navigator.serviceWorker`: an EventTarget is enough. */
const channel = new EventTarget();

beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', { value: channel, configurable: true });
});

/**
 * The module cache lives in `services/api` and does NOT reset between tests —
 * the same way it does not reset between two pages of the app, which is the
 * whole point. Each case therefore moves the clock forward past its 60 s and
 * picks instants of its own.
 */
let now = Date.now();

beforeEach(() => {
  now += 2 * 60 * 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => restoreFetch());

function ranking(ageMinutes: number, sky: string): FeaturedBeachesResponse {
  return {
    timestamp: Date.now() - ageMinutes * 60 * 1000,
    playas: [],
    revisar: [],
    resumenTodas: [{ codigo: '1', descripcionClima: sky }],
  } as unknown as FeaturedBeachesResponse;
}

function deliverFromSW(data: unknown, url = URL_FEATURED) {
  act(() => {
    const event = new Event('message') as Event & { data?: unknown };
    event.data = { type: API_UPDATED_MESSAGE, url, datos: data };
    channel.dispatchEvent(event);
  });
}

const Probe: React.FC = () => {
  const { ranking: inForce, fromPreviousVisit, loading, error } = useRanking();
  if (loading) return <p>cargando</p>;
  return (
    <div>
      <p>{inForce?.resumenTodas[0]?.descripcionClima ?? 'sin ranking'}</p>
      {fromPreviousVisit && <p>de visita anterior</p>}
      {error && <p>falló</p>}
    </div>
  );
};

describe('useRanking', () => {
  it('paints the first answer and warns of nothing if it is current', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'cielo claro') })]);

    render(<Probe />);

    expect(await screen.findByText('cielo claro')).toBeInTheDocument();
    expect(screen.queryByText('de visita anterior')).not.toBeInTheDocument();
  });

  it('says what is painted is from an earlier visit when it is old', async () => {
    // A single retry goes out on its own; it returns the same, so the notice stays.
    installFetchMock([route(FEATURED, { json: ranking(90, 'cielo de anoche') })]);

    render(<Probe />);

    expect(await screen.findByText('de visita anterior')).toBeInTheDocument();
  });

  it('asks again on its own, and the notice is withdrawn when the new data arrives', async () => {
    let calls = 0;
    installFetchMock([
      route(FEATURED, () => ({
        json: calls++ === 0 ? ranking(90, 'cielo de anoche') : ranking(0, 'cielo claro'),
      })),
    ]);

    render(<Probe />);

    expect(await screen.findByText('cielo claro')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('de visita anterior')).not.toBeInTheDocument(),
    );
    expect(calls).toBe(2);
  });

  it('asks again after ten minutes without warning of anything', async () => {
    // The two thresholds are different questions: after ten minutes the backend
    // already has something newer to give —its fresh TTL is five— but it is
    // still ITS answer, so there is nothing to tell the user. Merging them again
    // means either lighting the notice on a normal day, or no longer refreshing
    // a screen left open and idle for an hour.
    let calls = 0;
    installFetchMock([
      route(FEATURED, () => ({
        json: calls++ === 0 ? ranking(20, 'cielo de hace un rato') : ranking(0, 'cielo recién hecho'),
      })),
    ]);

    render(<Probe />);

    // Skies with their own names: the ranking in force does not reset between
    // cases, so reusing another test's would make this one pass without asking
    // for anything.
    expect(await screen.findByText('cielo recién hecho')).toBeInTheDocument();
    expect(calls).toBe(2);
    expect(screen.queryByText('de visita anterior')).not.toBeInTheDocument();
  });

  it('keeps asking every minute while the first attempts bring back the same old ranking', async () => {
    // A tab resumed after hours: the radio is still waking up, so the load and
    // the first retry both get the worker's stored copy. One attempt per ranking
    // left the screen on "hace 3h" with the backend answering fine (9-oct-2026).
    jest.useFakeTimers('modern');
    // Fake timers bring their own clock: put back the one every case moves by hand.
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      let calls = 0;
      installFetchMock([
        route(FEATURED, () => ({
          json: calls++ < 2 ? ranking(180, 'cielo de hace tres horas') : ranking(0, 'cielo al volver'),
        })),
      ]);

      render(<Probe />);
      expect(await screen.findByText('cielo de hace tres horas')).toBeInTheDocument();
      await waitFor(() => expect(calls).toBe(2));

      now += 61 * 1000;
      await act(async () => { jest.advanceTimersByTime(61 * 1000); });

      expect(await screen.findByText('cielo al volver')).toBeInTheDocument();
      expect(calls).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('paints the ranking the service worker delivers late', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'nubes') })]);

    render(<Probe />);
    await screen.findByText('nubes');

    deliverFromSW(ranking(0, 'cielo claro'));

    expect(await screen.findByText('cielo claro')).toBeInTheDocument();
  });

  it('ignores other endpoints and bodies that are not a ranking', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'nubes') })]);

    render(<Probe />);
    await screen.findByText('nubes');

    deliverFromSW(ranking(0, 'cielo claro'), 'https://api.example/api/cantabria/beaches');
    deliverFromSW({ timestamp: Date.now() });

    expect(screen.getByText('nubes')).toBeInTheDocument();
  });

  it('reports the failure without erasing the sky already in force', async () => {
    // The ranking in force survives a failed request on purpose: it is exactly
    // what makes the app useful on the beach with poor coverage.
    installFetchMock([route(FEATURED, { status: 503 })]);

    render(<Probe />);

    expect(await screen.findByText('falló')).toBeInTheDocument();
    expect(screen.queryByText('sin ranking')).not.toBeInTheDocument();
  });
});
