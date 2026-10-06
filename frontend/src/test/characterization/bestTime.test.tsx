/**
 * "Mejor hora para ir": the home page doesn't only say whether the best beach is
 * good, it says WHEN to go — the banded phrase, the best slot of the day and the
 * first change for the worse. Hours arrive from the API as UTC instants and are
 * checked here already composed in Madrid time (summer, UTC+2).
 */

import React from 'react';
import { screen } from '@testing-library/react';
import HomePage from '../../pages/HomePage';
import BestTime from '../../components/BestTime';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { FEATURED_PATH as FEATURED, BEACHES_PATH as BEACHES } from '../apiRoutes';

const NOW = featuredResponse.timestamp + 30 * 60 * 1000;

beforeEach(() => {
  localStorage.removeItem('user_location');
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(BEACHES, { json: beachesResponse }),
  ]);
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => {
  restoreFetch();
  jest.restoreAllMocks();
});

describe('HomePage — best time of day in the hero', () => {
  it('composes the phrase, the started window and the change from the approved example', async () => {
    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText('La Concha');

    // Banded phrase: 93 ≥ 75. The name is interpolated, never hardcoded.
    expect(screen.getByText('La Concha está muy bien hoy')).toBeInTheDocument();
    // It is 12:30 Madrid time and the window is 11:00–14:00: it has already
    // started, and announcing a start in the past would read as stale data. What
    // remains of it is stated instead.
    expect(screen.getByText('Buen momento hasta las 14:00')).toBeInTheDocument();
    expect(screen.getByText('A partir de las 17:00 aumenta el viento')).toBeInTheDocument();
  });
});

describe('BestTime — nothing is invented without data', () => {
  // The windows in these cases live on 27-Jul: the clock is anchored before
  // their start so the expiry guard does not see them as past.
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-27T08:00:00.000Z'));
  });

  it('renders nothing without a window', () => {
    const { container } = renderWithProviders(<BestTime timeWindow={null} />, { route: '/' });
    expect(container.querySelector('.best-time')).toBeNull();
  });

  it('a window reaching the end of the range announces no change', () => {
    renderWithProviders(
      <BestTime
        timeWindow={{
          inicio: '2026-07-27T09:00:00.000Z',
          fin: '2026-07-27T19:00:00.000Z',
          cambio: null,
        }}
      />,
      { route: '/' },
    );

    expect(screen.getByText('Mejor momento para ir: 11:00–21:00')).toBeInTheDocument();
    expect(screen.queryByText(/A partir de las/)).toBeNull();
  });
});

describe('BestTime — the clock overrides the cache', () => {
  it('an already finished window is not rendered: it came from a cached response', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-27T20:00:00.000Z'));
    const { container } = renderWithProviders(
      <BestTime
        timeWindow={{ inicio: '2026-07-27T09:00:00.000Z', fin: '2026-07-27T12:00:00.000Z', cambio: null }}
      />,
      { route: '/' },
    );

    expect(container.querySelector('.best-time')).toBeNull();
  });

  it('a started window says what remains, not a start in the past', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-27T10:30:00.000Z'));
    renderWithProviders(
      <BestTime
        timeWindow={{ inicio: '2026-07-27T09:00:00.000Z', fin: '2026-07-27T12:00:00.000Z', cambio: null }}
      />,
      { route: '/' },
    );

    expect(screen.getByText('Buen momento hasta las 14:00')).toBeInTheDocument();
    expect(screen.queryByText(/Mejor momento/)).toBeNull();
  });
});

describe('BestTime — the reason, only in the detailed view', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-27T08:00:00.000Z'));
  });

  const windowWithReason = {
    inicio: '2026-07-27T09:00:00.000Z',
    fin: '2026-07-27T13:00:00.000Z',
    cambio: { desde: '2026-07-27T13:00:00.000Z', causa: 'lluvia_prevista' as const },
    motivo: 'sin_lluvia' as const,
    horasConsideradas: 10,
  };

  it('with `detallada` names the reason for the stretch next to the change', () => {
    renderWithProviders(<BestTime timeWindow={windowWithReason} detailed />, { route: '/' });

    expect(screen.getByText('Elegido por ser el tramo sin lluvia previsto')).toBeInTheDocument();
    expect(screen.getByText('A partir de las 15:00 se espera lluvia')).toBeInTheDocument();
  });

  it('without `detallada` (the home page) the reason is omitted: the card stays compact', () => {
    renderWithProviders(<BestTime timeWindow={windowWithReason} />, { route: '/' });

    expect(screen.queryByText(/Elegido por/)).toBeNull();
  });

  it('with no reason or change, the calm is stated too', () => {
    renderWithProviders(
      <BestTime
        timeWindow={{ inicio: '2026-07-27T09:00:00.000Z', fin: '2026-07-27T19:00:00.000Z', cambio: null, motivo: null }}
        detailed
      />,
      { route: '/' },
    );

    expect(screen.getByText('Sin empeoramientos a la vista hasta el cierre del día')).toBeInTheDocument();
  });
});
